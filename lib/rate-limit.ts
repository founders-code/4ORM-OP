import { createHash } from 'crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

/**
 * Fixed-window rate limit stored in Postgres (table rate_limits, created by the db.ts migration).
 * In-DB rather than in-memory because Vercel runs many short-lived instances that share no memory.
 * Keys are hashed so raw IPs are never stored. Returns true when the call is allowed.
 * The window is fixed (not sliding): a caller can make up to 2x `limit` calls across a window edge.
 */
export async function takeRateLimit(sql: Sql, bucket: string, key: string, limit: number, windowSeconds: number) {
  const id = createHash('sha256').update(`${bucket}:${key}`).digest('hex');
  const windowMs = windowSeconds * 1000;
  const start = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const rows = await sql`
    INSERT INTO rate_limits (key_hash, window_start, hits)
    VALUES (${id}, ${start}, 1)
    ON CONFLICT (key_hash, window_start)
    DO UPDATE SET hits = rate_limits.hits + 1
    WHERE rate_limits.hits < ${limit}
    RETURNING hits
  `;
  return rows.length > 0;
}

/** Client IP as Vercel reports it (it overwrites x-forwarded-for; the first entry is the caller). */
export function clientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
