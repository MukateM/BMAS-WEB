import { getAuthenticatedQuizUser } from './quiz-env.js';
import { json } from './arena-utils.js';

export async function requireArenaHost(req, res) {
  const auth = await getAuthenticatedQuizUser(req);
  if (!auth.client) {
    json(res, 503, { error: 'Arena backend is not configured yet.' });
    return null;
  }
  if (auth.error || !auth.user) {
    json(res, auth.status || 401, { error: auth.error || 'Authentication required.' });
    return null;
  }
  return auth;
}

export async function requireRoomOwner({ sb, roomId, hostId }) {
  const { data: room, error } = await sb
    .from('arena_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  if (!room) {
    return { ok: false, status: 404, error: 'Room not found.' };
  }
  if (room.host_user_id !== hostId) {
    return { ok: false, status: 403, error: 'You do not own this room.' };
  }
  return { ok: true, room };
}
