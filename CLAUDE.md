# 4ormop.com (repo founders-code/4ORM-OP)

Chad Johnston's operating room for 4orm Finance: email, contacts and call lists, pipeline, stage emails, playbook,
calendar, documents, notes, Zoom notes, completed log, financials, vault. One owner (Chad); team members get one page each.
Lane: **Live**. Every change runs the CTO brain loop (frame, slice, build, verify, ship, learn); see the brain's `CLAUDE.md`.

## Stack
- Next.js 14 (app router) on Vercel. `main` deploys to production; any other branch gets a preview build.
- Neon Postgres via `lib/db.ts` (`getSql`). Tables are created in code with `CREATE TABLE IF NOT EXISTS` and grown with
  `ADD COLUMN IF NOT EXISTS`. No migrations folder. Never drop, rename or delete without Chad's go.
- Clerk for sign-in (`middleware.ts`, `lib/gate.mjs`, `lib/session.ts`). Do not change Clerk settings or DNS.
- Integrations: GoHighLevel (`lib/ghl.ts`), Google (Gmail, Calendar, Drive: `lib/google.ts`), Zoom (`lib/zoom*.ts`),
  Perplexity (`lib/perplexity.ts`). Per-user credentials are sealed in the database (`lib/creds.ts`, `lib/seal.mjs`).
- Crons are in `vercel.json` and live under `app/api/cron/*` (each checks the cron bearer).

## Where things are
- `public/control-room.html` is the whole signed-in app shell. It loads about 40 scripts from `public/`, each with `?v=N`.
  **Bump the `?v` of every script you change** or browsers keep the old one.
- Pages are drawn by plain JS into shadow roots: `public/redesign-pages*.js` (one file per group of pages),
  `public/lists-bind.js` (Lists and Contacts), `public/control-room-ops.js` (Documents, News, dashboard),
  `public/process-builder.js` (Stage emails), `public/shell-nav.js` (left menu), `public/desk-actions.js`
  (every `data-action` click handler in `window.deskActions`). Page CSS is in `public/port-css/*.css`, versioned in
  `redesign-pages.js`.
- APIs are `app/api/<name>/route.ts`, each a thin gate plus a call into `lib/<name>.ts`.
- Team pages: `lib/gate.mjs` `TEAM_HOMES` (Bruce reaches `/bruce` only). Their data is read with `teamWorkspaceOwner`.
- `ceo/` holds the CEO brain files used by the CEO cron. `scripts/` holds the checks.

## Rules that bite
- Auth: every API needs a session unless it is in `PUBLIC_API` or `TOKEN_OR_SESSION` in `lib/gate.mjs`, and those
  routes verify their own token or signature. Add a test in `scripts/secure.test.mjs` for any new public route.
- No secrets in the repo (it is public). Keys live in Vercel env or the sealed credentials table.
- No email sends from code changes or tests, including test sends. Chad tests sending himself.
- UI: no icons, emoji or glyphs (`scripts/check-icons.mjs` enforces it); 24-hour times, America/Vancouver.
- Removes are soft with a 10-second Undo; no confirm prompts.
- A repaint must not draw the same thing twice (pages compare the new HTML with the last before replacing it).

## Checks
- `npm run check`: design manifest, icons, twin pages, secrets, `scripts/secure.test.mjs`, scan. Must pass before merging.
- `npx tsc --noEmit -p .` for types.
- Production deploy check: `gh api "repos/founders-code/4ORM-OP/deployments?sha=<sha>&environment=Production"` then its
  statuses. A green commit status can be the branch preview, not production.

## Known red lights (30 Oct 2026)
- L4 Canada: Neon has no Canadian region, so personal data is stored outside Canada. ADR-001 sits with Chad, Zed and Mathew.
- Personal data is committed in this public repo (`data/*.json` contact lists, `zoom_notes_seed.json` meeting notes)
  and read at runtime. Plan: move into Neon (sealed, like `data/library.enc`), then clean history. Chad decides.
- L1 Restore: no restore drill on record.
