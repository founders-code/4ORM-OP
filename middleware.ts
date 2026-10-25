import type { NextRequest, NextFetchEvent } from 'next/server';
import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Gating activates only when Clerk keys are present, so the app still builds and
// deploys before Clerk is wired.
const hasClerk =
  !!process.env.CLERK_SECRET_KEY &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
// Chad's private space. Sign-in is the gate; there is no separate room role.
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

const gated = clerkMiddleware(async (auth, req) => {
  if (isPublicPage(req)) return NextResponse.next();
  if (req.nextUrl.pathname === '/') {
    const { userId } = await auth();
    if (userId) return NextResponse.redirect(new URL('/war-room', req.url));
    return NextResponse.next();
  }
  if (isRoom(req) || isDocuments(req) || isDataRoom(req) || isControlRoom(req) || isDesign(req)) {
    const { userId, redirectToSignIn, sessionClaims } = await auth();

    // 1) Must be signed in (Google, restricted to the 4ormfinance.com domain in
    //    the Clerk dashboard). Sends them to Clerk sign-in, then back here.
    if (!userId) {
      if (isControlRoom(req) || isDesign(req)) return NextResponse.redirect(new URL('/', req.url));
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    // 2) Must hold the room's role. Add `roles` to the session token in Clerk
    //    (Sessions -> Customize session token: {"metadata": "{{user.public_metadata}}"}),
    //    then set each person's public metadata to e.g. { "roles": ["advisor"] }.
    const claims = sessionClaims as Record<string, any> | undefined;
    const roles: string[] =
      claims?.metadata?.roles ??
      claims?.publicMetadata?.roles ??
      [];

    const needed = ROOM_ROLE[req.nextUrl.pathname];
    if (needed && !roles.includes(needed)) {
      // Signed in but not entitled to this room: send home.
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
});

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (!hasClerk) return NextResponse.next();
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
