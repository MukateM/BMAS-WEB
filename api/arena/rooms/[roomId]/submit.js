import {
  ARENA_STATUS,
  assertRateLimit,
  getArenaAdminClient,
  getRoomWithQuestions,
  json,
  readJsonBody,
  verifyParticipantToken,
} from '../../../_lib/arena-utils.js';

function computeScores({ isCorrect, responseMs, timeLimitSeconds, weight }) {
  const accuracyWeight = Number(weight || 100);
  const clampedLimitMs = Math.max(1000, Number(timeLimitSeconds || 20) * 1000);
  const clampedResponseMs = Math.max(0, Number(responseMs || clampedLimitMs));
  const speedRatio = Math.max(0, Math.min(1, (clampedLimitMs - clampedResponseMs) / clampedLimitMs));
  const accuracyScore = isCorrect ? accuracyWeight : 0;
  const speedScore = isCorrect ? Number((speedRatio * (accuracyWeight * 0.35)).toFixed(4)) : 0;
  const totalScore = Number((accuracyScore + speedScore).toFixed(4));
  return { accuracyScore, speedScore, totalScore };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const limiter = assertRateLimit({
    key: `arena:submit:${req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!limiter.ok) {
    return json(res, 429, { error: 'Too many submissions. Slow down.' });
  }

  const { roomId } = req.query;
  const body = readJsonBody(req);
  const token = String(body.participantToken || '');
  const selectedOption = Number(body.selectedOption);
  const responseMs = Number(body.responseMs || 0);

  const tokenPayload = verifyParticipantToken(token);
  if (!tokenPayload || tokenPayload.roomId !== roomId) {
    return json(res, 401, { error: 'Invalid participant session.' });
  }
  if (!Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption > 3) {
    return json(res, 400, { error: 'selectedOption must be between 0 and 3.' });
  }

  const { client: sb } = getArenaAdminClient();
  if (!sb) {
    return json(res, 503, { error: 'Arena backend is not configured yet.' });
  }

  try {
    const roomBundle = await getRoomWithQuestions(sb, roomId);
    if (!roomBundle) return json(res, 404, { error: 'Room not found.' });
    const { room, questions } = roomBundle;

    if (room.status !== ARENA_STATUS.LIVE) {
      return json(res, 409, { error: 'Room is not currently accepting answers.' });
    }

    const currentQuestion = questions[Number(room.current_question_index || 0)];
    if (!currentQuestion) {
      return json(res, 409, { error: 'No active question found for this room.' });
    }

    const { data: participant, error: participantError } = await sb
      .from('arena_room_participants')
      .select('id')
      .eq('id', tokenPayload.participantId)
      .eq('room_id', roomId)
      .maybeSingle();
    if (participantError) throw participantError;
    if (!participant) return json(res, 404, { error: 'Participant not found.' });

    const isCorrect = selectedOption === Number(currentQuestion.correct_index);
    const scores = computeScores({
      isCorrect,
      responseMs,
      timeLimitSeconds: currentQuestion.time_limit_seconds,
      weight: currentQuestion.weight,
    });

    const { error: insertError } = await sb.from('arena_question_submissions').insert({
      room_id: roomId,
      question_id: currentQuestion.id,
      participant_id: tokenPayload.participantId,
      selected_option: selectedOption,
      response_ms: Math.max(0, Math.round(responseMs)),
      is_correct: isCorrect,
      accuracy_score: scores.accuracyScore,
      speed_score: scores.speedScore,
      total_score: scores.totalScore,
    });

    if (insertError) {
      if (String(insertError.message || '').toLowerCase().includes('unique')) {
        return json(res, 409, { error: 'Answer already submitted for this question.' });
      }
      throw insertError;
    }

    return json(res, 200, {
      accepted: true,
      isCorrect,
      score: scores.totalScore,
    });
  } catch (error) {
    console.error('[arena/submit] Error:', error);
    return json(res, 500, { error: 'Unable to submit answer right now.' });
  }
}
