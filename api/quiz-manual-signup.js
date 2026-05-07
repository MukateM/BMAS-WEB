import { createManualQuizUser, validateSignupPayload } from './_lib/quiz-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const validation = validateSignupPayload(req.body || {});
    if (!validation.ok) {
      return res.status(400).json({
        error: validation.error,
        details: validation.details,
      });
    }

    const result = await createManualQuizUser(validation.data);
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        details: result.details,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. You can sign in now.',
      user: result.user,
      profile: result.profile,
    });
  } catch (error) {
    console.error('[quiz-manual-signup] Unexpected error:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });

    return res.status(500).json({
      error: error?.status === 503
        ? 'Manual authentication database tables are not installed yet.'
        : 'Unable to create account right now. Please try again later.',
      details: error?.details,
    });
  }
}
