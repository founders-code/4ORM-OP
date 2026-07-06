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
// gets both offices. Engineers typically have ['employee','engineering'].
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

const gated = clerkMiddleware(async (auth, req) => {
  if (isRoom(req) || isDocuments(req)) {
    const { userId, sessionClaims } = await auth();

    // 1) Must be signed in (Google, restricted to the 4ormfinance.com domain in
    //    the Clerk dashboard). If not, send to sign-in.
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
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
    '/advisor.html',
    '/employee.html',
    '/engineering.html',
    '/documents/:path*',
    '/(api|trpc)(.*)',
  ],
};
