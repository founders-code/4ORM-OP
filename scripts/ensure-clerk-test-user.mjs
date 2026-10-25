import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, loadLocalEnv } from './load-local-env.mjs';

const TEST_EMAIL = 'opstest@4ormfinance.com';
const OLD_EXTERNAL_ID = 'clerk-test';
const ENV_PATH = resolve(ROOT, '.env.local');
const API = 'https://api.clerk.com/v1';

function failCreate(detail) {
  console.error('STOP: Clerk Backend API refused to create the test user.');
  console.error(detail);
  process.exit(1);
}

function upsertEnv(pairs) {
  let text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  if (text && !text.endsWith('\n')) text += '\n';
  for (const [key, value] of Object.entries(pairs)) {
    const line = key + '=' + value;
    const re = new RegExp('^' + key + '=.*$', 'm');
    if (re.test(text)) text = text.replace(re, line);
    else text += line + '\n';
    process.env[key] = value;
  }
  writeFileSync(ENV_PATH, text, { mode: 0o600 });
}

async function clerkApi(secret, path, opts = {}) {
  const res = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: {
      authorization: 'Bearer ' + secret,
      'content-type': 'application/json',
      'clerk-api-version': '2025-04-10',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}

function errorText(result) {
  const j = result.json || {};
  const errors = Array.isArray(j.errors) ? j.errors.map((e) => {
    return [e.code, e.message, e.long_message, e.meta && JSON.stringify(e.meta)].filter(Boolean).join(' — ');
  }).join(' | ') : '';
  return [
    'HTTP ' + result.status,
    j.message || '',
    errors,
    !errors && result.text ? result.text.slice(0, 800) : '',
  ].filter(Boolean).join(' | ');
}

function firstUser(result) {
  if (result.ok && Array.isArray(result.json) && result.json[0]) return result.json[0];
  if (result.ok && result.json && Array.isArray(result.json.data) && result.json.data[0]) return result.json.data[0];
  return null;
}

async function findByExternalId(secret, externalId) {
  return firstUser(await clerkApi(secret, '/users?external_id=' + encodeURIComponent(externalId) + '&limit=5'));
}

async function findByEmail(secret, email) {
  return firstUser(await clerkApi(secret, '/users?email_address=' + encodeURIComponent(email) + '&limit=5'));
}

async function deleteUser(secret, user) {
  if (!user || !user.id) return;
  const del = await clerkApi(secret, '/users/' + user.id, { method: 'DELETE' });
  if (!del.ok && del.status !== 404) failCreate('delete user ' + user.id + ' failed: ' + errorText(del));
  console.log('deleted identifier-free user ' + user.id);
}

async function main() {
  loadLocalEnv();
  const secret = process.env.CLERK_SECRET_KEY || '';
  const publishable = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  if (!secret) {
    failCreate('CLERK_SECRET_KEY is missing from .env.local. Backend API was not called.');
  }
  if (!publishable) {
    failCreate('CLERK_PUBLISHABLE_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing from .env.local.');
  }

  const orphan = await findByExternalId(secret, OLD_EXTERNAL_ID);
  if (orphan && orphan.id) await deleteUser(secret, orphan);

  upsertEnv({
    CLERK_PUBLISHABLE_KEY: publishable,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || publishable,
    CLERK_TEST_IDENTIFIER: TEST_EMAIL,
  });

  const existing = await findByEmail(secret, TEST_EMAIL);
  if (existing && existing.id) {
    const updated = await clerkApi(secret, '/users/' + existing.id, {
      method: 'PATCH',
      body: {
        first_name: existing.first_name || 'Ops',
        last_name: existing.last_name || 'Test',
        skip_password_requirement: true,
        public_metadata: { ...(existing.public_metadata || {}), test: true },
      },
    });
    if (!updated.ok) failCreate(errorText(updated));
    upsertEnv({ CLERK_TEST_USER_ID: existing.id });
    console.log('test user ready (existing) ' + TEST_EMAIL);
    return;
  }

  const created = await clerkApi(secret, '/users', {
    method: 'POST',
    body: {
      email_address: [TEST_EMAIL],
      skip_password_requirement: true,
      first_name: 'Ops',
      last_name: 'Test',
      public_metadata: { test: true },
    },
  });
  if (!created.ok) failCreate(errorText(created));
  const user = created.json || {};
  if (!user.id) failCreate('createUser returned no id. ' + errorText(created));
  upsertEnv({ CLERK_TEST_USER_ID: user.id });
  console.log('test user ready (created) ' + TEST_EMAIL);
}

main().catch((err) => {
  failCreate(err && err.stack ? err.stack : String(err));
});
