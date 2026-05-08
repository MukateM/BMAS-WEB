import { requireArenaHost, requireRoomOwner } from '../../../_lib/arena-auth.js';
import { getRoomWithQuestions, json } from '../../../_lib/arena-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const auth = await requireArenaHost(req, res);
  if (!auth) return;

  const { roomId } = req.query;
  const { client: sb, user } = auth;

  try {
    const ownership = await requireRoomOwner({ sb, roomId, hostId: user.id });
    if (!ownership.ok) {
      return json(res, ownership.status, { error: ownership.error });
    }

    const roomBundle = await getRoomWithQuestions(sb, roomId);
    const { data: participants, error: participantsError } = await sb
      .from('arena_room_participants')
      .select('id, display_name, organization, joined_at')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    if (participantsError) throw participantsError;

    return json(res, 200, {
      room: roomBundle.room,
      questions: roomBundle.questions,
      participants: participants || [],
    });
  } catch (error) {
    console.error('[arena/dashboard] Error:', error);
    return json(res, 500, { error: 'Unable to load room dashboard.' });
  }
}
