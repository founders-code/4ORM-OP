# Timeline (replaces War Room) - BUILD RULES. Read this whole file, then BUILD_RULES.md, before writing any code.

NAME CHANGE (26 Oct 2026, Chad): the page is called **Planner**, not Timeline. Route /planner (keep /timeline as a redirect). Menu order under Today: Playbook, Planner, Calendar, Email. Every visible "Timeline" label becomes "Planner"; code names, table names (timeline_items etc.) and API paths (/api/timeline) stay as written below. In the design files, change only the menu label and page title text "Timeline" to "Planner", then update their MANIFEST bytes and sha16.

LIVE SEED (26 Oct 2026): seed from design-reference/redesign/planner-seed.js (window.PLANNER_SEED), not the RAW array. It holds Chad's real dates from his docs, calendar and Gmail, with c (confirmed / sourced / estimated) and src on each item. Store c and src in timeline_items.note (append "Source: ..."), and show estimated items with the design's dashed "planned" style until Chad edits the date. Recurring dates rules: 'monthly:N', 'weekly:MO|FR', 'weekdays', 'every14:YYYY-MM-DD'. Items with st:'done' seed as status_override done. The RAW array stays as the ?fixture=mockup data for the pixel check.

Chad approved the Timeline page on 26 Oct 2026. It takes the War Room's place in the menu and as the landing page. The live page must look identical to the design files AND every control must work and persist. BUILD_RULES.md (Oct 19) still governs the shell, the Shadow DOM port method, layout, the pixel harness and the standing rules. This file adds what is specific to Timeline.

Sections: 1 Pre-flight · 2 Design files · 3 Method · 4 Data model · 5 API · 6 Data map · 7 Control contract · 8 War Room retirement · 9 Layout and state rules · 10 Checks · 11 Finish

## 1. PRE-FLIGHT (report the result, STOP on any failure)
1. `ls -la design-reference/redesign/`.
2. For every MANIFEST.json entry in this part, check bytes and `shasum -a 256 <file> | cut -c1-16`. Any mismatch: STOP and list it.
3. Open 18-timeline.html, 18b-timeline-item-open.html and 18c-timeline-milestone-open.html in a browser and write one line on what each shows.
4. Serve them at /design/18-timeline, /design/18b-timeline-item-open and /design/18c-timeline-milestone-open (signed-in only).

## 2. DESIGN FILES
| File | State | Live URL for the pixel check |
|---|---|---|
| 18-timeline.html | Page at rest | /timeline?fixture=mockup |
| 18b-timeline-item-open.html | Item drawer open (Speer MSA signed) | /timeline?fixture=mockup&state=item |
| 18c-timeline-milestone-open.html | Milestone drawer open (MVP demo-ready) | /timeline?fixture=mockup&state=milestone |
| _nav.js | Menu: "War Room" is now "Timeline" (same slot, same order) | every page |

The design files are fully interactive. Every behaviour you need already exists in their script: open and close, drag to reorder, editing, dependencies, slip detection, milestone roll-up, the focus timer. Port it; do not invent it.

## 3. METHOD (BUILD_RULES section 3, plus)
- Page CSS starts at `/* ===== TIMELINE ===== */`. Render inside a Shadow DOM root with that CSS and the :root tokens.
- Copy the markup and script verbatim. Swap `document.getElementById/querySelector` for the shadow root. Keep ONE delegated click/change/keydown/drag listener on the shadow root, so a re-render never loses handlers. The design already uses delegated listeners keyed on data attributes (data-open, data-toggle, data-chip, data-drag, data-mv, data-act, data-pop, data-rm, data-add, data-tasks, data-gdone, data-rmdep, data-adddep, data-f). Keep those attributes; add `data-action` with the same value so the button-sweep can find them.
- Replace ONLY the data: the `RAW` array and `hydrate()` become a fetch of GET /api/timeline mapped into the same `ITEMS` shape (section 6). `save()` becomes the API calls in section 7. `?fixture=mockup` uses the design's own RAW array unchanged.
- The design's selects get the app's styled dropdown (no raw browser select). Same size, same text, same place.
- Mutations are optimistic, show the site's existing toast with Undo, and persist (a reload shows the change). Removes are soft (archived_at).
- "Today" is the real date in America/Vancouver. The design computes everything from TODAY; keep that.

