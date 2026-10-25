import { createClerkClient } from '@clerk/backend';
import { clerkSetup } from '@clerk/testing/playwright';
import { loadLocalEnv } from './load-local-env.mjs';

export const TEST_EMAIL = 'opstest@4ormfinance.com';
export const TEST_EXTERNAL_ID = 'clerk-test';
export const TEST_NAME = 'Ops Test';
export const LIVE_ORIGIN = (process.env.PLAYWRIGHT_BASE_URL || 'https://www.4ormop.com').replace(/\/$/, '');

const API = 'https://api.clerk.com/v1';

let setupOnce = null;

function clerkErrorText(err) {
  if (!err) return '(empty Clerk error)';
  const errors = Array.isArray(err.errors) ? err.errors.map((e) => {
    return [e.code, e.message, e.longMessage || e.long_message, e.meta && JSON.stringify(e.meta)].filter(Boolean).join(' — ');
  }).join(' | ') : '';
  const parts = [
    err.message,
    err.longMessage || err.long_message,
    errors,
    err.status && ('HTTP ' + err.status),
    err.clerkError && 'clerkError',
  ].filter(Boolean);
  return parts.join(' | ') || String(err);
}

function stopSignIn(err) {
  const text = clerkErrorText(err);
  console.error('STOP: Clerk ticket sign-in failed.');
  console.error(text);
  const wrapped = new Error(text);
  wrapped.cause = err;
  throw wrapped;
}

export async function setupClerkTesting() {
  loadLocalEnv();
  if (setupOnce) return setupOnce;
  setupOnce = (async () => {
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
    const secretKey = process.env.CLERK_SECRET_KEY || '';
    if (!publishableKey || !secretKey) {
      throw new Error('STOP: CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must be set in .env.local');
    }
    await clerkSetup({ publishableKey, secretKey, dotenv: false });
  })();
  return setupOnce;
}

async function findTestUserId(secret) {
  if (process.env.CLERK_TEST_USER_ID) return process.env.CLERK_TEST_USER_ID;
  const email = process.env.CLERK_TEST_IDENTIFIER || TEST_EMAIL;
  const res = await fetch(API + '/users?email_address=' + encodeURIComponent(email) + '&limit=5', {
    headers: { authorization: 'Bearer ' + secret, 'clerk-api-version': '2025-04-10' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) stopSignIn({ status: res.status, message: 'users.list failed', errors: json && json.errors, ...json });
  const row = Array.isArray(json) ? json[0] : json && Array.isArray(json.data) ? json.data[0] : null;
  if (!row || !row.id) stopSignIn({ message: 'test user not found: ' + email });
  return row.id;
}

async function createTicket(secret, userId) {
  try {
    const client = createClerkClient({ secretKey: secret });
    const token = await client.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 300,
    });
    if (!token || !token.token) stopSignIn({ message: 'createSignInToken returned no token' });
    return token.token;
  } catch (err) {
    stopSignIn(err);
  }
}

export async function signInAsTestUser(page, origin = LIVE_ORIGIN) {
  await setupClerkTesting();
  const secret = process.env.CLERK_SECRET_KEY || '';
  const userId = await findTestUserId(secret);
  const ticket = await createTicket(secret, userId);

  await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => !!window.Clerk, { timeout: 20000 });
  try {
    await page.evaluate(async (token) => {
      await window.Clerk.load();
      const r = await window.Clerk.client.signIn.create({ strategy: 'ticket', ticket: token });
      if (!r.createdSessionId) {
        const err = new Error('ticket sign-in did not create a session. status=' + r.status);
        err.status = r.status;
        throw err;
      }
      await window.Clerk.setActive({ session: r.createdSessionId });
    }, ticket);
  } catch (err) {
    stopSignIn(err);
  }

  await page.goto(origin + '/war-room', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#warDesk', { timeout: 20000, state: 'attached' });
  await page.waitForFunction(() => {
    const clerkObj = window.Clerk || window.__clerk;
    const user = clerkObj && clerkObj.user;
    if (!user) return false;
    const email = (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) ||
      (Array.isArray(user.emailAddresses) && user.emailAddresses[0] && (user.emailAddresses[0].emailAddress || user.emailAddresses[0].email_address)) ||
      '';
    return !!(user.fullName || user.firstName || user.lastName || email);
  }, { timeout: 20000 }).catch(() => {});
  const who = await page.evaluate(() => {
    const clerkObj = window.Clerk || window.__clerk;
    const user = clerkObj && clerkObj.user;
    const email = user && (
      (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) ||
      (Array.isArray(user.emailAddresses) && user.emailAddresses[0] && (user.emailAddresses[0].emailAddress || user.emailAddresses[0].email_address)) ||
      ''
    );
    return {
      path: location.pathname,
      name: (user && (user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.firstName || email)) || '',
      email: email || '',
    };
  });
  if (!/\/war-room/.test(who.path) || !who.name) {
    stopSignIn({ message: 'test sign-in did not open /war-room with the user name. path=' + who.path + ' name=' + (who.name || '(empty)') });
  }
  if (!/ops\s+test/i.test(who.name)) {
    stopSignIn({ message: 'signed in as ' + who.name + ' but expected ' + TEST_NAME });
  }
  const expectedEmail = process.env.CLERK_TEST_IDENTIFIER || TEST_EMAIL;
  if (who.email && who.email !== expectedEmail) {
    stopSignIn({ message: 'signed in as ' + who.email + ' but expected ' + expectedEmail });
  }
  console.log('signed in ' + who.name + ' <' + who.email + '> at ' + who.path);
  return who;
}

export const signInTestUser = signInAsTestUser;
