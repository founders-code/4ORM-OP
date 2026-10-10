import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const MAX_AGE_MS = 10 * 60 * 1000;

export function signState(userId, secret, now = Date.now()) {
  if (!userId || !secret) return '';
  const nonce = randomBytes(16).toString('base64url');
  const body = `${userId}.${nonce}.${now}`;
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function readState(state, secret, now = Date.now()) {
  if (!state || !secret || typeof state !== 'string') return null;
  const parts = state.split('.');
  if (parts.length !== 4) return null;
  const [userId, nonce, stamp, mac] = parts;
  if (!userId || !nonce || !stamp || !mac) return null;
  if (!/^[\w-]+$/.test(userId)) return null;
  const expected = createHmac('sha256', secret).update(`${userId}.${nonce}.${stamp}`).digest('base64url');
  const left = createHash('sha256').update(mac).digest();
  const right = createHash('sha256').update(expected).digest();
  if (!timingSafeEqual(left, right)) return null;
  const issued = Number(stamp);
  if (!Number.isFinite(issued) || issued > now + 60_000 || now - issued > MAX_AGE_MS) return null;
  return userId;
}
