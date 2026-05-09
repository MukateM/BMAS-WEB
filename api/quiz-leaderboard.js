// Updated quiz-leaderboard.js
import { getQuizAdminClient } from './_lib/quiz-env.js';
import { normalizeUserTypeForClient } from './_lib/quiz-auth.js';

function buildLeaderboard(attempts) {
  const firstPassesByLevel = new Map();

  attempts
    .forEach((attempt) => {
      if (!attempt.passed) return;

      const levelKey = `${attempt.user_id}:${attempt.level}`;
      const existingLevelPass = firstPassesByLevel.get(levelKey);
      if (
        !existingLevelPass ||
        new Date(attempt.submitted_at).getTime() < new Date(existingLevelPass.submitted_at).getTime()
      ) {
        firstPassesByLevel.set(levelKey, { ...attempt });
      }
    });

  const aggregates = new Map();
  Array.from(firstPassesByLevel.values()).forEach((attempt) => {
      const attemptKey = attempt.user_id;
      const existing = aggregates.get(attemptKey);
      const correctCount = Number(attempt.correct_count || 0);
      const totalQuestions = Number(attempt.total_questions || 0);
      const durationSeconds = Number(attempt.duration_seconds || 0);
      const attemptLevel = Number(attempt.level || 1);
      const submittedAt = new Date(attempt.submitted_at).getTime();

      if (!existing) {
        aggregates.set(attemptKey, {
          ...attempt,
          highest_level: attemptLevel,
          correct_count: correctCount,
          total_questions: totalQuestions,
          duration_seconds: durationSeconds,
          attempts_count: 1,
          first_submitted_at: attempt.submitted_at,
          last_submitted_at: attempt.submitted_at,
          best_single_score: Number(attempt.score || 0),
        });
        return;
      }

      existing.correct_count += correctCount;
      existing.total_questions += totalQuestions;
      existing.duration_seconds += durationSeconds;
      existing.attempts_count += 1;
      existing.highest_level = Math.max(Number(existing.highest_level || 1), attemptLevel);
      existing.best_single_score = Math.max(Number(existing.best_single_score || 0), Number(attempt.score || 0));

      if (submittedAt < new Date(existing.first_submitted_at).getTime()) {
        existing.first_submitted_at = attempt.submitted_at;
      }
      if (submittedAt > new Date(existing.last_submitted_at).getTime()) {
        existing.last_submitted_at = attempt.submitted_at;
      }
    });

  return Array.from(aggregates.values())
    .map((entry) => ({
      ...entry,
      level: Number(entry.highest_level || entry.level || 1),
      score: Number(entry.total_questions || 0) > 0
        ? Number((Number(entry.correct_count || 0) / Number(entry.total_questions || 0)).toFixed(4))
        : 0,
    }))
    .sort((a, b) => {
      if (Number(b.level || 0) !== Number(a.level || 0)) return Number(b.level || 0) - Number(a.level || 0);
      if (Number(b.correct_count || 0) !== Number(a.correct_count || 0)) {
        return Number(b.correct_count || 0) - Number(a.correct_count || 0);
      }
      if (Number(b.score || 0) !== Number(a.score || 0)) return Number(b.score || 0) - Number(a.score || 0);
      if (Number(a.duration_seconds || 0) !== Number(b.duration_seconds || 0)) {
        return Number(a.duration_seconds || 0) - Number(b.duration_seconds || 0);
      }
      return new Date(a.last_submitted_at || a.submitted_at).getTime()
        - new Date(b.last_submitted_at || b.submitted_at).getTime();
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

  const limit = parseInt(req.query.limit) || 10;

  try {
    // First get attempts
    let { data: attempts, error: attemptsError } = await sb
      .from('quiz_attempts')
      .select('user_id, display_name, score, level, duration_seconds, submitted_at, month_key, correct_count, total_questions, passed')
      .order('submitted_at', { ascending: false });

    if (attemptsError) {
      // Try legacy format
      const legacyResult = await sb
        .from('quiz_attempts')
        .select('user_id, display_alias, score, level, duration_seconds, submitted_at, month_key, correct_count, total_questions, passed')
        .order('submitted_at', { ascending: false });
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

    const leaderboard = buildLeaderboard(enrichedAttempts).slice(0, limit);
    
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
      duration: entry.duration_seconds,
      attemptsCount: Number(entry.attempts_count || 1),
    }));

    return res.status(200).json({
      leaderboard: formattedLeaderboard
    });
  } catch (err) {
    console.error('[quiz-leaderboard] Error:', err);
    return res.status(500).json({ error: 'Unable to load the leaderboard right now.' });
  }
}
