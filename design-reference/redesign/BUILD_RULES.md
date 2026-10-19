# 4ormop.com redesign (Oct 19 2026) - BUILD RULES. Read this whole file before writing any code.

Chad approved 17 page designs, one at a time. They are the HTML files in `design-reference/redesign/`. The live site must look **identical** to them. Twice before, builds came out wrong because the designs were not in the repo, were rebuilt from a description instead of copied, or the app's own CSS leaked into them and nobody compared the result. Every rule below exists to stop that happening again.

## 1. PRE-FLIGHT (do first, report the result, STOP if anything fails)
1. Run `ls -la design-reference/redesign/ design-reference/assets/`.
2. Open `design-reference/redesign/MANIFEST.json`. For every entry, check the file exists and its size matches `bytes` exactly, and that `shasum -a 256 <file> | cut -c1-16` equals `sha256`. If any file is missing or different (old copy, stand-in, edited), STOP and list it. Do not build from a mismatched file.
3. Check `design-reference/assets/` has `logo-finance-dark.png`, `logo-finance.png`, `mark-4orm-iq.png`.
4. Open each design file in this part and write ONE line saying what you see (layout, columns, main cards).
5. Serve every `design-reference/redesign/*.html` file unchanged at `/design/<name>` (e.g. `/design/01-dashboard`), signed-in users only (behind Clerk, never public). These are the reference renders for the pixel check.

## 2. THE APP SHELL (build once; every page sits inside it)
The shell is the white top bar + the dark left menu + the navy page background. It is identical on every design file.
- CSS: `design-reference/redesign/_shell.css`, copied verbatim into one global stylesheet scoped to the shell elements only (`.top`, `.side`, `.main`, plus the tokens on `:root`). It must not style anything inside a page's Shadow DOM.
- Menu: `design-reference/redesign/_nav.js` holds the exact items, order, section headers and SVG icon paths. Render them as real line icons (no letters). The active item is the current page.
- Top bar: 4orm Finance logo from `design-reference/assets/logo-finance-dark.png` (the designs inline the same file as base64; use the file), then the page name (NOT always "Dashboard"), then Today / Calendar / Signals buttons and a LIVE clock "Mon, Oct 19 · 10:27 AM Pacific" format (America/Los_Angeles).
- Integrations badge in the menu = the real number of connected services.
- Keep the existing left-menu Arrange mode (drag to reorder, NAV_REORDER_PROMPT.md) working with these new icons.
- Page background: the navy gradient from `_shell.css` on EVERY page. No white pages, no black pages.

## 3. HOW TO BUILD EACH PAGE (port, never re-design)
For each page:
1. Take the design file's `<style>` block. Everything AFTER the shell part (from the `/* ===== <PAGE> ===== */` comment, or for Playbook/Calendar/Zoom/News the scoped wrapper block `.pbwrap` / `.calwrap` / `.zwrap` / `.nwrap`) is that page's CSS.
2. Render the page's `<main>` contents inside a **Shadow DOM root** (attachShadow open) with that page CSS + the token block from `:root` injected into the shadow root. App CSS cannot reach in; page CSS cannot leak out. Use a small `ShadowPage` component.
3. Copy the markup and the page `<script>` code VERBATIM into the component (template strings, class names, render functions). Run scripts against the shadow root (replace `document.getElementById(x)` with `root.getElementById(x)` / `root.querySelector`). Do not convert to Tailwind. Do not "clean up".
4. Replace ONLY the data. Each page has sample data in arrays or inline markup; feed live data in the SAME shape (section 4). With `?fixture=mockup` the page must use the design file's own sample data exactly - that is what the pixel check compares.
5. Missing live data = the same element with an empty state inside it. Never a different layout, never a blank slab.
6. Popovers, drawers and toasts (`position:fixed`) render inside the same shadow root.

