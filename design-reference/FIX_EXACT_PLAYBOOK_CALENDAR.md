# 4ormop.com - MAKE PLAYBOOK + CALENDAR (and every new page) IDENTICAL TO THE MOCKUPS. Paste the whole thing into Cursor.

The last build was made without looking at the approved designs. Playbook and Calendar do not resemble design-reference/playbook.html or design-reference/calendar.html. This prompt fixes that. It overrides any earlier styling instruction.

## STEP 0 - PRE-FLIGHT (do this before writing any code; report the result)
1. Run `ls design-reference/` and `ls design-reference/assets/`. Confirm these files exist: playbook.html, calendar.html, book.html, email-board.html, email-reader.html, warroom-reorg.html, news-redesign.html, assets/mark-4orm-iq.png, assets/logo-finance.png, assets/logo-finance-dark.png.
2. If ANY file is missing: STOP. Do not build anything. Reply with the list of missing files so Chad can add them. Building a page without its mockup open is a failure.
3. Open design-reference/playbook.html and design-reference/calendar.html and read them in full (style block, body markup, script). Say in one line per file what you see (e.g. "playbook.html: 250px label column + 7 day columns + 90px streak column, 36px pads, TODAY playhead, Longer beats row, month-stack modal").
4. Make every mockup viewable inside the app for side-by-side checks: serve each design-reference/*.html file at /design/<name> to signed-in users only (behind Clerk; never public).

## STEP 1 - THE METHOD (port, do not reinterpret)
These pages are JS-rendered mockups. The only exact way to match them is to PORT the mockup itself:
- Copy the mockup's ENTIRE `<style>` block into the page's stylesheet, scoped under one wrapper class (e.g. `.pb-root` for Playbook, `.cal-root` for Calendar) so it cannot leak. Same class names, same hex values, same sizes, same radii, same spacing. Do not convert it to Tailwind. Do not "clean it up".
- Copy the mockup's body markup into the page component unchanged (JSX-ify attributes only: class -> className, style strings -> objects, or render it with dangerouslySetInnerHTML).
- Copy the mockup's `<script>` render functions (render, timeGrid, mini, ribbon, wkPill, planDay, the popover, the toast, the month stack) into the component. Keep the same template strings and class names. Run them in a useEffect against the wrapper element.
- Replace ONLY the hard-coded data constants with live data in the SAME SHAPE:
  * Playbook: `rows` (n, room, sub, c, d[7], lab[7], st, nw) <- playbook_rhythms + playbook_log for the visible week. `ROOMS` stays as-is (routes: war /war-room, studio /studio, li /messages?ch=linkedin, pipe /pipeline, spaces /spaces, msg /messages, news /news, iq /4ormiq, done /completed, contacts /contacts, team /messages?col=team, dash /control-room). The popover "Go" button does `router.push(rm[1])`.
  * Calendar: `TODAY` <- the real current date (America/Los_Angeles). `E` (events {d:'YYYY-MM-DD', s:hour decimal, e:hour decimal, t:title, c:'meet'|'inv'|'pay'|'mile'|'hol', all:1 for all-day}) <- /api/calendar (Google Calendar). `S` (suggested plays) <- planDay() run over E for every upcoming weekday. `focus` <- next week's Sunday. The week view's first week = 3 weeks before this week; 18 weeks total.
- Use the real logo file: assets/mark-4orm-iq.png + the gradient "IQ" text, exactly as the mockup's `.brand` block (the mockup inlines it as base64; use the file).
- Dark theme for these two pages is the mockup's own palette. Do not substitute the app's generic dark tokens.

## STEP 2 - WHAT IS WRONG RIGHT NOW (every item must be fixed)
PLAYBOOK
1. Every past weekday pad shows dark red with an "x" (missed). Wrong. Rule: a pad is MISSED only if the day is on or after the rhythm's tracking start date (first day the Playbook was live, stored per rhythm as created_at) AND the day is past AND there is no log. Days before tracking started render as the mockup's DIMMED pad in the row colour (`.pad.done` style without the check). On first launch Chad should see a calm, dimmed, coloured grid - not a wall of red.
2. Pads are not in row colour. Each row has its colour (`--c`) exactly as the mockup: blue, red, pink, sky, green, gold, etc. Today's due pads = solid row colour, dark text, no glow, no pulse. Other days = `filter:saturate(.55) brightness(.62)`.
3. Room links are wrong: "30-min video" must go to Studio (not War Room); "Post today's clip" and "Engage 10 min" go to LinkedIn (/messages?ch=linkedin), not Dashboard; "Check 4ormIQ" goes to 4ormIQ; "Schedule clips" goes to Studio. Use the mockup's `rows` array as the default seed, verbatim.
4. Missing from the page vs the mockup: the TODAY playhead band with its "TODAY" tag, the day headers with small date numbers (MON 12...), the sub-labels (Mon-Fri, comment on 5), the DAILY / WEEKLY grouping, the streak values in the STREAK column, the legend line, the green "Run today's plays - N lit" button style, the "LONGER BEATS" row (4ormIQ 1,000-users goal tile + Marketing drop / Newsletter / Research paper / Investor update / Investor letter countdown cards), and the calendar button that opens the MONTH STACK modal. All must be present exactly as in the mockup.
5. Weekend: when today is Saturday or Sunday and nothing is due, still show the week with the playhead on today's column; the Run button reads "All lights off - day done" in the mockup's muted style.
6. Grid geometry must equal the mockup: `grid-template-columns:250px repeat(7,1fr) 90px`, row-gap 8px, column-gap 8px, pad height 36px, radius 10px.

CALENDAR
1. Opens on CW 39 ("3 weeks ago"). It must open scrolled to NEXT WEEK (focus = next Sunday), with the title updating as you scroll.
2. Week blocks are empty: no hour labels, no time grid lines, no events. Port timeGrid() exactly: weekday + date header (SUN 18, MON 19...), all-day row, 52px hours column 7a-8p, 46px per hour, today column tinted, red now-line, real events as filled boxes, suggested plays as dashed boxes.
3. No events render even though the banner says "47 plays". /api/calendar must return Chad's Google Calendar events and they must be mapped into E. If the API fails, show the grid empty with a small inline notice - never a blank dark slab.
4. Mini month is wrong: it starts on Monday and puts the 1st under Monday. October 1 2026 is a THURSDAY. Port mini(): Sunday-first (SUN MON TUE WED THU FRI SAT headers), correct offsets, today = blue circle, visible week shaded, coloured event dots.
5. Today ribbon shows one big red block. Port ribbon(): a slim 7am-8pm bar with today's meetings as coloured segments and a thin red now-marker.
6. Calendar toggles are broken (checkbox floating above each label). Port the mockup's toggle rows: coloured dot + label + right-aligned switch, one row each.
7. Missing: the natural-language box styling, NEXT UP card styling (title, one-line suggestion, Prep + Open), NEXT WEEK'S SHAPE legend, the weeks-out and months-out pills on every week label (this week = solid blue; "1 month out" etc. = gold), the 4ormIQ brand mark (currently a "4" square + "ormIQ" text).
8. Event box type: titles ~9.5px, times ~8.5px, one line with ellipsis; blocks under 30 min use `.ev.short` (min-height 17px, label vertically centred).
9. Quarter, Month, Day, Year views: port each render branch from the mockup unchanged.

## STEP 3 - SAME METHOD FOR EVERY OTHER NEW PAGE
Apply Steps 0-1 to: Email (email-board.html + email-reader.html), War Room top (warroom-reorg.html), News (news-redesign.html), Booking (book.html), and give Completed and Financials (no mockup) the same dark card style as Playbook. For each: port style + markup + script verbatim, swap only data constants.

## STEP 4 - SELF-CHECK (required; report it)
For Playbook and Calendar (then each other page):
1. Open /design/<name> and the live page side by side at 1440px wide.
2. Compare these and fix any difference: column widths, pad/box sizes, colours (sample 3 hex values), fonts and sizes, header layout, sidebar sections in order, presence of every element listed in Step 2.
3. Take a screenshot of each pair and attach or describe them in your reply. Only data values may differ.
4. If anything differs, it is not done. Revert to the mockup's code for that element.

## RULES
- Do not touch Clerk sign-in. DATA SAFETY: never delete or reset any user data; additive migrations only; seeds create only what is missing.
- No uppercase-monospace/typewriter fonts. Links open in a new tab.
- Commit to `main`, push, and confirm a new production deployment on Vercel.

Done = /playbook and /calendar are visually indistinguishable from /design/playbook and /design/calendar, with Chad's real data, deployed on main.
