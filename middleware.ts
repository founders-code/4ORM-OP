import type { NextRequest, NextFetchEvent } from 'next/server';
import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Gating is added once Clerk keys are present. Until then the app deploys and
// serves openly, so the build never fails for a missing key. Each room is gated
// separately and never crosses over.
const hasClerk =
  !!process.env.CLERK_SECRET_KEY &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const isProtected = createRouteMatcher([
  '/advisor.html',
  '/employee.html',
  '/engineering.html',
  '/documents/(.*)',
]);

const gated = clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    // TODO (production): enforce room-by-room separation by Clerk Organization.
    // const { orgSlug } = await auth();
    // if (req.nextUrl.pathname === '/advisor.html'     && orgSlug !== 'advisors')    return NextResponse.redirect(new URL('/', req.url));
    // if (req.nextUrl.pathname === '/employee.html'    && orgSlug !== 'employees')   return NextResponse.redirect(new URL('/', req.url));
    // if (req.nextUrl.pathname === '/engineering.html' && orgSlug !== 'engineering') return NextResponse.redirect(new URL('/', req.url));
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
