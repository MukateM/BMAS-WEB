import { requireArenaHost } from '../_lib/arena-auth.js';
import { ARENA_STATUS, generateJoinCode, json, readJsonBody } from '../_lib/arena-utils.js';

async function createRoom(sb, hostUserId, body) {
  const title = String(body.title || '').trim();
  if (!title) {
    return { status: 400, payload: { error: 'title is required.' } };
  }

  let joinCode = '';
  let created = null;
  let createError = null;
  for (let i = 0; i < 5; i += 1) {
    joinCode = generateJoinCode();
    const result = await sb
      .from('arena_rooms')
      .insert({
        host_user_id: hostUserId,
        title,
        join_code: joinCode,
        status: ARENA_STATUS.SCHEDULED,
      })
      .select('*')
      .single();
    created = result.data;
    createError = result.error;
    if (!createError) break;
    if (!String(createError.message || '').toLowerCase().includes('join_code')) break;
  }

  if (createError) {
    return { status: 500, payload: { error: 'Unable to create room.' } };
  }

  return { status: 201, payload: { room: created } };
}

export default async function handler(req, res) {
  const auth = await requireArenaHost(req, res);
  if (!auth) return;

  const { client: sb, user } = auth;

  try {
    if (req.method === 'POST') {
      const body = readJsonBody(req);
      const result = await createRoom(sb, user.id, body);
      return json(res, result.status, result.payload);
    }

    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('arena_rooms')
        .select('*')
        .eq('host_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return json(res, 200, { rooms: data || [] });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('[arena/rooms] Error:', error);
    return json(res, 500, { error: 'Failed to process room request.' });
  }
}
