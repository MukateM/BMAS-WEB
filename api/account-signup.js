import { getQuizAdminClient } from './_lib/quiz-env.js';
import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';

function sendJson(res, statusCode, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(statusCode).send(JSON.stringify(body));
}

function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

function normalizeAuthErrorMessage(error) {
  return String(error?.message || error?.error_description || '').trim();
}

function isExistingUserError(error) {
  const message = normalizeAuthErrorMessage(error).toLowerCase();
  return message.includes('already') || message.includes('registered') || message.includes('exists');
}

function isPasswordRejectedError(error) {
  const message = normalizeAuthErrorMessage(error).toLowerCase();
  return (
    message.includes('password') ||
    message.includes('pwned') ||
    message.includes('compromised') ||
    message.includes('weak')
  );
}

function validateSignup(body = {}) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim();

  if (!email || !password) {
    return { ok: false, status: 400, error: 'Email and password are required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'Please enter a valid email address.' };
  }
  if (password.length < 8) {
    return { ok: false, status: 400, error: 'Password must be at least 8 characters.' };
  }
  if (fullName.length > 120) {
    return { ok: false, status: 400, error: 'Name must be 120 characters or fewer.' };
  }

  return { ok: true, data: { email, password, fullName } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  const rate = assertSimpleRateLimit({
    key: `account-signup:${getClientIp(req)}`,
    limit: 8,
    windowMs: 60 * 1000,
  });
  if (!rate.ok) {
    sendJson(res, 429, { ok: false, error: 'Too many sign-up attempts. Please try again shortly.' });
    return;
  }

  const validation = validateSignup(req.body || {});
  if (!validation.ok) {
    sendJson(res, validation.status, { ok: false, error: validation.error });
    return;
  }

  const { client } = getQuizAdminClient();
  if (!client) {
    sendJson(res, 503, { ok: false, error: 'BMAS account sign-up is temporarily unavailable.' });
    return;
  }

  const { email, password, fullName } = validation.data;
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (error) {
    if (isExistingUserError(error)) {
      sendJson(res, 409, { ok: false, error: 'An account already exists for this email. Please sign in instead.' });
      return;
    }
    if (isPasswordRejectedError(error)) {
      sendJson(res, 400, {
        ok: false,
        error: normalizeAuthErrorMessage(error) || 'Please choose a stronger password.',
      });
      return;
    }

    console.error('[account-signup] Unable to create user:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    sendJson(res, 400, { ok: false, error: 'Unable to create account with those details.' });
    return;
  }

  sendJson(res, 201, {
    ok: true,
    user: {
      id: data?.user?.id,
      email: data?.user?.email || email,
    },
  });
}
