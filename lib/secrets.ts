import { env } from './env.mjs';
import { cronSecret as bakedCron, ingestToken as bakedIngest } from './generated-secrets.mjs';

/** Env wins. A deploy with neither set uses the value generated at build, still server-side. */
export function ingestToken() {
  return env('INGEST_TOKEN') || bakedIngest || '';
}

/** Shared secret for the scheduled news sweep (x-news-key). No baked fallback: unset means header posts are refused. */
export function newsKey() {
  return env('NEWS_INGEST_KEY');
}

/** Shared secret for the morning CEO ranking (x-ceo-key). Unset means header posts are refused. */
export function ceoKey() {
  return env('CEO_INGEST_KEY');
}

export function cronSecret() {
  return env('CRON_SECRET') || bakedCron || '';
}
