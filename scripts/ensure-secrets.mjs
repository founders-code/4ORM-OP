import { randomBytes } from 'crypto';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { env } from '../lib/env.mjs';

/**
 * Writes lib/generated-secrets.mjs before `next build`. Never fails the build and makes no network calls.
 *
 * - CRON_SECRET is never invented here: Vercel Cron only sends `Authorization: Bearer $CRON_SECRET`
 *   when that env var is set in the Vercel project, so a value baked at build would never match.
 *   If it is missing we warn, and every cron and hook that depends on it answers 401 (fail closed).
 * - INGEST_TOKEN falls back to a per-build value so the brief cron's self-call to /api/ingest
 *   still works inside one deployment. External callers need INGEST_TOKEN set in Vercel.
 */
const path = new URL('../lib/generated-secrets.mjs', import.meta.url);

function readBakedIngest() {
  try {
    if (!existsSync(path)) return '';
    const match = readFileSync(path, 'utf8').match(/ingestToken = "([^"]*)"/);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

if (!env('CRON_SECRET')) {
  console.warn('[ensure-secrets] CRON_SECRET is not set. Set it in Vercel; cron routes will answer 401 until then.');
}
if (!env('INGEST_TOKEN')) {
  console.warn('[ensure-secrets] INGEST_TOKEN is not set. Using a per-build token; external ingest callers will be refused.');
}

const ingestToken = env('INGEST_TOKEN') ? '' : readBakedIngest() || randomBytes(32).toString('base64url');

try {
  writeFileSync(path, `export const ingestToken = ${JSON.stringify(ingestToken)};\n`);
} catch (err) {
  console.warn('[ensure-secrets] could not write lib/generated-secrets.mjs:', err?.message || err);
}
