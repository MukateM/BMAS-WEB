/**
 * /api/quiz-submit
 * POST {
 *   attemptSessionId: string,
 *   answers: (number|null)[]
 * }
 *
 * Scoring happens here; correct_index never leaves the database before submit.
 * The server binds scoring to an authenticated user and a previously issued
 * attempt session.
 */

import { getAuthenticatedQuizUser } from './_lib/quiz-env.js';
import { reconcileQuizProfileLevel } from './_lib/quiz-progress.js';
import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';

const PASS_THRESHOLD = 0.5;

function buildAttemptDisplayName(profile, user) {
  const candidates = [
    profile?.display_name,
    profile?.full_name,
    profile?.alias,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
    user?.email,
    'Quiz member',
  ];

  return candidates
    .map((value) => String(value || '').trim())
    .find(Boolean) || 'Quiz member';
}

function shouldRetryWithLegacyAttemptInsert(error) {
  const message = String(error?.message || '');
  return message.includes('display_name') || message.includes('display_alias');
}

async function insertQuizAttempt(sb, payload, attemptDisplayName) {
  const common = {
    user_id: payload.user_id,
    level: payload.level,
    month_key: payload.month_key,
    score: payload.score,
    passed: payload.passed,
    correct_count: payload.correct_count,
    total_questions: payload.total_questions,
    duration_seconds: payload.duration_seconds,
    submitted_at: payload.submitted_at,
  };

  const combinedInsert = await sb.from('quiz_attempts').insert({
    ...common,
    display_name: attemptDisplayName,
    display_alias: attemptDisplayName,
  });
  if (!combinedInsert.error) return null;

  const combinedMessage = String(combinedInsert.error.message || '');
  if (!combinedMessage.includes('display_name') && !combinedMessage.includes('display_alias')) {
    return combinedInsert.error;
  }

  const modernInsert = await sb.from('quiz_attempts').insert({
    ...common,
    display_name: attemptDisplayName,
  });
  if (!modernInsert.error) return null;

  if (!shouldRetryWithLegacyAttemptInsert(modernInsert.error)) {
    return modernInsert.error;
  }

  const legacyInsert = await sb.from('quiz_attempts').insert({
    ...common,
    display_alias: attemptDisplayName,
  });
  return legacyInsert.error || null;
}

function hashSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle(items, seedText) {
  let state = hashSeed(seedText) || 1;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limiter = assertSimpleRateLimit({
    key: `quiz-submit:${getClientIp(req)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!limiter.ok) {
    return res.status(429).json({ error: 'Too many submissions. Please wait a moment and try again.' });
  }

  const auth = await getAuthenticatedQuizUser(req);
  const { client: sb, env, user } = auth;

  if (!sb) {
    console.error('[quiz-submit] Missing env vars:', {
      hasUrl: Boolean(env?.supabaseUrl),
      hasKey: Boolean(env?.supabaseServiceRoleKey),
    });
    return res.status(503).json({
      error: 'Quiz backend is not configured yet.',
      details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { attemptSessionId, answers, level, monthKey, durationSeconds: clientDurationSeconds } = req.body || {};
  const userId = user.id;

  if ((!attemptSessionId && (!level || !monthKey)) || !answers) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array.' });
  }

  if (answers.some((answer) => answer !== null && (!Number.isInteger(answer) || answer < 0 || answer > 3))) {
    return res.status(400).json({ error: 'Each answer must be null or an option index between 0 and 3.' });
  }

  try {
    let { data: sessionRow, error: sessionError } = await sb
      .from('quiz_attempt_sessions')
      .select('id, user_id, level, month_key, question_ids, issued_at, submitted_at, expires_at')
      .eq('id', attemptSessionId)
      .eq('user_id', userId)
      .maybeSingle();

    const legacyMode = Boolean(sessionError && String(sessionError.message || '').includes('quiz_attempt_sessions'));
    if (sessionError && !legacyMode) throw sessionError;

    let questionIds = [];
    let effectiveLevel = level;
    let effectiveMonthKey = monthKey;
    let effectiveDurationSeconds = Math.max(1, Math.round(clientDurationSeconds || 1));

    if (!legacyMode) {
      if (!sessionRow) {
        return res.status(404).json({ error: 'Quiz attempt session not found.' });
      }

      if (sessionRow.submitted_at) {
        return res.status(409).json({ error: 'This quiz session has already been submitted. Please start the level again.' });
      }

      if (sessionRow.expires_at && new Date(sessionRow.expires_at).getTime() < Date.now()) {
        return res.status(410).json({ error: 'This quiz session has expired. Please start the level again.' });
      }

      questionIds = Array.isArray(sessionRow.question_ids) ? sessionRow.question_ids : [];
      if (!questionIds.length || questionIds.length !== answers.length) {
        return res.status(400).json({ error: 'Answer count does not match the issued question set.' });
      }

      effectiveLevel = sessionRow.level;
      effectiveMonthKey = sessionRow.month_key;
      effectiveDurationSeconds = Math.max(
        1,
        Math.round((Date.now() - new Date(sessionRow.issued_at).getTime()) / 1000),
      );
    } else {
      const { data: legacyRows, error: legacyQuestionsError } = await sb
        .from('quiz_questions')
        .select('id, level')
        .eq('level', level)
        .eq('active', true);

      if (legacyQuestionsError) throw legacyQuestionsError;
      if (!legacyRows || legacyRows.length === 0) {
        return res.status(404).json({ error: 'No questions found for this level.' });
      }

      const seed = `${userId}:${level}:${monthKey}`;
      const selected = seededShuffle(legacyRows, seed).slice(0, Math.min(12, legacyRows.length));
      questionIds = selected.map((question) => question.id);
      if (questionIds.length !== answers.length) {
        return res.status(400).json({ error: 'Answer count does not match the issued question set.' });
      }
    }

    let { data: profile, error: profileError } = await sb
      .from('quiz_profiles')
      .select('current_level, display_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError && String(profileError.message || '').includes('display_name')) {
      const legacyProfile = await sb
        .from('quiz_profiles')
        .select('current_level, alias, full_name')
        .eq('user_id', userId)
        .maybeSingle();
      profile = legacyProfile.data
        ? {
            current_level: legacyProfile.data.current_level,
            display_name: legacyProfile.data.full_name || legacyProfile.data.alias || user.email || 'Quiz member',
          }
        : null;
      profileError = legacyProfile.error;
    }

    if (profileError) throw profileError;
    if (!profile) {
      return res.status(404).json({ error: 'Quiz profile not found.' });
    }

    profile = await reconcileQuizProfileLevel(sb, userId, profile);
    const attemptDisplayName = buildAttemptDisplayName(profile, user);

    if (!String(profile.display_name || '').trim()) {
      const { error: profileRepairError } = await sb
        .from('quiz_profiles')
        .update({ display_name: attemptDisplayName, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (!profileRepairError) {
        profile = {
          ...profile,
          display_name: attemptDisplayName,
        };
      } else if (!String(profileRepairError.message || '').includes('display_name')) {
        throw profileRepairError;
      }
    }

    const { data: rows, error: fetchError } = await sb
      .from('quiz_questions')
      .select('id, correct_index, option_a, option_b, option_c, option_d, explanation, act_reference, case_reference')
      .in('id', questionIds);

    if (fetchError) throw fetchError;

    const questionMap = {};
    for (const row of rows || []) {
      questionMap[row.id] = row;
    }

    let correctCount = 0;
    const details = questionIds.map((questionId, index) => {
      const question = questionMap[questionId];
      if (!question) throw new Error(`Question not found: ${questionId}`);

      const chosenIndex = answers[index];
      const isCorrect = chosenIndex !== null && chosenIndex === question.correct_index;
      if (isCorrect) correctCount += 1;

      const options = [question.option_a, question.option_b, question.option_c, question.option_d];

      return {
        id: questionId,
        is_correct: isCorrect,
        chosen_index: chosenIndex,
        correct_index: question.correct_index,
        correct_option: options[question.correct_index],
        explanation: question.explanation,
        act_reference: question.act_reference,
        case_reference: question.case_reference,
      };
    });

    const totalQuestions = questionIds.length;
    const rawScore = totalQuestions ? correctCount / totalQuestions : 0;
    const passed = rawScore >= PASS_THRESHOLD;

    const submittedAt = new Date().toISOString();
    const insertError = await insertQuizAttempt(sb, {
      user_id: userId,
      level: effectiveLevel,
      month_key: effectiveMonthKey,
      score: parseFloat(rawScore.toFixed(4)),
      passed,
      correct_count: correctCount,
      total_questions: totalQuestions,
      duration_seconds: effectiveDurationSeconds,
      submitted_at: submittedAt,
    }, attemptDisplayName);

    if (insertError) {
      throw insertError;
    }

    if (!legacyMode) {
      const { error: sessionUpdateError } = await sb
        .from('quiz_attempt_sessions')
        .update({ submitted_at: new Date().toISOString() })
        .eq('id', sessionRow.id)
        .eq('user_id', userId);

      if (sessionUpdateError) throw sessionUpdateError;
    }

    if (passed && effectiveLevel < 20 && Number(profile.current_level || 1) === effectiveLevel) {
      await sb
        .from('quiz_profiles')
        .update({ current_level: effectiveLevel + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    return res.status(200).json({
      correct_count: correctCount,
      total_questions: totalQuestions,
      raw_score: rawScore,
      passed,
      details,
    });
  } catch (err) {
    console.error('[quiz-submit] Error:', {
      message: err?.message,
      code: err?.code,
      status: err?.status,
      details: err?.details,
      hint: err?.hint,
    });
    return res.status(500).json({ error: 'Unable to submit your attempt right now.' });
  }
}
