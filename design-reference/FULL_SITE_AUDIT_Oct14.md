# 4ormop.com - full-site audit (live, signed in, Oct 14 2026)

I walked every page while logged in and re-tested every endpoint with your token. This is the whole site in one doc: what's right, what's wrong on **design**, and what's wrong on **function**. Cleaned up the two test rows I created while probing (both deleted, 200).

---

## The one-line verdict

**The backend is in far better shape than the look.** Since the Oct 13 audit, most of the broken endpoints got fixed - creating spaces works, adding tasks works, GHL/Drive/news/CEO-moves endpoints are live. **The real failure now is design: several pages were built to my *words*, not my *mockups*, because the mockup files were never in the repo.** The pages that diverge most are the newest designs (Dashboard-as-grid, Contacts, Notes, News polish) - exactly what the design-reference folder + DESIGN LOCK fix is for.

---

## FUNCTION - endpoints re-tested today (big improvement since Oct 13)

**Now working (were broken/missing on Oct 13):**
- `POST /api/items {title,bucket}` -> **200** (the extra-field 400 that caused the red line on task-add is FIXED)
- `POST /api/spaces {name}` -> **200** (space create FIXED - this is why 53 spaces now seed)
- `DELETE /api/items/:id`, `DELETE /api/spaces/:id` -> **200** (deletes work)
- `/api/ceo/moves` -> **200** (was 404)
- `/api/drives` -> **200**, returns your REAL Google shared drives (00 Advisor Office, 01 Knowledge Base ... Founders Office) - was 404
- `/api/ghl` and `/api/pipeline` -> **200**, real GHL stages (COLD 98, PROPOSAL 1, FACULTY FOUND 1) - were 404
- `/api/links/categories` -> **200** (was 404)
- `/api/documents/upload` -> route exists (405 on GET = POST-only, correct)
- `/api/move-snooze` -> route exists (405 on GET = POST-only, correct)
- `/api/news` -> **200 WITH seeded items** (was empty)
- `/api/board` -> **200**

**Still broken / not flowing (these are the function fixes that matter now):**
1. **Calendar is not actually read.** `/api/calendar` returns 200 but `{events:[], error:"Calendar could not be read."}`. So **Find-a-30-min-slot and the Next-up countdowns have no live data**, even though Integrations shows Google Calendar "connected, 33 events". Connected but not returning to the app.
2. **Dashboard Inbox is empty.** "GMAIL HAS NOT RETURNED MESSAGES" - yet Integrations shows Gmail connected with 8 messages. The **VC-flagging inbox isn't pulling Gmail** into the panel.
3. **Content runway is empty.** "GoHighLevel has not returned a content queue" - the social-planner read isn't wired, so posts-left / runs-dry never show.
4. **VC watch is empty.** "No VC spaces on the board yet" - not reading the VC Spaces/GHL opportunities.
5. **Pipeline "Pipeline health" bars all show 0** despite the stage cards above showing 98 / 1 / 1 - the funnel isn't wired to the stage counts.

---

## DESIGN + FUNCTION, page by page

Scoring: **MATCH** (close to mockup) / **PARTIAL** (right bones, wrong look) / **MISS** (not the design).

### Dashboard - MISS (biggest gap)
- **Design:** built as a vertical stack of full-width collapsing rows in a mono/console font. The mockup is a **3-column card grid** - What needs you now / Raise tracker / What I'd worry about; Inbox / Content runway / VC watch; Health doughnut / Momentum bars / Today's 1-3. None of that grid is there.
- Raise tracker is a thin bar, not the **7 labelled cheque segments**. No severity icons on the worry list. No avatars/red VC flags on the inbox. No **content-runway progress bar**. No **company-health doughnut**. No **momentum bar strip**.
- **Today's 1-3 shows raw email subjects** ("RE: Welcome to 4orm Finance", "[GitHub] Cursor is requesting...") instead of your P1/P2 ranked moves. This one's both ugly and wrong data.
- **Function:** command strip, lamps, money bar and metric tiles are present and populated; the three dead panels (Inbox/Content runway/VC watch) are the data-flow bugs above.

### War Room - PARTIAL
- **Design:** the sections exist (stakes ribbon, "the one thing" hero, coaching, capture, reach-out lane, Today/Week/Later, 4orm Intelligence) but flat and stripped vs the mockup.
- **The three needle-mover slots are empty checkboxes literally labelled "Move"** - they should be real, labelled move cards pulled from the CEO moves. The hero is bare.
- **Function:** capture/add works (items POST is fixed); execution columns render; Find-a-slot will be empty until calendar is fixed.

### Pipeline - PARTIAL
- **Design/Function:** the cockpit line, Table/Board/Dashboard toggle, real GHL stage cards and the dense table are all there and real. Good.
- **Dashboard view is a stub:** "Pipeline health" bars read 0, and there's **no KPI row, no Needs-you-today smart list, no category x stage heat matrix, no activity feed** from the mockup.
- **Category pills are the OLD set** (All / VC / Angel / Business / Grant & Regulator) - not the canonical set (VC / Angel / Strategic / Design Partners / Partners / Regulators / Grants / Advisors / Network).
- Raw GHL stage name "FACULTY FOUND" is showing through - needs a clean label.

