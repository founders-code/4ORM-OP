# 4orm Operations, Onboarding (4ormop.com)

Invitation-only onboarding for the Formers. A thin Next.js app that serves a public
landing page and three separately gated rooms, styled in the locked 4orm Document
Standard. Mirrors the data room pattern (`founders-code/4orm-DATA-ROOM`).

## The rooms are separate on purpose

Each room ships only its own content. An advisor never sees the employee or
engineering room, and vice versa. This is enforced two ways:

- **At build**: the advisor documents are embedded only in `advisor.html`. The
  employee and engineering pages do not contain them at all (verified: zero
  crossover in page source).
- **At the gate**: `middleware.ts` protects each room, and (in production) checks
  the visitor's Clerk Organization so only advisors reach `/advisor.html`, etc.

## Structure

```
public/
  index.html          Public landing (Formers hero, sign-in below, three doors)
  advisor.html        Advisor Office  (gated)  -> full advisor manual + data room access
  employee.html       Employee room   (gated)  -> shell, place cards
  engineering.html    Engineering room(gated)  -> E0 Start Here live + shelves
  assets/4orm-logo.png
  documents/          Source PDFs (advisor set supplied)
app/
  layout.tsx          ClerkProvider
  sign-in/[[...sign-in]]/page.tsx
  sign-up/[[...sign-up]]/page.tsx
middleware.ts         Gates each room + /documents, per-org check ready to wire
next.config.mjs       Rewrites "/" to /index.html
.env.example          Clerk keys + redirect URLs
```

Each room opens to a calendar (recurring sessions marked), a links panel (company
Zoom, click-to-call, pop-up directory, email), and the documents laid out as
folder-style boxes with file cards. The advisor room also shows the six-month
clock, timestamped from first sign-in.

## Run locally

```
npm install
cp .env.example .env.local   # paste your Clerk keys
npm run dev
```

Open http://localhost:3000. Without Clerk keys the pages still render; the gate is
what Clerk adds.

## Wire the gate (Clerk)

1. Reuse the existing "4orm Finance Data Room" Clerk application.
2. Create three Organizations: `advisors`, `employees`, `engineering`.
3. Add each person to their organization (this is the vetting; only invited
   people get in). Advisors can authenticate with Google, which already works.
4. Uncomment the per-room org checks in `middleware.ts`.
5. Set the Vercel env vars from `.env.example` (test keys first).

## Deploy

New Vercel project, domain `4ormop.com`, Production tracks `main`. For production
Clerk: create the Production instance, add the domain + DNS, swap in `pk_live` /
`sk_live`, and set your own Google / Microsoft OAuth clients.

## Document status

Advisor room documents are live and rendered on brand. Employee and engineering
rooms are stood up with place cards. See the handoff notes for what is still to be
supplied.
