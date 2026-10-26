import type { NextRequest, NextFetchEvent } from 'next/server';
import { NextResponse } from 'next/server';
import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import {
  apiDecision,
  clerkMissingDecision,
  isApiPath,
  isPublicApi,
  roomAccessFromClaims,
  roomAccessFromUser,
} from './lib/gate.mjs';

// Gating needs both Clerk keys. In development the app still runs without them; in production a
// missing key FAILS CLOSED: gated pages and private APIs answer 503 instead of opening up.
const hasClerk =
  !!process.env.CLERK_SECRET_KEY &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isProduction = process.env.NODE_ENV === 'production';

// Each room requires its own role. Roles are ADDITIVE: one person can hold
// several. An advisor who becomes an employee has ['advisor','employee'] and
// gets both offices. Engineers typically have ['advisor','engineering'].
const ROOM_ROLE: Record<string, string> = {
  '/advisor.html': 'advisor',
  '/employee.html': 'employee',
  '/engineering.html': 'engineering',
};

const isRoom = createRouteMatcher([
  '/advisor.html',
  '/employee.html',
  '/engineering.html',
]);
const isDocuments = createRouteMatcher(['/documents/(.*)']);
const isDataRoom = createRouteMatcher(['/road-ahead.html','/path-to-revenue.html','/visual-data.html','/filing.html']);
// Chad's private space. Sign-in plus the room allowlist (Chad's email or a Clerk test user).
const isControlRoom = createRouteMatcher([
  '/control-room',
  '/control-room.html',
  '/playbook',
  '/calendar',
  '/news',
  '/email-board',
  '/war-room',
  '/space-detail',
  '/zoom',
  '/completed',
  '/notes',
  '/pipeline',
  '/spaces',
  '/documents',
  '/links',
  '/email',
  '/drive',
  '/contacts',
  '/financials',
  '/integrations',
]);
const isDesign = createRouteMatcher(['/design', '/design/(.*)']);
// Legal pages are public. Members read them before they sign in.
const isPublicPage = createRouteMatcher([
  '/terms-of-service',
  '/terms-of-service.html',
  '/privacy-policy',
  '/privacy-policy.html',
  '/book',
  '/book.html',
  '/chad',
]);

function isGatedPage(req: NextRequest) {
  return isRoom(req) || isDocuments(req) || isDataRoom(req) || isControlRoom(req) || isDesign(req);
}

// Room allowlist answers per user, cached briefly so a page load does not call Clerk every time.
// A failed lookup is not cached and is refused (fail closed).
const ACCESS_TTL = 5 * 60 * 1000;
const accessCache = new Map<string, { ok: boolean; at: number }>();

async function roomAllowed(userId: string, claims: unknown): Promise<boolean> {
  const fromClaims = roomAccessFromClaims(claims);
  if (fromClaims !== null) return fromClaims;
  const hit = accessCache.get(userId);
  if (hit && Date.now() - hit.at < ACCESS_TTL) return hit.ok;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const ok = roomAccessFromUser(user);
    if (accessCache.size > 500) accessCache.clear();
    accessCache.set(userId, { ok, at: Date.now() });
    return ok;
  } catch {
    return false;
  }
}

const gated = clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;

  // Central API gate: every private API needs a signed-in session. Each route still runs its own
  // sessionOwner() allowlist check; public and token-authenticated routes check themselves.
  if (isApiPath(path)) {
    if (apiDecision(path, (h: string) => req.headers.get(h)) === 'pass') return NextResponse.next();
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.next();
  }

  if (isPublicPage(req)) return NextResponse.next();
  if (path === '/') {
    const { userId, sessionClaims } = await auth();
    // Only allowlisted users bounce into the room; anyone else stays on the landing page (no loop).
    if (userId && (await roomAllowed(userId, sessionClaims))) {
      return NextResponse.redirect(new URL('/war-room', req.url));
    }
    return NextResponse.next();
  }
  if (isGatedPage(req)) {
    const { userId, redirectToSignIn, sessionClaims } = await auth();

    // 1) Must be signed in (Google, restricted to the 4ormfinance.com domain in
    //    the Clerk dashboard). Sends them to Clerk sign-in, then back here.
    if (!userId) {
      if (isControlRoom(req) || isDesign(req)) return NextResponse.redirect(new URL('/', req.url));
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    // 2) Control room: Chad's email or a Clerk test user only. Everyone else goes home with no data.
    if (isControlRoom(req) && !(await roomAllowed(userId, sessionClaims))) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // 3) Must hold the room's role. Add `roles` to the session token in Clerk
    //    (Sessions -> Customize session token: {"metadata": "{{user.public_metadata}}"}),
    //    then set each person's public metadata to e.g. { "roles": ["advisor"] }.
    const claims = sessionClaims as Record<string, any> | undefined;
    const roles: string[] =
      claims?.metadata?.roles ??
      claims?.publicMetadata?.roles ??
      [];

    const needed = ROOM_ROLE[path];
    if (needed && !roles.includes(needed)) {
      // Signed in but not entitled to this room: send home.
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
});

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (!hasClerk) {
    const path = req.nextUrl.pathname;
    const api = isApiPath(path);
    const decision = clerkMissingDecision({
      production: isProduction,
      isApi: api,
      isPublicApiPath: api && isPublicApi(path),
      isGatedPage: !api && isGatedPage(req),
    });
    if (decision === 'unavailable') {
      if (api) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
      return new NextResponse('Unavailable', { status: 503, headers: { 'content-type': 'text/plain' } });
    }
    return NextResponse.next();
  }
  return gated(req, ev);
}

export const config = {
  matcher: [
    '/',
    '/advisor.html',
    '/employee.html',
    '/engineering.html',
    '/documents/:path*',
    '/road-ahead.html',
    '/path-to-revenue.html',
    '/visual-data.html',
    '/filing.html',
    '/control-room',
    '/control-room.html',
    '/playbook',
    '/calendar',
    '/news',
    '/email-board',
    '/war-room',
    '/space-detail',
    '/zoom',
    '/completed',
    '/notes',
    '/pipeline',
    '/spaces',
    '/documents',
    '/links',
    '/email',
    '/drive',
    '/contacts',
    '/financials',
    '/integrations',
    '/design',
    '/design/:path*',
    '/terms-of-service',
    '/terms-of-service.html',
    '/privacy-policy',
    '/privacy-policy.html',
    '/book',
    '/book.html',
    '/chad',
    '/(api|trpc)(.*)',
  ],
};
