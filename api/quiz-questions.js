/**
 * /api/quiz-questions
 * POST { level: number }
 *
 * Returns a seeded selection of questions for the requested level plus a
 * server-issued attempt session id required for submission.
 */

import { getAuthenticatedQuizUser } from './_lib/quiz-env.js';
import { reconcileQuizProfileLevel } from './_lib/quiz-progress.js';
import { assertSimpleRateLimit, getClientIp } from './_lib/request-security.js';
import { quizLevels } from '../assets/employment-law-quiz-data.js';
import { randomUUID } from 'node:crypto';

const QUESTIONS_PER_ATTEMPT = 12;
const DEFAULT_SESSION_WINDOW_MS = 30 * 60 * 1000;
const TIMED_SESSION_WINDOW_MS = 5 * 60 * 1000;

function monthKey(value = new Date()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
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

function isTimedLevel(level) {
  return Boolean(quizLevels.find((item) => item.level === level)?.timed);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limiter = assertSimpleRateLimit({
    key: `quiz-questions:${getClientIp(req)}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!limiter.ok) {
    return res.status(429).json({ error: 'Too many level starts. Please slow down and try again shortly.' });
  }

  const auth = await getAuthenticatedQuizUser(req);
  const { client: sb, env, user } = auth;

  if (!sb) {
    console.error('[quiz-questions] Missing env vars:', {
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

  const { level } = req.body || {};
  const userId = user.id;
  const monthKeyValue = monthKey();

  if (!level) {
    return res.status(400).json({ error: 'Missing required field: level' });
  }

  if (typeof level !== 'number' || level < 1 || level > 20) {
    return res.status(400).json({ error: 'Invalid level' });
  }

  try {
    let { data: profile, error: profileError } = await sb
      .from('quiz_profiles')
      .select('current_level')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[quiz-questions] Profile query error:', profileError);
      throw profileError;
    }

    if (!profile) {
      return res.status(404).json({ error: 'Quiz profile not found.' });
    }

    profile = await reconcileQuizProfileLevel(sb, userId, profile);

    if (level > Number(profile.current_level || 1)) {
      return res.status(403).json({ error: 'This level is still locked.' });
    }

    const { data: rows, error: questionsError } = await sb
      .from('quiz_questions')
      .select('id, level, scenario, question, option_a, option_b, option_c, option_d')
      .eq('level', level)
      .eq('active', true);

    if (questionsError) {
      console.error('[quiz-questions] Questions query error:', questionsError);
      throw questionsError;
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No questions found for this level.' });
    }

    const { data: existingSessions, error: sessionLookupError } = await sb
      .from('quiz_attempt_sessions')
      .select('id, expires_at, question_ids')
      .eq('user_id', userId)
      .eq('level', level)
      .eq('month_key', monthKeyValue)
      .is('submitted_at', null)
      .order('issued_at', { ascending: false })
      .limit(1);

    if (sessionLookupError) {
      console.error('[quiz-questions] Session lookup error:', sessionLookupError);
      throw sessionLookupError;
    }

    const existingSession = existingSessions?.[0] || null;
    const sessionExpired = existingSession?.expires_at
      ? new Date(existingSession.expires_at).getTime() < Date.now()
      : false;
    const issuedAt = new Date().toISOString();
    const sessionWindowMs = isTimedLevel(level) ? TIMED_SESSION_WINDOW_MS : DEFAULT_SESSION_WINDOW_MS;
    const expiresAt = new Date(Date.now() + sessionWindowMs).toISOString();
    const attemptSessionId = existingSession && !sessionExpired ? existingSession.id : randomUUID();
    const questionsById = new Map(rows.map((question) => [question.id, question]));
    const existingQuestionIds = Array.isArray(existingSession?.question_ids) ? existingSession.question_ids : [];
    const canReuseExistingQuestions = Boolean(
      existingSession &&
      !sessionExpired &&
      existingQuestionIds.length > 0 &&
      existingQuestionIds.every((questionId) => questionsById.has(questionId)),
    );
    const selected = canReuseExistingQuestions
      ? existingQuestionIds.map((questionId) => questionsById.get(questionId))
      : seededShuffle(rows, `${userId}:${level}:${monthKeyValue}:${attemptSessionId}`)
        .slice(0, Math.min(QUESTIONS_PER_ATTEMPT, rows.length));
    const questionIds = selected.map((question) => question.id);

    if (!existingSession) {
      const { error: createSessionError } = await sb
        .from('quiz_attempt_sessions')
        .insert({
          id: attemptSessionId,
          user_id: userId,
          level,
          month_key: monthKeyValue,
          question_ids: questionIds,
          issued_at: issuedAt,
          expires_at: expiresAt,
        });

      if (createSessionError) {
        console.error('[quiz-questions] Session create error:', createSessionError);
        throw createSessionError;
      }
    } else if (sessionExpired) {
      const { error: updateSessionError } = await sb
        .from('quiz_attempt_sessions')
        .update({
          id: attemptSessionId,
          question_ids: questionIds,
          issued_at: issuedAt,
          expires_at: expiresAt,
          submitted_at: null,
        })
        .eq('id', existingSession.id);

      if (updateSessionError) {
        console.error('[quiz-questions] Session update error:', updateSessionError);
        throw updateSessionError;
      }
    }

    const questions = selected.map((question) => ({
      id: question.id,
      level: question.level,
      scenario: question.scenario,
      question: question.question,
      options: [question.option_a, question.option_b, question.option_c, question.option_d],
    }));

    return res.status(200).json({
      questions,
      attemptSessionId,
      expiresAt: sessionExpired || !existingSession ? expiresAt : existingSession.expires_at,
      monthKey: monthKeyValue,
    });
  } catch (err) {
    console.error('[quiz-questions] Error:', {
      message: err?.message,
      code: err?.code,
      status: err?.status,
      details: err?.details,
      hint: err?.hint,
    });
    return res.status(500).json({ error: 'Unable to load questions right now.' });
  }
}