## 4. DATA MODEL (additive only: CREATE TABLE IF NOT EXISTS, nullable new columns, scoped to owner_id like items)
- **timeline_items**: id uuid pk · owner_id · pipeline text (corporate, capital, revenue, marketing, development, partnership, regulators, team, milestones) · stream text · title text · kind text (span, key_date, recurring, milestone) · start_date date null · due_date date · recur_rule text null (weekly:MO, monthly:15, monthly:28) · owner_name text · note text · status_override text null (risk, done) · milestone_id uuid null -> timeline_items.id · position int · created_at · updated_at · archived_at null.
- **timeline_deps**: item_id, depends_on_id, created_at, primary key (item_id, depends_on_id). Server rejects a dependency that makes a cycle (409) and any dependency on a milestone or recurring item.
- **timeline_prefs**: owner_id pk · pipeline_order jsonb · hidden jsonb · open jsonb · zoom text (3, 6, 9) · show_links bool · one_move_id uuid null · updated_at.
- **Tasks** inside a timeline item are existing `items` rows with `planOf` = the timeline item id. No new task table.
- Seed (only if timeline_items is empty for the owner): the RAW array in 18-timeline.html, five milestones plus 40 items, with dependencies, milestone links and the tasks listed there (tasks become `items` rows with planOf). Chad confirms dates after seeding; dates beyond October are placeholders.

## 5. API (authed with the Clerk session; same pattern as /api/items)
- GET /api/timeline -> { prefs, pipelines (in pipeline_order), items (not archived, including milestones), deps, tasks by item id }
- POST /api/timeline/items · PATCH /api/timeline/items/:id · DELETE /api/timeline/items/:id (soft: sets archived_at, clears milestone_id on items that pointed at it, drops its deps, returns what it changed so Undo can restore it)
- POST /api/timeline/deps {item_id, depends_on_id} · DELETE /api/timeline/deps {item_id, depends_on_id}
- PATCH /api/timeline/prefs
- Tasks: existing POST /api/items {title, planOf, area, source:"timeline"} and PATCH /api/items/:id {status}
- Focus timer and streak: reuse the War Room's existing focus timer function and streak log. Do not rebuild it.

## 6. DATA MAP (API -> the design's ITEMS shape)
| Design field | Source |
|---|---|
| id | timeline_items.id |
| p | pipeline (milestones -> "goals") |
| t | stream |
| n | title |
| o | owner_name |
| note | note |
| kind | span -> "span", key_date -> "ms", recurring -> "series", milestone -> "goal" |
| s, e | start_date, due_date as day numbers (days since 1970-01-01 of the Vancouver date). key_date and milestone: s = e = due_date |
| dates | recurring only: every date from recur_rule between 1 Oct 2026 and 30 Jun 2027 |
| dep | timeline_deps where item_id = id |
| g | milestone_id |
| st | status_override ("" when null) |
| tasks | items with planOf = id: {n: title, d: status == done, id} |
| state.order / hidden / open / zoom / links / move | timeline_prefs |

The timeline range (START 1 Oct 2026, END 30 Jun 2027) becomes: START = first of the month 1 month before today, END = 9 months after today. Typed MMDD dates resolve to the year that puts them between 3 months before and 9 months after today.

Log `[live-map] timeline items=N milestones=N deps=N tasks=N` on load. If the load fails: "Couldn't load - Retry" inside the timeline card. Never show the design's sample data on live.

