import { requireArenaHost, requireRoomOwner } from '../../../_lib/arena-auth.js';
import { json, readJsonBody } from '../../../_lib/arena-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const auth = await requireArenaHost(req, res);
  if (!auth) return;

  const { roomId } = req.query;
  const { client: sb, user } = auth;
  const body = readJsonBody(req);
  const questions = Array.isArray(body.questions) ? body.questions : [];

  if (!questions.length) {
    return json(res, 400, { error: 'questions must be a non-empty array.' });
  }

  try {
    const ownership = await requireRoomOwner({ sb, roomId, hostId: user.id });
    if (!ownership.ok) {
      return json(res, ownership.status, { error: ownership.error });
    }
    if (ownership.room.status !== 'scheduled') {
      return json(res, 409, { error: 'Questions can only be edited while room is scheduled.' });
    }

    const normalized = [];
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i] || {};
      const prompt = String(q.prompt || '').trim();
      const options = [q.optionA, q.optionB, q.optionC, q.optionD].map((item) => String(item || '').trim());
      const correctIndex = Number(q.correctIndex);
      const timeLimitSeconds = Math.max(5, Number(q.timeLimitSeconds || 20));
      const weight = Math.max(1, Number(q.weight || 100));
      if (!prompt || options.some((item) => !item) || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        return json(res, 400, { error: `Invalid question at position ${i + 1}.` });
      }
      normalized.push({
        room_id: roomId,
        position: i + 1,
        prompt,
        option_a: options[0],
        option_b: options[1],
        option_c: options[2],
        option_d: options[3],
        correct_index: correctIndex,
        time_limit_seconds: Math.round(timeLimitSeconds),
        weight,
      });
    }

    const { error: deleteError } = await sb.from('arena_room_questions').delete().eq('room_id', roomId);
    if (deleteError) throw deleteError;

    const { data, error: insertError } = await sb
      .from('arena_room_questions')
      .insert(normalized)
      .select('id, position, prompt, option_a, option_b, option_c, option_d, time_limit_seconds, weight')
      .order('position', { ascending: true });
    if (insertError) throw insertError;

    return json(res, 200, { questions: data || [] });
  } catch (error) {
    console.error('[arena/questions] Error:', error);
    return json(res, 500, { error: 'Unable to save room questions.' });
  }
}
