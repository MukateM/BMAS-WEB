// Updated quiz-leaderboard.js
import { getQuizAdminClient } from './_lib/quiz-env.js';
import { normalizeUserTypeForClient } from './_lib/quiz-auth.js';

function monthKey(value = new Date()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function pickBestAttempts(attempts, targetMonthKey) {
  const bestByName = new Map();

  attempts
    .filter((attempt) => attempt.month_key === targetMonthKey)
    .forEach((attempt) => {
      const attemptKey = attempt.user_id;
      const existing = bestByName.get(attemptKey);
      
      if (!existing) {
        bestByName.set(attemptKey, { ...attempt });
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
        bestByName.set(attemptKey, { ...attempt });
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
  const limit = parseInt(req.query.limit) || 10;

  try {
    // First get attempts
    let { data: attempts, error: attemptsError } = await sb
      .from('quiz_attempts')
      .select('user_id, display_name, score, level, duration_seconds, submitted_at, month_key, correct_count, total_questions')
      .eq('month_key', targetMonthKey);

    if (attemptsError) {
      // Try legacy format
      const legacyResult = await sb
        .from('quiz_attempts')
        .select('user_id, display_alias, score, level, duration_seconds, submitted_at, month_key, correct_count, total_questions')
        .eq('month_key', targetMonthKey);
      attempts = legacyResult.data;
      attemptsError = legacyResult.error;
    }

    if (attemptsError) throw attemptsError;

    if (!attempts || attempts.length === 0) {
      return res.status(200).json({ leaderboard: [] });
    }

    // Get user profiles for the relevant users
    const userIds = [...new Set(attempts.map(a => a.user_id))];
    let { data: profiles, error: profilesError } = await sb
      .from('quiz_profiles')
      .select('user_id, display_name, institution, user_type')
      .in('user_id', userIds);

    if (profilesError && String(profilesError.message || '').includes('display_name')) {
      const legacyProfilesResult = await sb
        .from('quiz_profiles')
        .select('user_id, alias, full_name, institution_name, user_type')
        .in('user_id', userIds);
      profiles = legacyProfilesResult.data;
      profilesError = legacyProfilesResult.error;
    }

    if (profilesError) {
      console.error('[quiz-leaderboard] Profile fetch error:', profilesError);
      // Continue without profiles
    }

    // Create profile lookup map
    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(profile => {
        profileMap.set(profile.user_id, profile);
      });
    }

    // Enrich attempts with profile data
    const enrichedAttempts = attempts.map(attempt => {
      const profile = profileMap.get(attempt.user_id);
      const normalizedUserType = profile?.user_type
        ? normalizeUserTypeForClient(profile.user_type)
        : 'employee';
      return {
        ...attempt,
        display_name:
          profile?.display_name ||
          profile?.full_name ||
          profile?.alias ||
          attempt.display_name ||
          attempt.display_alias ||
          'Quiz member',
        institution_name: profile?.institution || profile?.institution_name || 'Not specified',
        user_type: normalizedUserType,
      };
    });

    const leaderboard = pickBestAttempts(enrichedAttempts, targetMonthKey).slice(0, limit);
    
    // Format leaderboard entries
    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      name: entry.display_name,
      institution: entry.institution_name,
      userType: entry.user_type,
      score: Number(entry.score),
      correctCount: Number(entry.correct_count || 0),
      totalQuestions: Number(entry.total_questions || 0),
      level: entry.level,
      duration: entry.duration_seconds
    }));

    return res.status(200).json({
      leaderboard: formattedLeaderboard,
      month: targetMonthKey
    });
  } catch (err) {
    console.error('[quiz-leaderboard] Error:', err);
    return res.status(500).json({ error: 'Unable to load the leaderboard right now.' });
  }
}