### Spaces - MATCH
- **53 spaces seeded**, grouped into collapsible categories (General, Venture Capital 10, ...), readiness rings, red "Send today" next-action, intel snippet on each card, Move-to-Drive / Delete. Close to the grid mockup. (Open-space workbench 3-column layout still to confirm visually, but the grid is right.)

### Documents - MATCH (structure) / thin on content
- Three-column layout matches: folder tree + "Add a folder" + **SETS** (Investor data room / Regulator pack / F&F bundle) + filter chips; center folder grid; right **Spaces rail as drop targets** + "Build a new Space from the selection" + Recently added.
- Folders are mostly empty (0 files), so the first-page thumbnail grid can't show yet. Left column styling is plainer than the mockup.

### Links - MATCH
- Two-pane tree matches the mockup: category rows with sideways/down disclosure arrows, count pills, "+ subcategory", rename, "+ New", "Expand all"; right pane breadcrumb + add-link row + thumbnail wall. Clean.

### Zoom - MATCH
- Blue-gradient theme, 4-wide card grid, mono date, white title, blue attendee chips with +N overflow, intel panel, Open button, gold "Solo" tag. Close to the mockup. Minor: the intel panel is missing the **gold left-accent bar**.

### Notes - MISS (vs the new design)
- Still the **old plain yellow sticky board**: drag/resize/colour-dots and Tidy/Search/New note only. **None of the new power layer** - no type tags (To-do/Idea/Person/Decision), no checklists, no pin, no link-to-person/Space, no reminders, no filter chips, no convert-to-task/content/Space actions, no archive.

### News - PARTIAL
- **Good:** the briefing structure is already there - Today/Last week/Last month toggle, Refresh, a **Top release** block with the action buttons (Draft a LinkedIn post / Add to investor newsletter / Cite to a VC / Open source), category chips, a story grid, and the right rail (Your briefing / Competitor watch / Trending). Seeded, not empty.
- **Wrong look:** the images are **flat grey blocks** - no article og:images, no colour-coded category imagery, and **no impact tags (Opportunity / Threat / Regulatory)**. No "Save" on the cards. Reads monochrome and unfinished vs the mockup.

### Drive - MATCH
- Real **Google Drive shared-drive tree** (00 Advisor Office ... 16 Collaboration, Founders Office) with expand controls, "+ folder / + subfolder / + document / Rename / Move", List/Thumbnails toggle, and a **Pinned-for-the-raise** panel. Close to the mockup; styling is plainer (no file-type dots / count pills / star).

### Contacts - MISS (vs the new design)
- Plain **name / company / role / email table** with an **empty "Going cold" bar** (five "NO DATE" placeholders). Missing the whole command-center: **no smart-segment left rail** (By role counts + Going cold / Owe a reply / Warm & active / Can intro me), **no warmth meters**, no role tags, no next-step column, no per-row launchpad actions. Category pills are the old set.

### Integrations - MATCH
- Clean list; **Gmail, Google Calendar, Google Drive (18 drives), GoHighLevel, Morning brief all CONNECTED**. The problem isn't the connections - it's that Gmail/Calendar/GHL data isn't flowing into the Dashboard panels (function bugs above).

---

## CROSS-CUTTING

- **Type system not applied.** Panel body text across the app (Dashboard especially) renders in an uppercase **mono/console font** that reads unfinished. The "one type system from the 4orm Intelligence card" never got applied site-wide - this alone makes the whole app look rougher than the mockups.
- **Canonical categories not applied.** Pipeline and Contacts still show the old pill set. The VC / Angel / Strategic / Design Partners / Partners / Regulators / Grants / Advisors / Network set isn't in.
- **Root cause of the design misses:** pages were built from prose, not the mockups, because the mockup HTML wasn't in the repo. Fixed by the `design-reference/` folder + the DESIGN LOCK block now at the top of the prompt.

---

## FIX ORDER (what to tell Cursor)

**P0 - design (the "looks nothing like it" problems):**
1. Rebuild **Dashboard** as the 3-column card grid per `dashboard-mission-control.html` (cheque segments, avatar+VC-flag inbox, content-runway bar, health doughnut, momentum bars; Today's 1-3 = ranked CEO moves, not email subjects).
2. Rebuild **Contacts** to `contacts-redesign.html` (smart rail + warmth meters + role tags + next-step + launchpads).
3. Rebuild **Notes** to `notes-redesign.html` (types, checklists, pin, link, reminders, convert actions, filters).
4. **News** visual pass to `news-redesign.html` (colour imagery + impact tags + Save).
5. **War Room** needle-mover slots become real move cards; apply the **one type system** everywhere (kill the console font).

**P1 - function:**
6. Fix **calendar read** (`/api/calendar` returns 0 + "could not be read") so Find-a-slot and countdowns work.
7. Wire Dashboard **Inbox (VC-flag Gmail)**, **Content runway (GHL queue)**, **VC watch** to their live sources.
8. Finish **Pipeline Dashboard view** (health bars, KPI row, Needs-you-today, heat matrix, activity feed) and apply **canonical categories** to Pipeline + Contacts.

**P2 - polish:**
9. Populate Documents folders (thumbnails), Zoom gold accent, Drive styling (type dots / counts / star), clean GHL stage labels.

Bottom line: you're closer than it feels - the plumbing mostly works now. It's the **look** that's behind, and that's the exact thing the design-reference folder is built to fix.
