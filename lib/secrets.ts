import { env } from './env.mjs';
import { cronSecret as bakedCron, ingestToken as bakedIngest } from './generated-secrets.mjs';

/** Env wins. A deploy with neither set uses the value generated at build, still server-side. */
export function ingestToken() {
  return env('INGEST_TOKEN') || bakedIngest || '';
}

export function cronSecret() {
  return env('CRON_SECRET') || bakedCron || '';
}
