import { getQuizEnv } from './_lib/quiz-env.js';

function sendJson(res, statusCode, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(statusCode).send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const env = getQuizEnv();
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  const derivedSiteUrl = host ? `${protocol}://${host}` : 'http://localhost:3000';
  const siteUrl = env.siteUrl || derivedSiteUrl;

  sendJson(res, 200, {
    ok: true,
    supabaseConfigured: env.hasPublicConfig,
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    siteUrl,
  });
}
