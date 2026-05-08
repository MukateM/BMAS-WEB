import { getArenaAdminClient, getRoomWithQuestions, json } from '../../../_lib/arena-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const { roomId } = req.query;
  const { client: sb } = getArenaAdminClient();
  if (!sb) {
    return json(res, 503, { error: 'Arena backend is not configured yet.' });
  }

  try {
    const roomBundle = await getRoomWithQuestions(sb, roomId);
    if (!roomBundle) {
      return json(res, 404, { error: 'Room not found.' });
    }

    const { room, questions } = roomBundle;
    const activeQuestion = questions[Number(room.current_question_index || 0)] || null;

    return json(res, 200, {
      room: {
        id: room.id,
        title: room.title,
        status: room.status,
        currentQuestionIndex: room.current_question_index || 0,
      },
      activeQuestion: activeQuestion
        ? {
            id: activeQuestion.id,
            position: activeQuestion.position,
            prompt: activeQuestion.prompt,
            options: [activeQuestion.option_a, activeQuestion.option_b, activeQuestion.option_c, activeQuestion.option_d],
            timeLimitSeconds: activeQuestion.time_limit_seconds,
            weight: activeQuestion.weight,
          }
        : null,
      totalQuestions: questions.length,
    });
  } catch (error) {
    console.error('[arena/public] Error:', error);
    return json(res, 500, { error: 'Unable to load room state.' });
  }
}
