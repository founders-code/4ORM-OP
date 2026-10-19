# 4ormop.com redesign - paste these into Cursor ONE AT A TIME, in order. Wait for each to finish and show an all-PASS visual-check table before pasting the next.

## STEP 0 - put the designs in the repo (paste this first)
```
Run this in the terminal from the repo root, then show me the output:

cp -R "/Users/chad-r-johnston/KCS CAPITAL/CLAUDE/design-reference/." design-reference/ && ls -la design-reference/redesign/ && cat design-reference/redesign/MANIFEST.json | head -20 && git add design-reference && git commit -m "Add Oct 19 approved redesign (17 pages) + build rules" && git push origin main
```

## PART A - shell, pixel-check harness, Dashboard, War Room, Notes
```
# 4ormop redesign - PART A of 4

Read design-reference/redesign/BUILD_RULES.md completely before doing anything. Your first reply must list its 8 section titles and the PRE-FLIGHT result (every MANIFEST file present with matching bytes and sha256). If anything fails, STOP and tell me.

This part builds:
1. The /design/<name> reference routes (signed-in only) and the `npm run visual-check` harness (BUILD_RULES section 6).
2. The app shell (section 2) used by every page: white top bar with the 4orm Finance logo + the page name + live clock, dark left menu with the real icons from _nav.js (no letters), navy page background.
3. Pages, each ported per sections 3-5:
   - design-reference/redesign/01-dashboard.html -> /control-room
   - design-reference/redesign/02-war-room.html -> /war-room
   - design-reference/redesign/03-notes.html -> /notes

Problems on the live site today that this part must remove (Chad's audit, Oct 19):
- Dashboard is 1584px wide in a 1200px window (Reply buttons and the right column cut off); it repeats raise, meetings and task counts 3-4 times because an old operations report is glued under it - delete that old report; LinkedIn shows system notices.
- War Room has two stakes ribbons (the top one broken), the ranked moves squeezed one word per line, the focus timer floating in an empty middle column, four controls on every task, and raw email subjects as tasks.
- Notes are stacked on top of each other and run off the screen.
- Top bar says "Dashboard" on every page; menu uses letters for icons; Integrations badge says 0.

Done = visual-check table for 01, 02, 03 all PASS (under 0.5%, no overflow), deployed to production, live URLs listed. Follow section 8.
```

## PART B - Pipeline, Spaces, Documents, Links, Email
```
# 4ormop redesign - PART B of 4

Read design-reference/redesign/BUILD_RULES.md again in full. First reply: the PRE-FLIGHT result for this part's files. STOP if anything fails. Keep the shell and harness from Part A.

Pages, each ported per sections 3-5:
- 04-pipeline.html -> /pipeline
- 05-spaces.html -> /spaces
- 06-documents.html -> /documents
- 07-links.html -> /links
- 08-email.html -> /email, with 08b-email-compose.html as the Compose panel (Compose button opens it; visual-check both: /email?fixture=mockup and /email?fixture=mockup&compose=1)

Problems on the live site today that this part must remove:
- Pipeline funnel runs off its card, % badges sit on the numbers, one shows 200%; 11 pipeline pills wrap onto 3 lines plus a second filter row; company repeated in every row; OPEN pill on every row.
- Spaces cards carry a Move: General / Venture / Business / Regulators link row and Delete beside Move to Drive.
- Documents shows one file in an empty centre; folder list clipped.
- Links shows + subcategory / rename on every row; Lumo saved twice; Perplexity/OpenAI tiles opened the Drive viewer (must open the site in a new tab).
- Email: empty columns full width; investor mail not filed into Investors.

Done = visual-check table for 04-08b all PASS, deployed, live URLs listed. Follow section 8.
```

## PART C - Playbook, Calendar, Zoom, Completed
```
# 4ormop redesign - PART C of 4

Read design-reference/redesign/BUILD_RULES.md again in full. First reply: the PRE-FLIGHT result for this part's files. STOP if anything fails. Keep the shell and harness.

Pages, each ported per sections 3-5:
- 09-playbook.html -> /playbook (also VOICE_LOG_PROMPT.md for recording + transcription)
- 10-calendar.html -> /calendar (every interaction in BUILD_RULES section 4 "Calendar" must work on live Google Calendar data: drag to move, resize, Option-drag duplicate, drag-to-create, click-to-edit popover with people / Zoom / links / files, Delete key, Cmd+Z undo that also reverts in Google Calendar, natural-language add, keep/drop suggested plays, Undo toast)
- 11-zoom.html -> /zoom
- 12-completed.html -> /completed

Problems on the live site today that this part must remove:
- Playbook: black panel on a navy page; Longer beats titles collide with the countdown ("Newsletter15d"); Run button says "day done" while today's pads are still due.
- Calendar: the current week collapses to a header with no grid; event labels cut to one word; no way to move, resize or edit events.
- Zoom: one card per row; every quote labelled "Chad:"; every card "Nothing owed".
- Completed: near-invisible title, black cards on a white page.

Also add a Playwright interaction test for the calendar: drag an event 1 hour later and 1 day right, resize it, create one by dragging, open the editor, add a person and a link, save, delete with the Delete key, undo with Cmd+Z - each step asserts the event's new day/time in the DOM and in the API response. Paste the results.

Done = visual-check table for 09-12 all PASS + the calendar interaction test passing, deployed, live URLs listed. Follow section 8.
```

## PART D - News, Drive, Contacts, Financials, Integrations
```
# 4ormop redesign - PART D of 4

Read design-reference/redesign/BUILD_RULES.md again in full, and design-reference/FIX_NEWS_CANADA_ONLY.md in full. First reply: the PRE-FLIGHT result for this part's files. STOP if anything fails. Keep the shell and harness.

Pages, each ported per sections 3-5:
- 13-news.html -> /news (Canadian sources only, real article photos cached same-origin, Refresh works without a 401 - everything in FIX_NEWS_CANADA_ONLY.md)
- 14-drive.html -> /drive
- 15-contacts.html -> /contacts (warmth computed from real Gmail + GHL + meeting activity)
- 16-financials.html -> /financials (1313 gate, cursor in the box, Return submits; burn from the master finance sheet, empty state until connected - never invent numbers)
- 17-integrations.html -> /integrations (real connection status)

Problems on the live site today that this part must remove:
- News: Philippines/EU/US stories, regulator form pages as "stories", duplicates, hero headline over its label, chips colliding, raw grey buttons, uneven cards, rail text running into dates.
- Drive: Owner / Modified / Linked columns empty on every row; file names wrap 3-4 lines; white page.
- Contacts: every contact "Cold / no date / Reach out"; Going-cold strip runs off the right edge.
- Financials: code box on a blank white page.
- Integrations: the same five services listed twice; GHL row text overlaps; "Connect Google" shown when connected.

Done = visual-check table for 13-17 all PASS, News sweep report (articles shown, hidden per reason, sources, first 12 headlines), deployed, live URLs listed. Follow section 8.
```
