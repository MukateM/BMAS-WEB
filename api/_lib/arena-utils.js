import crypto from 'node:crypto';

import { getQuizAdminClient } from './quiz-env.js';

const RATE_LIMIT_BUCKETS = new Map();

export const ARENA_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  PAUSED: 'paused',
  CLOSED: 'closed',
};

export function getArenaAdminClient() {
  return getQuizAdminClient();
}

export function json(res, status, payload) {
  return res.status(status).json(payload);
}

export function readJsonBody(req) {
  if (!req?.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return {};
    }
  }
  return req.body;
}

export function normalizeDisplayName(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function generateJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

export function assertRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const bucket = RATE_LIMIT_BUCKETS.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    RATE_LIMIT_BUCKETS.set(key, { count: 1, expiresAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: bucket.expiresAt - now };
  }
  bucket.count += 1;
  RATE_LIMIT_BUCKETS.set(key, bucket);
  return { ok: true };
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function getParticipantSecret() {
  return process.env.ARENA_PARTICIPANT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

export function createParticipantToken({ roomId, participantId, ttlSeconds = 60 * 60 * 8 }) {
  const secret = getParticipantSecret();
  if (!secret) {
    throw new Error('Arena participant secret is not configured.');
  }

  const payload = {
    roomId,
    participantId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyParticipantToken(token) {
  const secret = getParticipantSecret();
  if (!secret) return null;

  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  const expected = signPayload(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (_error) {
    return null;
  }
  if (!payload?.roomId || !payload?.participantId || !payload?.exp) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function getRoomWithQuestions(sb, roomId) {
  const { data: room, error: roomError } = await sb
    .from('arena_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (roomError) throw roomError;
  if (!room) return null;

  const { data: questions, error: questionsError } = await sb
    .from('arena_room_questions')
    .select('id, position, prompt, option_a, option_b, option_c, option_d, correct_index, time_limit_seconds, weight')
    .eq('room_id', roomId)
    .order('position', { ascending: true });
  if (questionsError) throw questionsError;

  return { room, questions: questions || [] };
}
