import crypto from 'node:crypto';

import { getQuizAdminClient } from './_lib/quiz-env.js';
import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';

const MAX_BODY_BYTES = 12 * 1024;

function sendJson(res, statusCode, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.status(statusCode).send(JSON.stringify(body));
}

function firstHeader(req, names) {
  for (const name of names) {
    const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function safeString(value, maxLength = 500) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}

function safeInt(value, max = 100000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(parsed, max);
}

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) return null;
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return null;
    }
  }
  return {};
}

function hashValue(value) {
  const text = safeString(value, 200);
  if (!text) return '';
  const salt = process.env.ANALYTICS_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'bmas-analytics';
  return crypto.createHash('sha256').update(`${salt}:${text}`).digest('hex');
}

function parseReferrerHost(referrer) {
  try {
    if (!referrer) return '';
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch (_error) {
    return '';
  }
}

function parsePath(value) {
  const raw = safeString(value || '/', 700);
  try {
    const parsed = new URL(raw, 'https://www.bmas.co.za');
    return `${parsed.pathname}${parsed.search}`.slice(0, 700) || '/';
  } catch (_error) {
    return raw.startsWith('/') ? raw : '/';
  }
}

function classifyDevice(userAgent) {
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}

function parseBrowser(userAgent) {
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/opr\//i.test(userAgent)) return 'Opera';
  if (/chrome|crios/i.test(userAgent)) return 'Chrome';
  if (/firefox|fxios/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent)) return 'Safari';
  return 'Other';
}

function parseOs(userAgent) {
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  if (/mac os|macintosh/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Other';
}

function normalizeEventType(value) {
  const eventType = safeString(value, 40);
  return ['pageview', 'event', 'outbound_click'].includes(eventType) ? eventType : 'pageview';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const limiter = assertSimpleRateLimit({
    key: `site-analytics:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!limiter.ok) {
    return sendJson(res, 429, { ok: false, error: 'Too many analytics requests.' });
  }

  const secFetchSite = firstHeader(req, ['sec-fetch-site']);
  if (secFetchSite && !['same-origin', 'none'].includes(secFetchSite)) {
    return sendJson(res, 403, { ok: false, error: 'Cross-site analytics requests are not accepted.' });
  }

  const payload = getBody(req);
  if (!payload) {
    return sendJson(res, 413, { ok: false, error: 'Analytics payload is too large or invalid.' });
  }

  const { client: sb, env } = getQuizAdminClient();
  if (!sb) {
    console.error('[analytics] Missing Supabase admin config:', {
      hasUrl: Boolean(env.supabaseUrl),
      hasKey: Boolean(env.supabaseServiceRoleKey),
    });
    return sendJson(res, 503, { ok: false, error: 'Analytics backend is not configured yet.' });
  }

  const userAgent = firstHeader(req, ['user-agent']);
  const referrer = safeString(payload.referrer, 700);
  const event = {
    occurred_at: new Date().toISOString(),
    event_type: normalizeEventType(payload.eventType),
    path: parsePath(payload.path),
    title: safeString(payload.title, 180),
    hostname: safeString(payload.hostname, 120),
    referrer,
    referrer_host: safeString(payload.referrerHost || parseReferrerHost(referrer), 180),
    utm_source: safeString(payload.utm?.source, 120),
    utm_medium: safeString(payload.utm?.medium, 120),
    utm_campaign: safeString(payload.utm?.campaign, 180),
    visitor_id_hash: hashValue(payload.visitorId),
    session_id_hash: hashValue(payload.sessionId),
    device_type: safeString(payload.deviceType || classifyDevice(userAgent), 30),
    browser: safeString(payload.browser || parseBrowser(userAgent), 50),
    os: safeString(payload.os || parseOs(userAgent), 50),
    country: safeString(firstHeader(req, ['x-vercel-ip-country', 'cf-ipcountry']), 10),
    region: safeString(firstHeader(req, ['x-vercel-ip-country-region']), 80),
    city: safeString(firstHeader(req, ['x-vercel-ip-city']), 120),
    language: safeString(payload.language, 50),
    screen_width: safeInt(payload.screen?.width),
    screen_height: safeInt(payload.screen?.height),
    viewport_width: safeInt(payload.viewport?.width),
    viewport_height: safeInt(payload.viewport?.height),
    metadata: {
      eventName: safeString(payload.eventName, 120),
      href: safeString(payload.href, 700),
    },
  };

  if (!event.path) {
    return sendJson(res, 400, { ok: false, error: 'Missing analytics path.' });
  }

  const { error } = await sb.from('site_analytics_events').insert(event);
  if (error) {
    console.error('[analytics] Insert failed:', error);
    return sendJson(res, 500, { ok: false, error: 'Analytics event could not be recorded.' });
  }

  res.statusCode = 204;
  return res.end();
}