## 7. CONTROL CONTRACT (every control, what it does, what it calls, what changes)
| # | Control (selector) | Action | Calls | On screen |
|---|---|---|---|---|
| 1 | .capForm submit | Create item in the chosen list. Milestones -> kind milestone, due today+30. Others -> stream "Inbox", start today, due today+7 | POST /api/timeline/items | Row flashes in the list, bar appears, that pipeline opens |
| 2 | .capPipe | Choose destination list | none | Selected value |
| 3 | .movePick change | Set today's one move | PATCH /api/timeline/prefs {one_move_id} | Picker shows it; survives reload |
| 4 | [data-act=focus] | Start, pause, resume the 25:00 focus | existing War Room focus timer + streak | Timer counts; label Start/Pause/Resume |
| 5 | [data-pop=due] | Open "Due in the next 7 days" (includes overdue) | none | Popover list |
| 6 | [data-pop=red] | Open "Overdue or slipping" | none | Popover list |
| 7 | #nextGoal | Open the next milestone | none | Milestone drawer, timeline scrolls to its flag |
| 8 | .drow (popover rows) | Open that item | none | Drawer, pipeline opened, bar flashes |
| 9 | .chip[data-chip] click | Show or hide a pipeline | PATCH prefs {hidden} | Lane, list group and counts update |
| 10 | .chip / lane label / list header drag ([data-drag]) | Reorder pipelines | PATCH prefs {pipeline_order} | Chips, lanes and list reorder together |
| 11 | .chip[data-all] | Show all pipelines | PATCH prefs {hidden: []} | All lanes back |
| 12 | [data-zoom] 3M, 6M, 9M | Change span, keep the centre date | PATCH prefs {zoom} | Board rescales |
| 13 | [data-act=today] | Scroll to today | none | Board scrolls |
| 14 | [data-pop=more] | Open More menu | none | Menu + legend |
| 15 | #mLinks | Show or hide dependency lines | PATCH prefs {show_links} | Lines drawn or cleared; label flips |
| 16 | More > Open all / Close all | Open or close every pipeline | PATCH prefs {open} | Track rows appear or collapse |
| 17 | .lanebtn[data-toggle], .lgt[data-toggle] | Open or close one pipeline (board and list together) | PATCH prefs {open} | Rows expand or collapse |
| 18 | .solo | Show only this pipeline | PATCH prefs {hidden} | One lane left |
| 19 | [data-mv] Up / Down | Move pipeline one place | PATCH prefs {pipeline_order} | Reorder |
| 20 | hover any [data-id] | Light the chain (waits on, unlocks, its milestone) | none | Others dim |
| 21 | bar, key date, flag, recurring name ([data-open]) | Open drawer | none | Drawer |
| 22 | [data-edit] Edit in list | Go to the row | none | Drawer closes, row flashes, name focused |
| 23 | #dClose, scrim, Esc | Close drawer or popover | none | Closed |
| 24 | .dlink | Open that item | none | Drawer switches, bar flashes |
| 25 | name input (data-f=n) | Rename | PATCH title | Bar label, drawer, chips update |
| 26 | stream input (data-f=t) | Move to a stream (suggests existing ones) | PATCH stream | Moves track row |
| 27 | owner input (data-f=o) | Set owner | PATCH owner_name | Drawer |
| 28 | start input (data-f=s) | MMDD, "30 Oct" or ISO. Empty -> key date | PATCH start_date, kind | Bar moves; slip checks rerun |
| 29 | due input (data-f=e) | Same parsing. Invalid -> field turns red and reverts | PATCH due_date | Bar moves; milestone risk rechecks |
| 30 | status (data-f=st) | Auto / At risk / Done | PATCH status_override | Bar style, Red count |
| 31 | milestone (data-f=g, .gsel) | Feed a milestone or none | PATCH milestone_id | Gold diamond on bar; milestone % and feed chips |
| 32 | .adddep | Add a dependency | POST /api/timeline/deps (409 cycle -> toast "That would loop") | Chip appears, line drawn |
| 33 | .dchip[data-rmdep] | Remove a dependency | DELETE /api/timeline/deps | Chip and line gone |
| 34 | [data-tasks] | Open the checklist | none | Checklist row |
| 35 | task checkbox (data-task) | Tick a task | PATCH /api/items/:id {status} | Count, bar fill, milestone % |
| 36 | .addt Enter | Add a task | POST /api/items {planOf} | Task appears |
| 37 | [data-rm] (two clicks) | Remove item or milestone | DELETE (soft) + Undo toast | Row, bar and links gone; Undo restores |
| 38 | [data-add] Enter | Add a row to that list | POST /api/timeline/items | Row flashes |
| 39 | milestone name, owner, target inputs | Edit milestone | PATCH | Flag moves, gold line moves |
| 40 | [data-gdone] | Mark milestone done or reopen | PATCH status_override | Flag fades; status pill |
| 41 | .feed .dchip | Open the feeding item | none | Drawer |
| 42 | top bar Today / Calendar / Signals | Shell controls, unchanged | existing | existing |