## 4. DATA - what feeds each page (same shape as the design's sample data)
- **Dashboard (01):** command strip = cash/burn/runway/raise (masked `$••••` until the eye is clicked, one shared toggle); 7 lamps (Runway, Raise pace, Pipeline, Spend, Legal docs, Concentration, Integrations) with red/amber/green rules; What needs you now = alert feed; Raise tracker = 7 cheques in/pending/open; What I'd worry about = CEO brain blind spots; LinkedIn = Gmail LinkedIn notification emails, PEOPLE ONLY (drop "LinkedIn" system notices), up to 8, two columns, full width; Inbox = people-only Gmail (List-Unsubscribe filter) with role flag and Reply + ··· menu (Not a person / Snooze / File); Next meetings = Google Calendar today with alarm bell; Today's 1-3 = top 3 CEO moves; Company health = computed score + 5 bars; Momentum = tasks done per day (7 days) + 4 desk counts; Content runway = GHL social planner. Order exactly as the design: strip; 3 cards; LinkedIn full width; Inbox (left) + Next meetings & Today's 1-3 (right); Company health, Momentum, Content runway.
- **War Room (02):** one ribbon (cash, runway, raise masked; days to close; 4ormIQ launch; momentum mini-bars; Coaching note button opening a popover; focus streak; Show $); capture bar; hero = committed one move + 25:00 focus ring (text centered) + buttons, with CEO ranked moves INSIDE it (`/api/ceo/moves`, dismiss x re-ranks); right column = After your meetings (meeting_actions, +Today/+Week) then Next up + Find a 30-min slot; hero bottom aligns with Next up bottom; then Reach out lane; then Execution (Today / This week / Later, equal columns, checkbox + title + tag, hover shows move buttons and x, "+ N more" after 5). Task titles must read as actions: tasks created from emails get a verb-first title, never a raw subject line or file name.
- **Notes (03):** notes with type (To-do/Idea/Person/Decision/other), pinned, colour, checklist items, linked people/Spaces, reminder, one convert action. Board = masonry (default), Canvas = the old free-drag board.
- **Pipeline (04):** GHL pipelines - top 5 by count as buttons, the rest in "+ N more"; one Category dropdown; 5 KPIs; funnel of all stages (log-scaled bar height, empty stages grey, conversion = share of previous stage, capped at 100%, Storage not counted); Needs you today; Category x stage matrix; Recent activity; opportunity table (company shown once, no OPEN pill).
- **Spaces (05):** stat strip; groups with count, first 8 cards then "Show all N"; card = category chip, name, 2-line intel, readiness ring, ONE next-action chip (Send today / Add docs / Add people), file/link count, Open + Move to Drive; move-category / rename / delete only in the ··· menu (delete confirms).
- **Documents (06):** folders + counts, Sets, type filters; centre opens on All documents with first-page/slide previews, type badge, Drive-sync dot; right = Drop into a Space + Recently added.
- **Links (07):** category tree (+sub / rename / x on hover only); tiles with the site's real icon (site favicon at 128px or apple-touch-icon), name with an arrow, domain, note; duplicate URLs flagged; tiles are `<a target="_blank" rel="noopener noreferrer">`.
- **Email (08 + 08b):** horizontal board of user columns with their rule line; empty columns narrow; Bruce-type investor mail must file into Investors by rule; reader slides in from the right (resizable); Compose (08b) = right panel with From, To with contact autocomplete chips, subject, toolbar, body with grey suggested text (Tab accepts), Space attachments, Send / Schedule / Nudge in 3 days / Log to Pipeline, and the helper column (4orm Intelligence tone + write box, person card, attach from their Space, before-you-send checks). 1:1 mail sends from Gmail; bulk stays on GHL.
- **Playbook (09):** rows, pads, Longer beats, Voice log exactly as the design (see VOICE_LOG_PROMPT.md for the recording/transcription backend). Today column highlighted; "missed" only on or after each rhythm's tracking start date.
- **Calendar (10):** reads AND writes Google Calendar. All interactions in the design file must work on live data:
  drag an event to a new time or day (15-min snap, Shift = free) -> `events.patch` with `sendUpdates=all`; drag bottom edge to resize; Option-drag duplicates; drag on empty time to create -> editor popover; click an event -> editor popover (title, date/time, calendar, people with contact autocomplete -> attendees + invites, location / + Zoom -> create a Zoom meeting and attach the join link, links, files -> attach Drive files or upload to Drive then attach, alert, notes, Save / Duplicate / Delete); Delete key removes the selected event; Cmd/Ctrl+Z undoes the last change (reverting it in Google Calendar too); the natural-language box creates events ("Coffee with Bruce Tue 3pm"); suggested plays keep (creates a real event) / drop. Toast with Undo after every change. Week view opens on the current week, Sunday-first, correct weekday offsets, week labels not sticky.
