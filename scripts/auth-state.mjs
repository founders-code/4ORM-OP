import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const AUTH_PATH = process.env.PLAYWRIGHT_STORAGE || resolve(ROOT, '.auth/4ormop.json');

function stop(reason) {
  console.error('STOP: ' + reason);
  console.error('Regenerate the signed-in session with:');
  console.error('  npx playwright codegen --save-storage=.auth/4ormop.json https://www.4ormop.com/control-room');
  process.exit(1);
}

export function requireStorageState() {
  if (!existsSync(AUTH_PATH)) {
    stop('signed-in Playwright session is missing at .auth/4ormop.json.');
  }
  let data;
  try {
    data = JSON.parse(readFileSync(AUTH_PATH, 'utf8'));
  } catch (e) {
    stop('.auth/4ormop.json is not valid JSON.');
  }
  const cookies = Array.isArray(data.cookies) ? data.cookies : [];
  const now = Date.now() / 1000;
  const session = cookies.filter((c) => /__client|__session|__clerk/i.test(c.name || ''));
  const hasClerk = cookies.some((c) => /clerk|4ormop/i.test(c.domain || '') && /__client|__session/i.test(c.name || ''));
  if (!hasClerk && !session.length) {
    stop('.auth/4ormop.json has no Clerk session cookies.');
  }
  const timed = session.filter((c) => typeof c.expires === 'number' && c.expires > 0);
  if (timed.length && timed.every((c) => c.expires < now)) {
    stop('.auth/4ormop.json cookies are expired.');
  }
  return data;
}