Load strip bars are tooltips only, not clickable.

## 8. WAR ROOM RETIREMENT
- Route /timeline. /war-room, /control-room and / redirect to /timeline (the War Room was the landing page).
- Menu: "War Room" becomes "Timeline" in the same slot. Keep Arrange mode.
- Where each War Room part goes:
  - Capture bar -> Timeline top (now with a list picker).
  - One move, 25-min focus, streak -> Timeline focus bar.
  - 4orm Intelligence ranked moves (/api/ceo/moves) -> the first three options in the One move picker, labelled "4orm Intelligence". Dismiss/re-rank stays server-side.
  - Ribbon (cash, runway, raise, days to close, 4ormIQ launch) and coaching note -> already on the Dashboard; not on Timeline.
  - After your meetings (meeting_actions) -> Zoom page "You owe N" (unchanged).
  - Reach out lane -> Pipeline page "Needs you today" (unchanged).
  - Execution Today / This week / Later -> retired. Due 7 days, Red and the list replace it.
  - Signals panel -> stays in the top bar.
- Keep the War Room code in the repo, unrouted, until Chad signs off the live Timeline. Do not delete it.

## 9. LAYOUT AND STATE RULES
- BUILD_RULES section 5 applies. No horizontal page overflow at 1280 and 1440. Only the board and the list scroll sideways, inside their cards.
- Sentence case. No uppercase monospace. No icons (the diamonds and dots are timeline marks, not icons).
- Bar labels stay visible while scrolling sideways (sticky label inside the bar).
- Slip rule: an item is slipping when something it waits on is due after it starts. A milestone is at risk when anything feeding it is overdue, slipping, or due after the milestone's date. Done items never count.
- Overdue = due before today and not marked done. Nothing is marked done automatically by date.

## 10. CHECKS (all must PASS before a part is done)
- `npm run visual-check` for 18, 18b, 18c: under 0.5% pixel difference at 1440x900, no overflow, the live clock masked.
- Live-data check signed in, no fixture: real items or the designed empty state, zero console errors.
- `npm run click-check` against TEST records it creates and archives afterwards: run every row of section 7, assert the DOM change, the 2xx call and that it persists after reload. Also: set Speer MSA signed (TEST copy) to 4 Dec and assert phase 1 and the architecture review show "Slipping" and MVP demo-ready shows "At risk".
- button-sweep: every interactive element in the three design files maps to a live data-action that does something. Any dead click blocks the deploy.

## 11. FINISH
Commit to main, push, confirm the Vercel production deployment, post `git status` (clean). Reply with: pre-flight result, visual-check table, click-check table, button-sweep result, live URLs, anything not done. Work through every step without stopping, except on a failed check or anything that would delete or overwrite real data. Never touch the Clerk sign-in.
