import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xldoyovv';
const MAX_PAYLOAD_BYTES = 15000;

function sendJson(res, statusCode, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(statusCode).json(body);
}

function safeText(value, maxLength = 3000) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: 'reCAPTCHA verification is required.' };

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) return { ok: false, error: 'Unable to verify reCAPTCHA.' };
  const result = await response.json();
  return result.success ? { ok: true } : { ok: false, error: 'reCAPTCHA verification failed.' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  const ip = getClientIp(req);
  const rateLimit = assertSimpleRateLimit({
    key: `compliance-lead:${ip}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    sendJson(res, 429, {
      ok: false,
      error: 'Too many requests. Please try again later.',
      retryAfterMs: rateLimit.retryAfterMs,
    });
    return;
  }

  const rawSize = typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body || {}).length;
  if (rawSize > MAX_PAYLOAD_BYTES) {
    sendJson(res, 413, { ok: false, error: 'Payload too large.' });
    return;
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid request body.' });
    return;
  }

  if (safeText(payload.gotcha)) {
    sendJson(res, 200, { ok: true });
    return;
  }

  const fullName = safeText(payload.fullName, 120);
  const email = safeText(payload.email, 180);
  const phone = safeText(payload.phone, 80);
  const company = safeText(payload.company, 160);
  const message = safeText(payload.message, 1200);
  const consent = Boolean(payload.consent);

  if (!fullName || !email || !phone) {
    sendJson(res, 400, { ok: false, error: 'Full name, email, and phone are required.' });
    return;
  }

  if (!isValidEmail(email)) {
    sendJson(res, 400, { ok: false, error: 'Please enter a valid email address.' });
    return;
  }

  if (!consent) {
    sendJson(res, 400, { ok: false, error: 'Consent is required before submitting.' });
    return;
  }

  const recaptcha = await verifyRecaptcha(safeText(payload.recaptchaToken, 2500));
  if (!recaptcha.ok) {
    sendJson(res, 400, { ok: false, error: recaptcha.error });
    return;
  }

  const formBody = new URLSearchParams({
    'Assessment Type': 'BMAS Employers Self Compliance Assessment',
    'Full Name': fullName,
    Email: email,
    'Phone Number': phone,
    Company: company,
    Message: message,
    'Compliance Score': safeText(payload.score, 80),
    'Risk Band': safeText(payload.band, 80),
    'Risk Areas': safeText(payload.gaps, 5000),
    'Assessment Answers': safeText(payload.answers, 7000),
    'Privacy Consent': consent ? 'Yes' : 'No',
    'reCAPTCHA': recaptcha.skipped ? 'Not configured' : 'Verified',
  });

  const formspreeResponse = await fetch(FORMSPREE_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  });

  if (!formspreeResponse.ok) {
    sendJson(res, 502, { ok: false, error: 'Unable to submit enquiry right now.' });
    return;
  }

  sendJson(res, 200, { ok: true });
}
