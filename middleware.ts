import type { NextRequest, NextFetchEvent } from 'next/server';
import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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
