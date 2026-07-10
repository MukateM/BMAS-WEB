import { getQuizAdminClient } from './_lib/quiz-env.js';
import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';

function sendJson(res, statusCode, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.status(statusCode).send(JSON.stringify(body));
}

function normalizeDays(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(90, parsed));
}

function requireAdminKey(req) {
  const expected = process.env.ANALYTICS_ADMIN_KEY || '';
  if (!expected) return { ok: false, status: 503, error: 'ANALYTICS_ADMIN_KEY is not configured.' };

  const supplied =
    req?.headers?.['x-analytics-admin-key'] ||
    req?.headers?.['X-Analytics-Admin-Key'] ||
    req?.query?.key ||
    '';

  if (String(supplied) !== expected) {
    return { ok: false, status: 401, error: 'Access denied.' };
  }

  return { ok: true };
}

function addCount(map, key, fallback = 'Unknown') {
  const label = String(key || fallback).trim() || fallback;
  map.set(label, (map.get(label) || 0) + 1);
}

function top(map, limit = 10) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const limiter = assertSimpleRateLimit({
    key: `analytics-summary:${getClientIp(req)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!limiter.ok) {
    return sendJson(res, 429, { ok: false, error: 'Too many analytics requests.' });
  }

  const auth = requireAdminKey(req);
  if (!auth.ok) {
    return sendJson(res, auth.status, { ok: false, error: auth.error });
  }

  const { client: sb, env } = getQuizAdminClient();
  if (!sb) {
    console.error('[analytics-summary] Missing Supabase admin config:', {
      hasUrl: Boolean(env.supabaseUrl),
      hasKey: Boolean(env.supabaseServiceRoleKey),
    });
    return sendJson(res, 503, { ok: false, error: 'Analytics backend is not configured yet.' });
  }

  const days = normalizeDays(req.query?.days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('site_analytics_events')
    .select('occurred_at,event_type,path,referrer_host,visitor_id_hash,session_id_hash,device_type,browser,os,country')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(20000);

  if (error) {
    console.error('[analytics-summary] Query failed:', error);
    return sendJson(res, 500, { ok: false, error: 'Analytics summary could not be loaded.' });
  }

  const rows = data || [];
  const visitors = new Set();
  const sessions = new Set();
  const pages = new Map();
  const referrers = new Map();
  const devices = new Map();
  const browsers = new Map();
  const countries = new Map();
  const dailyMap = new Map();

  rows.forEach((row) => {
    if (row.visitor_id_hash) visitors.add(row.visitor_id_hash);
    if (row.session_id_hash) sessions.add(row.session_id_hash);
    if (row.event_type === 'pageview') {
      addCount(pages, row.path, '/');
      addCount(dailyMap, dateKey(row.occurred_at), dateKey(row.occurred_at));
    }
    addCount(referrers, row.referrer_host || 'Direct');
    addCount(devices, row.device_type);
    addCount(browsers, row.browser);
    addCount(countries, row.country || 'Unknown');
  });

  const daily = Array.from(dailyMap.entries())
    .map(([date, pageviews]) => ({ date, pageviews }))
    .filter((row) => row.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  return sendJson(res, 200, {
    ok: true,
    range: { days, since },
    totals: {
      events: rows.length,
      pageviews: rows.filter((row) => row.event_type === 'pageview').length,
      visitors: visitors.size,
      sessions: sessions.size,
    },
    daily,
    topPages: top(pages),
    referrers: top(referrers),
    devices: top(devices),
    browsers: top(browsers),
    countries: top(countries),
    recent: rows.slice(0, 20),
  });
}
