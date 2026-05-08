import {
  ARENA_STATUS,
  assertRateLimit,
  createParticipantToken,
  getArenaAdminClient,
  json,
  normalizeDisplayName,
  readJsonBody,
} from '../_lib/arena-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const limiter = assertRateLimit({
    key: `arena:join:${req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'}`,
    limit: 25,
    windowMs: 60 * 1000,
  });
  if (!limiter.ok) {
    return json(res, 429, { error: 'Too many join requests. Please retry shortly.' });
  }

  const body = readJsonBody(req);
  const joinCode = String(body.joinCode || '').trim().toUpperCase();
  const displayName = String(body.displayName || '').trim();
  const organization = String(body.organization || '').trim();
  const normalizedName = normalizeDisplayName(displayName);

  if (!joinCode || !displayName || !organization) {
    return json(res, 400, { error: 'joinCode, displayName and organization are required.' });
  }
  if (!/^[A-Z2-9]{6}$/.test(joinCode)) {
    return json(res, 400, { error: 'Join code must be 6 letters or numbers.' });
  }
  if (displayName.length < 2 || displayName.length > 80) {
    return json(res, 400, { error: 'Display name must be between 2 and 80 characters.' });
  }
  if (organization.length < 2 || organization.length > 120) {
    return json(res, 400, { error: 'Organization must be between 2 and 120 characters.' });
  }

  const { client: sb } = getArenaAdminClient();
  if (!sb) {
    return json(res, 503, { error: 'Arena backend is not configured yet.' });
  }

  try {
    const { data: room, error: roomError } = await sb
      .from('arena_rooms')
      .select('id, title, status, current_question_index')
      .eq('join_code', joinCode)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) return json(res, 404, { error: 'Invalid join code.' });
    if (![ARENA_STATUS.SCHEDULED, ARENA_STATUS.LIVE, ARENA_STATUS.PAUSED].includes(room.status)) {
      return json(res, 409, { error: 'This room is closed.' });
    }

    const { data: existing, error: existingError } = await sb
      .from('arena_room_participants')
      .select('id, display_name, organization')
      .eq('room_id', room.id)
      .eq('normalized_display_name', normalizedName)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return json(res, 409, { error: 'That display name is already in use in this room.' });
    }

    const { data: participant, error: participantError } = await sb
      .from('arena_room_participants')
      .insert({
        room_id: room.id,
        display_name: displayName,
        normalized_display_name: normalizedName,
        organization,
      })
      .select('id, display_name, organization')
      .single();
    if (participantError) throw participantError;

    let participantToken = '';
    try {
      participantToken = createParticipantToken({
        roomId: room.id,
        participantId: participant.id,
      });
    } catch (tokenError) {
      console.error('[arena/join] Token creation failed:', tokenError?.message || tokenError);
      return json(res, 503, { error: 'Arena participant sessions are not configured yet.' });
    }

    return json(res, 200, {
      room: {
        id: room.id,
        title: room.title,
        status: room.status,
        currentQuestionIndex: room.current_question_index || 0,
      },
      participant,
      participantToken,
    });
  } catch (error) {
    console.error('[arena/join] Error:', error);
    return json(res, 500, { error: 'Unable to join room right now.' });
  }
}
