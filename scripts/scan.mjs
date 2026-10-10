import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const apiFiles = walk('app/api').filter((path) => path.endsWith('.ts'));
const consoleHits = apiFiles.filter((path) => {
  const text = readFileSync(path, 'utf8');
  if (path.endsWith('connect/google/callback/route.ts')) return /console\.(?!error\b)/.test(text);
  return /console\./.test(text);
});
if (consoleHits.length) {
  console.error('console in api');
  process.exit(1);
}

const star = apiFiles.filter((path) => /select \*/i.test(readFileSync(path, 'utf8')));
if (star.length) {
  console.error('select star');
  process.exit(1);
}

const page = readFileSync('public/control-room.html', 'utf8');
if (/\/api\/(ingest|mcp|cron)/.test(page) || /INGEST_TOKEN|CRON_SECRET|GOOGLE_|GHL_|DATABASE_URL|refresh_token|client_secret/.test(page)) {
  console.error('secret or internal route in the page');
  process.exit(1);
}
if (/Atherton|example\.com|Sample data/.test(page)) {
  console.error('sample deck still in the page');
  process.exit(1);
}
