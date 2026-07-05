import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Each room is gated separately and never crosses over. An advisor must never
// reach the employee or engineering room, and vice versa. Sign-in alone is
// enforced now; wire the per-room org check below once the Clerk Organizations
// ("advisors", "employees", "engineering") exist.
const isAdvisor     = createRouteMatcher(['/advisor.html']);
const isEmployee    = createRouteMatcher(['/employee.html']);
const isEngineering = createRouteMatcher(['/engineering.html']);
const isDocuments   = createRouteMatcher(['/documents/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isAdvisor(req) || isEmployee(req) || isEngineering(req) || isDocuments(req)) {
    await auth.protect();

    // TODO (production): enforce room-by-room separation by Clerk Organization.
    // const { orgSlug } = await auth();
    // if (isAdvisor(req)     && orgSlug !== 'advisors')    return Response.redirect(new URL('/', req.url));
    // if (isEmployee(req)    && orgSlug !== 'employees')   return Response.redirect(new URL('/', req.url));
    // if (isEngineering(req) && orgSlug !== 'engineering') return Response.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: [
    '/advisor.html',
    '/employee.html',
    '/engineering.html',
    '/documents/:path*',
    '/(api|trpc)(.*)',
  ],
};
