import { signInManualQuizUser, validateSigninPayload } from './_lib/quiz-auth.js';
import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const limiter = assertSimpleRateLimit({
    key: `quiz-signin:${getClientIp(req)}`,
    limit: 10,
    windowMs: 60 * 1000,
  });
  if (!limiter.ok) {
    return res.status(429).json({ error: 'Too many sign-in attempts. Please try again shortly.' });
  }

  try {
    const validation = validateSigninPayload(req.body || {});
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await signInManualQuizUser(validation.data);
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        details: result.details,
      });
    }

    return res.status(200).json({
      success: true,
      user: result.user,
      profile: result.profile,
      session: result.session,
    });
  } catch (error) {
    console.error('[quiz-signin] Unexpected error:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });

    return res.status(500).json({
      error: 'Unable to sign in right now. Please try again later.',
    });
  }
}
