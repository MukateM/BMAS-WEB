const RATE_LIMIT_BUCKETS = new Map();

export function getClientIp(req) {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req?.socket?.remoteAddress || 'unknown';
}

export function assertSimpleRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const existing = RATE_LIMIT_BUCKETS.get(key);

  if (!existing || existing.expiresAt <= now) {
    RATE_LIMIT_BUCKETS.set(key, { count: 1, expiresAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.expiresAt - now };
  }

  existing.count += 1;
  RATE_LIMIT_BUCKETS.set(key, existing);
  return { ok: true };
}
