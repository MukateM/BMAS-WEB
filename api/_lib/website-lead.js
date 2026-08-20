import { createClient } from '@supabase/supabase-js';
import { assertSimpleRateLimit, getClientIp } from './request-security.js';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xldoyovv';
const MAX_PAYLOAD_BYTES = 15000;

const text = (value, limit = 1000) => String(value ?? '').trim().slice(0, limit);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function reply(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'Method not allowed.' });

  const rate = assertSimpleRateLimit({ key: `lead:${getClientIp(req)}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rate.ok) return reply(res, 429, { ok: false, error: 'Too many requests. Please try again later.' });

  const rawSize = typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body || {}).length;
  if (rawSize > MAX_PAYLOAD_BYTES) return reply(res, 413, { ok: false, error: 'Payload too large.' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    return reply(res, 400, { ok: false, error: 'Invalid request body.' });
  }

  if (text(body.gotcha)) return reply(res, 200, { ok: true });

  const lead = {
    name: text(body.fullName, 120),
    email: text(body.email, 180).toLowerCase(),
    phone: text(body.phone, 80),
    company_name: text(body.company, 160) || null,
    service_interest: text(body.service, 160),
    message: text(body.message, 2000) || null,
    source: 'website_consultation',
    status: 'new',
    consent: body.consent === true,
    page_url: text(body.pageUrl, 500) || null,
    referrer: text(body.referrer, 500) || null,
    utm_source: text(body.utmSource, 120) || null,
    utm_medium: text(body.utmMedium, 120) || null,
    utm_campaign: text(body.utmCampaign, 160) || null,
  };

  if (!lead.name || !lead.email || !lead.phone || !lead.service_interest) {
    return reply(res, 400, { ok: false, error: 'Name, email, phone, and service are required.' });
  }
  if (!validEmail(lead.email)) return reply(res, 400, { ok: false, error: 'Please enter a valid email address.' });
  if (!lead.consent) return reply(res, 400, { ok: false, error: 'Consent is required before submitting.' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply(res, 503, { ok: false, error: 'Lead capture is not configured yet.' });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from('leads').insert(lead).select('id').single();
  if (error) {
    console.error('[leads] database insert failed', error.message);
    return reply(res, 502, { ok: false, error: 'Unable to log your enquiry right now.' });
  }

  try {
    const notification = new URLSearchParams({
      'Lead ID': data.id,
      'Full Name': lead.name,
      Email: lead.email,
      'Phone Number': lead.phone,
      Company: lead.company_name || '',
      'Service Interest': lead.service_interest,
      Message: lead.message || '',
      Source: lead.source,
      Campaign: lead.utm_campaign || '',
    });
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: notification,
    });
    if (!response.ok) console.error('[leads] notification failed', response.status);
  } catch (error) {
    console.error('[leads] notification failed', error.message);
  }

  return reply(res, 201, { ok: true, id: data.id });
}
