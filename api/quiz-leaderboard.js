import { getQuizAdminClient } from './_lib/quiz-env.js';

function monthKey(value = new Date()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function pickBestAttempts(attempts, targetMonthKey) {
  const bestByName = new Map();

  attempts
    .filter((attempt) => attempt.month_key === targetMonthKey)
    .forEach((attempt) => {
      const attemptName = attempt.display_name || attempt.display_alias || 'Quiz member';
      const existing = bestByName.get(attemptName);
      if (!existing) {
        bestByName.set(attemptName, { ...attempt, display_name: attemptName });
        return;
      }

      const existingScore = Number(existing.score);
      const incomingScore = Number(attempt.score);
      if (
        incomingScore > existingScore ||
        (incomingScore === existingScore && attempt.level > existing.level) ||
        (incomingScore === existingScore &&
          attempt.level === existing.level &&
          Number(attempt.duration_seconds || 0) < Number(existing.duration_seconds || 0))
      ) {
        bestByName.set(attemptName, { ...attempt, display_name: attemptName });
      }
    });

  return Array.from(bestByName.values()).sort((a, b) => {
    if (Number(b.score) !== Number(a.score)) return Number(b.score) - Number(a.score);
    if (b.level !== a.level) return b.level - a.level;
    if (Number(a.duration_seconds || 0) !== Number(b.duration_seconds || 0)) {
      return Number(a.duration_seconds || 0) - Number(b.duration_seconds || 0);
    }
    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  const targetMonthKey = String(req.query.monthKey || monthKey());

  try {
    let { data, error } = await sb
      .from('quiz_attempts')
      .select('display_name, score, level, duration_seconds, submitted_at, month_key')
      .eq('month_key', targetMonthKey);

    if (error && String(error.message || '').includes('display_name')) {
      const legacyResult = await sb
        .from('quiz_attempts')
        .select('display_alias, score, level, duration_seconds, submitted_at, month_key')
        .eq('month_key', targetMonthKey);
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) throw error;

    return res.status(200).json({
      leaderboard: pickBestAttempts(data || [], targetMonthKey).slice(0, 10),
    });
  } catch (err) {
    console.error('[quiz-leaderboard] Error:', {
      message: err?.message,
      code: err?.code,
      status: err?.status,
      details: err?.details,
      hint: err?.hint,
    });
    return res.status(500).json({ error: 'Unable to load the leaderboard right now.' });
  }
}
