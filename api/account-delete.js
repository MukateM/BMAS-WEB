import { getAuthenticatedSupabaseUser } from './_lib/quiz-env.js';
import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';

function sendJson(res, statusCode, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(statusCode).send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const ip = getClientIp(req);
  const rate = assertSimpleRateLimit({
    key: `account-delete:${ip}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.ok) {
    sendJson(res, 429, { ok: false, error: 'Too many account deletion attempts. Please try again later.' });
    return;
  }

  const auth = await getAuthenticatedSupabaseUser(req, { backendName: 'BMAS account backend' });
  if (auth.error) {
    sendJson(res, auth.status, { ok: false, error: auth.error });
    return;
  }

  const confirmation = String(req.body?.confirmation || '').trim();
  if (confirmation !== 'DELETE') {
    sendJson(res, 400, { ok: false, error: 'Type DELETE to confirm account deletion.' });
    return;
  }

  const { error } = await auth.client.auth.admin.deleteUser(auth.user.id);
  if (error) {
    sendJson(res, 500, { ok: false, error: 'Could not delete your account. Please contact BMAS support.' });
    return;
  }

  sendJson(res, 200, { ok: true });
}