- **Zoom (11):** meeting boxes 3 across grouped by week; gold quote names the person who said it (never "Chad:"); footer "You owe N" from meeting_actions, else "Solo" / "Nothing owed"; click opens the reader drawer for THAT meeting with every section in the design.
- **Completed (12):** daily_snapshots list (date, one-line summary, count chips) + the selected day's full snapshot (What moved today, 6 numbers, Done, Meetings & commitments, Email, Playbook pads, Voice log, News saved); Snapshot now; Export PDF; Add to investor update.
- **News (13):** Canadian sources only - implement FIX_NEWS_CANADA_ONLY.md in full. Every card shows the article's REAL photo (og:image / twitter:image / first article image / screenshot of the first screen), cached same-origin. Hero = photo left, text right. Cards 4 across, chips never overlap, x on hover hides stories like it.
- **Drive (14):** drive tree + counts + stars; Pinned for the raise; file table with Name (type badge + one-line name + folder), Linked to (Space chip or "+ Link to Space" on hover), Modified (real date), Owner (real owner). No empty columns.
- **Contacts (15):** role groups + smart lists with real counts; Going cold strip (4 people, Email via GHL); table with warmth meter computed from real activity (Gmail + GHL + meetings), last touch (red if 21+ days or none), next step, hover actions.
- **Financials (16):** code gate first (1313, cursor already in the box, Return submits, wrong code shakes, re-locks on leaving); cash/burn/runway/raise; 7-cheque raise detail + needed pace; burn by line FROM the master finance sheet (empty state until connected - never invent numbers); scenarios Ground Floor C$10.5M / Base C$94.7M (locked) / Blue Sky C$260.6M, labelled projections, 28 Sep 2026 model.
- **Integrations (17):** ONE list grouped Connected / Needs attention / Available, from the real connection status; each row says what it feeds; connected rows show Manage (never Connect); GHL lists its pipelines; OpenAI flagged with the reason when its key is missing.

## 5. LAYOUT RULES (apply everywhere)
- Nothing wider than the window: `document.documentElement.scrollWidth <= innerWidth` on every page at 1280 and 1440. (The old Dashboard was 1584px wide.)
- Every input and button stays inside its card padding; controls in a row share one height; no raw browser `<select>`.
- Long text truncates or line-clamps inside its element; chips never overlap; buttons never wrap.
- Sentence-case labels; no uppercase monospace text anywhere.
- Placeholder numbers show "-" until real data exists.

## 6. VISUAL CHECK HARNESS (mandatory - this is how "done" is decided)
- Add `npm run visual-check` (Playwright + pixelmatch). For each page in the part: load `/design/<file>` and `/<route>?fixture=mockup` at 1440x900 in the same signed-in session, wait for fonts and scripts, screenshot the full page, pixel-diff, save the diff image to `/visual-diff/<page>.png`.
- Mask only the live clock in the top bar.
- PASS = under 0.5% of pixels differ. Also assert no horizontal overflow.
- Paste the results table (page, % diff, overflow yes/no, PASS/FAIL) in your reply. If any page fails, fix it and re-run until all pass. A part is not done until its table is all PASS.

## 7. STANDING RULES
- Do not touch the Clerk sign-in.
- DATA SAFETY: never delete, reset or overwrite user data; migrations are additive (`CREATE TABLE IF NOT EXISTS`, new columns nullable); seeds create only what is missing.
- Web links open in a new tab; only Google Drive files use the in-app viewer.
- GoHighLevel is the only bulk/campaign send rail; never send a campaign without a test to chad@4ormfinance.com first.
- Fail soft: a failing API shows an inline note inside the card, never a red page banner.

## 8. FINISH (every part)
Commit to `main`, push, confirm the new Vercel production deployment, then reply with: the pre-flight result, the visual-check table, the production URL of each page in the part, and anything you could not do.
