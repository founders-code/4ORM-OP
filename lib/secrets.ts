import { cronSecret as bakedCron, ingestToken as bakedIngest } from './generated-secrets.mjs';

/** Env wins. A deploy with neither set uses the value generated at build, still server-side. */
export function ingestToken() {
  return process.env.INGEST_TOKEN || bakedIngest || '';
}

export function cronSecret() {
  return process.env.CRON_SECRET || bakedCron || '';
}
