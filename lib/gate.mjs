// Pure request-gating rules shared by middleware.ts and scripts/secure.test.mjs.
// No Clerk, no Node APIs: this file runs in the Edge runtime.

export const ROOM_EMAIL = 'chad@4ormfinance.com';

/**
 * API routes that never need a Clerk session. Each one carries its own check:
 * - book: public booking form, rate limited per IP;
 * - clerk-publishable-key: the publishable key is public by design;
 * - hooks/*: webhook token or signature, fails closed;
 * - cron/*: Authorization: Bearer $CRON_SECRET, fails closed;
 * - news/sweep: Vercel Cron bearer (vercel.json calls it directly), news key, or an allowlisted session;
 * - ingest, mcp: x-ingest-token;
 * - news/image/:id, news/thumb/:id: public story images (uuid only, no user data);
 * - bw/unsub: one-click unsubscribe from Bruce's group email, HMAC-signed per contact.
 */
const PUBLIC_API = [
  /^\/api\/book\/?$/,
  /^\/api\/clerk-publishable-key\/?$/,
  /^\/api\/hooks\/[^/]+\/?$/,
  /^\/api\/cron\/[^/]+\/?$/,
  /^\/api\/news\/sweep\/?$/,
  /^\/api\/ingest\/?$/,
  /^\/api\/mcp\/?$/,
  /^\/api\/news\/(image|thumb)\/[^/]+\/?$/,
  /^\/api\/bw\/unsub\/?$/,
];

/**
 * Routes that accept a machine credential instead of a session. The middleware lets the request
 * through only when that header is present; the route itself verifies it in constant time.
 */
const TOKEN_OR_SESSION = [
  { re: /^\/api\/news\/ingest\/?$/, headers: ['x-news-key', 'x-ingest-token'] },
  { re: /^\/api\/ceo\/daily\/?$/, headers: ['x-ceo-key'] },
  { re: /^\/api\/ops\/dedupe\/?$/, headers: ['authorization'] },
];

export function isApiPath(pathname) {
  return /^\/(api|trpc)(\/|$)/.test(String(pathname || ''));
}

export function isPublicApi(pathname) {
  const p = String(pathname || '');
  return PUBLIC_API.some((re) => re.test(p));
}

/** True when this API path takes a machine credential and the request carries that header. */
export function hasMachineCredential(pathname, getHeader) {
  const p = String(pathname || '');
  const hit = TOKEN_OR_SESSION.find((r) => r.re.test(p));
  if (!hit) return false;
  return hit.headers.some((h) => String(getHeader(h) || '').trim() !== '');
}

/** What the middleware does with an API request: 'pass' (route checks itself) or 'session' (must be signed in). */
export function apiDecision(pathname, getHeader) {
  if (isPublicApi(pathname)) return 'pass';
  if (hasMachineCredential(pathname, getHeader)) return 'pass';
  return 'session';
}

/** Production without Clerk keys must refuse gated pages and private APIs (fail closed). */
export function clerkMissingDecision({ production, isApi, isPublicApiPath, isGatedPage }) {
  if (!production) return 'next';
  if (isApi) return isPublicApiPath ? 'next' : 'unavailable';
  if (isGatedPage) return 'unavailable';
  return 'next';
}

function lc(v) {
  return String(v || '').trim().toLowerCase();
}

/**
 * Who may open the control room pages: Chad's email, or a Clerk test user (publicMetadata.test === true,
 * strict boolean). Reads the session claims; returns null when the claims do not carry enough to decide
 * (the middleware then looks the user up once and caches the answer).
 */
export function roomAccessFromClaims(claims) {
  const c = claims && typeof claims === 'object' ? claims : {};
  const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : null;
  const pub = c.publicMetadata && typeof c.publicMetadata === 'object' ? c.publicMetadata : null;
  if (meta?.test === true || pub?.test === true) return true;
  const emails = [c.email, c.primaryEmail, c.primary_email, c.email_address, meta?.email, pub?.email].map(lc).filter(Boolean);
  if (emails.includes(ROOM_EMAIL)) return true;
  // A non-Chad email is a definite "no" only when the claims also carry the metadata (so test is known).
  if (emails.length && (meta || pub)) return false;
  return null;
}

/** Same rule for a full Clerk user record. Anything missing or malformed is refused. */
export function roomAccessFromUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (user.publicMetadata && user.publicMetadata.test === true) return true;
  const primaryId = user.primaryEmailAddressId;
  const list = Array.isArray(user.emailAddresses) ? user.emailAddresses : [];
  const primary = list.find((e) => e && e.id === primaryId) || user.primaryEmailAddress || null;
  return lc(primary && primary.emailAddress) === ROOM_EMAIL;
}
