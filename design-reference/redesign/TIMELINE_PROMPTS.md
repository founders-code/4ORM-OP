# Timeline build - paste these into Claude Code ONE AT A TIME, in order. Wait for each part's all-PASS tables before pasting the next.

## STEP 0 - put the designs in the repo
```
Run this from the repo root and show me the output:

cp -R "/Users/chad-r-johnston/KCS CAPITAL/CLAUDE/design-reference/." design-reference/ && ls -la design-reference/redesign/ | grep -E "18|TIMELINE|_nav|MANIFEST" && git add design-reference && git commit -m "Add approved Timeline design (replaces War Room) + build rules" && git push origin main
```

## PART T1 - data and API (no page yet)
```
# Timeline - PART T1 of 3: data and API

Read design-reference/redesign/TIMELINE_BUILD_RULES.md in full, then BUILD_RULES.md. First reply: list the 11 section titles of TIMELINE_BUILD_RULES.md and the PRE-FLIGHT result. STOP if anything fails.

Build:
1. Section 4: the three tables (additive only), and tasks linked through items.planOf.
2. Section 5: GET /api/timeline, POST/PATCH/DELETE (soft) /api/timeline/items, POST/DELETE /api/timeline/deps (cycle check, 409), PATCH /api/timeline/prefs. Same Clerk auth and owner_id scoping as /api/items.
3. The seed from the RAW array in 18-timeline.html (only if the owner has no timeline items): 5 milestones, 40 items, their dependencies, milestone links, and tasks as items rows with planOf.
4. Clean-up in the same deploy (soft, never delete):
   - Archive items with source=gmail that are newsletters (List-Unsubscribe or bulk sender), and the two "TEST click-check" items. Report the counts before and after.
   - Stop the Gmail import creating tasks from newsletters and bulk mail.
   - /api/board returns more than 200 items, or pages them. Today it stops at exactly 200.
5. API tests: create, edit, add dependency, cycle rejected, soft delete, undo, prefs round-trip.

Known problems on the live site (audit 26 Oct):
- /api/plans is empty and no task has planOf set, so nothing links tasks to a plan.
- 165 of 200 items are Gmail newsletters filed as outreach tasks.
- Only 36 items have a date and 7 have an owner.

Done = API test table all PASS, seed counts reported, clean-up counts reported, deployed. Follow section 11.
```

## PART T2 - the Timeline page
```
# Timeline - PART T2 of 3: the page

Read TIMELINE_BUILD_RULES.md again. First reply: PRE-FLIGHT for 18-timeline.html, 18b-timeline-item-open.html, 18c-timeline-milestone-open.html and _nav.js. STOP if anything fails.

Build /timeline by porting 18-timeline.html with the Shadow DOM method (section 3):
- Copy markup and script verbatim. Replace only the data: GET /api/timeline mapped into the design's ITEMS shape (section 6). save() becomes the calls in the control contract (section 7).
- ?fixture=mockup uses the design's RAW array. &state=item opens the Speer MSA signed drawer. &state=milestone opens the MVP demo-ready drawer.
- Every control in section 7 works on live data, is optimistic with the site's Undo toast, and persists across reload.
- One move picker: the top 3 moves from /api/ceo/moves come first, labelled "4orm Intelligence", then items by due date.
- Focus: reuse the existing War Room focus timer and streak.
- Menu: War Room becomes Timeline (_nav.js).

Watch for (bugs seen in earlier ports):
- Handlers bound with document.querySelector die inside the shadow root. Use one delegated listener on the shadow root.
- The design's sticky bar labels and sticky lane column must still stick inside the shadow root's scroller.
- Dependency lines are drawn after layout (requestAnimationFrame) and must redraw on zoom, open/close, reorder and resize.
- Drag-to-reorder must work from chips, lane labels and list headers, and all three must stay in the same order.

Done = visual-check (18, 18b, 18c), live-data check, click-check for all 42 contract rows including the slip test, and button-sweep: all PASS. Deployed. Follow section 11.
```

## PART T3 - retire War Room and hook up the rest
```
# Timeline - PART T3 of 3: War Room retirement and hook-ups

Read TIMELINE_BUILD_RULES.md section 8 again. First reply: list what you will change on each page below, then do it.

1. Routes: /war-room, /control-room and / redirect to /timeline. Keep the War Room code unrouted; do not delete it.
2. Morning brief and 4orm Intelligence read the Timeline: red items, and milestones at risk, in this priority order: cash and raise, then customers and design partners, then the record, then promises, then regulators last. Today the brief's top item is a regulator task; that must not happen while anything higher is live.
3. Calendar: the existing "Milestones" calendar layer shows Timeline milestones (gold) and key dates as all-day, read-only entries. Clicking one opens /timeline with that item's drawer.
4. Completed: the daily snapshot records Timeline items marked done, milestones hit, and dates moved that day.
5. Playbook: the "One move" row links to /timeline. Change nothing else on the Playbook.
6. Existing real tasks (not Gmail newsletters): show me the list grouped by area, with a suggested timeline item for each. Do not file them until I approve.

Done = each item above checked on live, with a one-line proof each, zero console errors on /timeline, /calendar, /completed, /playbook. Follow section 11.
```
