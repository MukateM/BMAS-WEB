import { requireArenaHost, requireRoomOwner } from '../../../_lib/arena-auth.js';
import { ARENA_STATUS, json, readJsonBody } from '../../../_lib/arena-utils.js';

function transitionRoom(room, action, questionCount) {
  const current = room.status;
  if (action === 'start') {
    if (current !== ARENA_STATUS.SCHEDULED) return { ok: false, error: 'Only scheduled rooms can be started.' };
    if (questionCount < 1) return { ok: false, error: 'Add at least one question before starting.' };
    return { ok: true, patch: { status: ARENA_STATUS.LIVE, current_question_index: 0, started_at: new Date().toISOString() } };
  }
  if (action === 'pause') {
    if (current !== ARENA_STATUS.LIVE) return { ok: false, error: 'Only live rooms can be paused.' };
    return { ok: true, patch: { status: ARENA_STATUS.PAUSED } };
  }
  if (action === 'resume') {
    if (current !== ARENA_STATUS.PAUSED) return { ok: false, error: 'Only paused rooms can be resumed.' };
    return { ok: true, patch: { status: ARENA_STATUS.LIVE } };
  }
  if (action === 'advance') {
    if (current !== ARENA_STATUS.LIVE) return { ok: false, error: 'Only live rooms can advance questions.' };
    const nextIndex = Number(room.current_question_index || 0) + 1;
    if (nextIndex >= questionCount) {
      return { ok: true, patch: { status: ARENA_STATUS.CLOSED, closed_at: new Date().toISOString() } };
    }
    return { ok: true, patch: { current_question_index: nextIndex } };
  }
  if (action === 'close') {
    if (current === ARENA_STATUS.CLOSED) return { ok: false, error: 'Room is already closed.' };
    return { ok: true, patch: { status: ARENA_STATUS.CLOSED, closed_at: new Date().toISOString() } };
  }
  return { ok: false, error: 'Unsupported action.' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const auth = await requireArenaHost(req, res);
  if (!auth) return;

  const { roomId } = req.query;
  const { action } = readJsonBody(req);
  const { client: sb, user } = auth;

  try {
    const ownership = await requireRoomOwner({ sb, roomId, hostId: user.id });
    if (!ownership.ok) {
      return json(res, ownership.status, { error: ownership.error });
    }

    const { count: questionCount, error: countError } = await sb
      .from('arena_room_questions')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);
    if (countError) throw countError;

    const transition = transitionRoom(ownership.room, String(action || ''), Number(questionCount || 0));
    if (!transition.ok) {
      return json(res, 409, { error: transition.error });
    }

    const { data, error } = await sb
      .from('arena_rooms')
      .update({
        ...transition.patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId)
      .eq('host_user_id', user.id)
      .select('*')
      .single();
    if (error) throw error;

    return json(res, 200, { room: data });
  } catch (error) {
    console.error('[arena/state] Error:', error);
    return json(res, 500, { error: 'Unable to update room state.' });
  }
}
