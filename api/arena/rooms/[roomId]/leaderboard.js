import { getArenaAdminClient, json } from '../../../_lib/arena-utils.js';

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
    const { data, error } = await sb.rpc('arena_room_leaderboard', {
      target_room_id: roomId,
    });
    if (error) throw error;
    return json(res, 200, { leaderboard: data || [] });
  } catch (error) {
    console.error('[arena/leaderboard] Error:', error);
    return json(res, 500, { error: 'Unable to load leaderboard.' });
  }
}
