# 4ormop - MASTER CHECKLIST (Oct 22, 2026)

Every open item from Chad's live testing and Claude's click audit. Nothing here is done until:
- it works on production, signed in,
- it survives a reload,
- it matches its design file pixel for pixel (where it has one).

Design files are in `design-reference/redesign/` (see MANIFEST.json). Build FROM the files, not from this text.

Legend: **[D]** = has a design file to copy exactly.

## 0. Rules for every item
- Every clickable / draggable / editable element has a `data-action`.
- One delegated listener per shadow root, kept across re-renders.
- Each action calls the existing endpoint or old function.
- Writes: optimistic + Undo toast + re-fetch + persist after reload. Deletes are soft. Never delete or reset data.
- No backend yet → "Coming soon" toast. Zero silent dead clicks.
- Never show design sample data or sample dates on live. A load failure shows "Couldn't load - Retry".
- "Today" is always the real date in America/Vancouver.
- Console errors = 0 on every page.

## 1. Site-wide
- [ ] 1.1 Wire every control on pages 01-17 (Claude's click audit found ~250 dead controls).
- [x] 1.2 live-updates.js on EVERY signed-in page (today only /control-room).
- [x] 1.3 live-updates.js stops on 401: refresh the Clerk token once, then show "Signed out - sign in again". Today it fires 500+ failed requests on the sign-in page.
- [ ] 1.4 Arrange: drag to reorder the left menu, persists.
- [x] 1.5 Top bar Today / Calendar / Signals open their views.
- [ ] 1.6 CEO brain watches everything (brain_queue every 15s, AI only on new items, Brain log, cost cap) - see the CEO brain prompt.
- [ ] 1.7 Chad (settings, not code): point GHL, Zoom and the Gmail Pub/Sub push at /api/hooks/*.

## 2. Dashboard (01)
- [ ] Open (What needs you now), LinkedIn Open › (new tab), Open LinkedIn
- [ ] People only / All mail tabs; Reply opens compose with the drafted reply; ··· menu (not a person / snooze / file)
- [ ] Next meetings Join + bell; Today's 1-3 rows → War Room; Open Email

## 3. War Room (02, [D] 02b-war-room-steps)
- [x] Steps expands under the move exactly as 02b (checkable steps, action links, + Add a step); state persists.
- [ ] Do, Plan (editor → /api/ceo/plan), × dismiss + undo, Re-run.
- [ ] Capture + Add; Start 25-min focus (real countdown, pause/stop, logs a focus block); Commit as my one thing; Cancel this move.
- [ ] After your meetings: + Today / + Week create the item; Review all.
- [ ] Next up Join / Prep; Find a 30-min slot.
- [ ] Reach out: shows real people (from Spaces / Pipeline next actions, not an empty table); chips filter; checkbox; + Add opens a picker.
- [ ] Execution: drag Today ⇄ Week ⇄ Later (persists), checkbox completes, +, Full screen.

## 4. Notes (03, [D] 03b-notes-open)
- [x] Clicking a note opens it LARGE in the same sticky style, exactly as 03b. NOT a white text box.
- [x] BUG: typing shows "Saved", but the text is gone on reopen. Edits must be saved to /api/notes (or /api/notes/sticky) and reload correctly.
- [ ] Colour dots, Pin, ··· , × close (Esc), Move to a Space, Convert to task.
- [ ] Filter chips, search, Board / Canvas, Tidy up, + Pin a note here.

## 5. Pipeline (04)
- [ ] Dashboard / Board / Table tabs. Board = drag between stages, writes the stage to GHL.
- [ ] Pipeline pills, + 6 more, Category menu, search, funnel stage + matrix cell filter.
- [ ] Follow up opens a composer (draft in Chad's voice; sends via GHL only after Chad confirms); Open opens the contact.

## 6. Spaces (05, [D] 05b-space-open)
- [ ] Opening a Space (card click or Open, new AND existing) shows the 05b workbench exactly: hero, readiness ring, The angle (4orm Intelligence), What <name> gets (email preview + file tiles + link), People, Next steps, Notes sticky, History.
- [ ] Readiness = real: person, notes, docs attached, link added, intro written.
- [ ] Suggested docs come from Documents; drag in from Documents / Drive; Add people from Contacts / Pipeline.
- [ ] Send bundle → GHL only, with a test copy to chad@4ormfinance.com first. Move to Drive works. Prev / Next space.
- [ ] Spaces list: Groups / Board, Filter, Show all, collapse, ··· menu, + New space.

## 7. Documents (06, [D] 06b-document-viewer)
- [ ] BUG: the folder tree doesn't switch. Folder click filters the grid; Sets work; + New folder / set.
- [ ] Clicking a file opens the IN-SITE viewer exactly as 06b (thumbnails, page view, zoom, details, In spaces, + Add to a Space). Never a redirect to Google Drive. "Open in Drive" is a small secondary button only.
- [ ] Grid / List, type chips, Pull from Drive, Upload, select + drag onto a Space, + Build a new Space from the selection.
- [ ] Drop-into-a-Space column must not wrap one word per line. De-dupe by Drive id.

## 8. Links (07)
- [x] BUG: the category menu doesn't work and subfolders won't open. Category tree: ▸ expands subfolders, click filters, + sub creates one, rename works.
- [x] Notes on links: "Add a note" on every tile is editable in place, saves to /api/links, shows on the tile, searchable.
- [ ] Add link, ✎ edit, ⇄ move, × soft delete, Expand all; tiles open in a new tab; favicons; counts match tiles.

## 9. Email (08, 08b, [D] 08c-email-people)
- [ ] BUG: the Filters button doesn't work. Opens the filter menu (people only, needs reply, unread, attachment, group, date); persists.
- [ ] + New rule, column ··· menu.
- [ ] People view exactly as 08c, behind a Board | People toggle.
  - Every email in or out is attached to a person (aliases merged).
  - New senders land in "New - not sorted".
  - Groups: Team, Advisors, Investors, Design partner prospects, Regulators & associations, Legal & finance, Vendors & tools, + New group.
  - Status: You owe a reply / Waiting on them / Going cold Nd / Meeting today / Up to date.
  - Person panel: counts, last contact, next meeting, "Next:" line, full timeline (emails + meetings + files) with tabs.
  - Changing the group writes back to Contacts / GHL.
- [ ] Sender display names (never a lowercase local part); each email in ONE column.

## 10. Playbook (09)
- [ ] TODAY = the real day. Chad's screen showed "TODAY Mon 19" on Thu Oct 22, no rows, "All lights off - day done".
- [ ] Never show the sample voice-log entries ("9:12 am Video done…", "Speer sync moved…").
- [ ] Pads click = done (persists, streak, "N lights left"); + Add a rhythm; every row link navigates; Longer beats open; full titles (no "Marketin…").
- [ ] Voice log: record → transcribe → Save to today / Discard.

## 11. Calendar (10, [D] 10b-calendar-rail-closed)
- [ ] Side panel collapses to a 52px icon strip exactly as 10b; the grid widens. Toggle button + "[" shortcut; remembers the choice.
- [ ] Rail "TODAY · MON OCT 19" must be the real day.
- [ ] Drag / resize / edit / create work in EVERY week shown (next week doesn't save today) and write to Google (events.patch, sendUpdates=all).
- [ ] Write times in America/Vancouver, not UTC.
- [ ] Delete asks "Remove event" or "Decline" (Mon Oct 19 Dean and Chad Weekly Call was silently declined).
- [ ] Mini-month dates jump to that week; ‹ › change month.

## 12. Zoom (11)
- [ ] Open → opens that meeting's reader (summary, Where I can improve, what they said, what you owe).
- [ ] ✎ edit, + Add note, All / Solo, Newest / Oldest, Refresh.
- [ ] Week headers match the meetings under them; "You owe N" joined to /api/meeting-actions.

## 13. Completed (12)
- [ ] Day click, Snapshot now, Search days, Export PDF, Add to investor update.
- [ ] Email box: sender + subject on one line (no one-word-per-line wrap).

## 14. News (13, [D] 13b-news-saved)
- [ ] Feed | Saved toggle. "Save to…" on every story opens the collections popover exactly as 13b: multi-select, suggested collections, note, + New collection.
- [ ] Saved view exactly as 13b: collections rail with counts and "Used in", collection header (Draft from these, Export to Doc), saved story rows with your note (editable), In collections, Used, Open / Move.
- [ ] Collections: "Why now" proof, Investor newsletter, Regulator note, LinkedIn ideas, VC proof points, Design-partner openers, Research paper, Competitors, + New.
- [ ] Writing fixes:
  - hero label sits above the title, not on top of it
  - one label per card (no "HOUSING MARKET" over "OPPORTUNITY")
  - design buttons, not raw grey browser buttons
  - summaries clamped to 2 lines
  - "Why it matters" written for THAT story (max 2 sentences, says what 4orm should do), clamped to 3 lines
- [ ] Canada only: drop podcasts, promos, and global or non-Canadian stories (FSB, Bloomberg crypto, Philippines) per FIX_NEWS_CANADA_ONLY.md.
- [ ] Port 13-news.html exactly (Part D).

## 15. Part D pages (not started)
- [ ] 14 Drive, 15 Contacts, 16 Financials (1313 gate), 17 Integrations - port exactly per CURSOR_PROMPTS_A-D.md Part D.

## 16. Still to design (Claude)
- [ ] Studio page. Public booking page photo (Chad to supply).

## Proof per step
- A. Per shadow root: controls WITH data-action vs WITHOUT (WITHOUT = 0).
- B. click-check table (Playwright, signed in, production, TEST records only, cleaned up): control | DOM changed | 2xx | persisted after reload | PASS.
- C. visual-check: every [D] file vs its state (e.g. /notes?fixture=mockup&open=note1, /documents?fixture=mockup&view=doc1, /calendar?fixture=mockup&rail=closed, /war-room?fixture=mockup&steps=1, /spaces/:id?fixture=mockup, /email?fixture=mockup&view=people, /news?fixture=mockup&view=saved) under 0.5%.
- D. Console errors 0; git status clean; commit hash; Vercel Production success.
