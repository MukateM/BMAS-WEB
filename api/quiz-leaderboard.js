import { getQuizAdminClient } from './_lib/quiz-env.js';
import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(50, parsed));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limiter = assertSimpleRateLimit({
    key: `quiz-leaderboard:${getClientIp(req)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!limiter.ok) {
    return res.status(429).json({ error: 'Too many leaderboard requests. Please try again shortly.' });
  }

  const { client: sb, env } = getQuizAdminClient();
  if (!sb) {
    console.error('[quiz-leaderboard] Missing env vars:', {
      hasUrl: Boolean(env.supabaseUrl),
      hasKey: Boolean(env.supabaseServiceRoleKey),
    });
    return res.status(503).json({
      error: 'Quiz backend is not configured yet.',
      details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  const limit = normalizeLimit(req.query?.limit);

  try {
    const { data: leaderboard, error } = await sb.rpc('get_quiz_leaderboard', {
      p_limit: limit,
    });

    if (error) throw error;

    return res.status(200).json({
      leaderboard: leaderboard || [],
    });
  } catch (err) {
    console.error('[quiz-leaderboard] Error:', err);
    return res.status(500).json({ error: 'Unable to load the leaderboard right now.' });
  }
}
