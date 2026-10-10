import { randomBytes } from 'crypto';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { env } from '../lib/env.mjs';

const path = new URL('../lib/generated-secrets.mjs', import.meta.url);

function readBaked() {
  if (!existsSync(path)) return { ingestToken: '', cronSecret: '' };
  const text = readFileSync(path, 'utf8');
  const ingest = text.match(/ingestToken = "([^"]*)"/);
  const cron = text.match(/cronSecret = "([^"]*)"/);
  return { ingestToken: ingest?.[1] || '', cronSecret: cron?.[1] || '' };
}

const baked = readBaked();
const ingestToken = env('INGEST_TOKEN') || baked.ingestToken || randomBytes(32).toString('base64url');
const cronSecret = env('CRON_SECRET') || baked.cronSecret || randomBytes(32).toString('base64url');

const body = process.env.INGEST_TOKEN && process.env.CRON_SECRET
  ? 'export const ingestToken = "";\nexport const cronSecret = "";\n'
  : `export const ingestToken = ${JSON.stringify(ingestToken)};\nexport const cronSecret = ${JSON.stringify(cronSecret)};\n`;
writeFileSync(path, body);

async function publish(key, value) {
  if (process.env[key]) return;
  const token = process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN || '';
  const project = process.env.VERCEL_PROJECT_ID || '';
  if (!token || !project || !value) return;
  const url = new URL(`https://api.vercel.com/v10/projects/${project}/env`);
  if (process.env.VERCEL_ORG_ID) url.searchParams.set('teamId', process.env.VERCEL_ORG_ID);
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      key,
      value,
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    }),
  });
  if (!res.ok && res.status !== 409) console.error('secret_publish_failed');
}

await publish('INGEST_TOKEN', ingestToken);
await publish('CRON_SECRET', cronSecret);
