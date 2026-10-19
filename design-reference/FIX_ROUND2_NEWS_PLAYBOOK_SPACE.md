# 4ormop.com - Round 2 fixes: real news photos, Playbook bottom row, Space workbench alignment + a pixel-check harness. Paste into Cursor.

Do not touch Clerk sign-in. DATA SAFETY: never delete or reset data; additive migrations only. PRE-FLIGHT: confirm design-reference/news-redesign.html, playbook.html, space-detail-redesign.html exist and open them.

## 0) WHY THINGS KEEP DRIFTING - fix the cause first
Two causes: (a) the app's global CSS leaks into the ported mockups (e.g. a global `.top`/heading style turned the Playbook "Longer beats" card titles into white bars and made the "Playbook" title dim blue), and (b) nobody looks at the rendered result.
1. ISOLATE every ported mockup page (Playbook, Calendar, Email board, Booking, and any page ported from design-reference) inside a SHADOW DOM root (attachShadow({mode:'open'})) with the mockup's <style> injected into that shadow root. App CSS cannot reach inside; mockup CSS cannot leak out. Live data and click handlers still work (events bubble; use router.push for navigation).
2. ADD A VISUAL CHECK HARNESS: `npm run visual-check` using Playwright + pixelmatch.
   - Each ported page accepts `?fixture=mockup`, which feeds it the mockup's own sample data, so the live page and the mockup should render identically.
   - The script loads /design/<name> and /<page>?fixture=mockup at 1440x900 (signed-in test session), screenshots both, and pixel-diffs them. Write the diff images to /visual-diff/.
   - PASS = under 0.5% of pixels differ. Run it for playbook, calendar, news, space-detail, email-board, warroom-reorg, book. Fix and re-run until every page passes. Paste the results table (page, % diff, pass/fail) in your reply.

## 1) NEWS - show the real article photo on every card (like any news site)
Right now every card is a navy tile with a regulator icon, and the stories are regulator homepages (FINTRAC, Bank of Canada, OSFI, FCAC) rather than real articles. Both are wrong.
- STORIES must be real, individual articles from the sweep (NEWS_SOURCES.md): a specific article URL, headline, publisher, date - never a regulator's home page or a seeded placeholder. Remove the seeded placeholder rows from what the page shows (do not delete other data). "Last month" should show dozens of items, not 4.
- THUMBNAIL = the article's own lead photo, as shown on that article's page:
  1. At ingest, fetch the article HTML and read og:image, then twitter:image, then the first large <img> in the article body.
  2. If none exists, take a SCREENSHOT of the article's first screen (1200x630) with @sparticuz/chromium + playwright-core in a serverless route, or the Microlink screenshot API if headless Chromium is too heavy on Vercel.
  3. Download the image and store it (Vercel Blob or a bytea column) and serve it same-origin via /api/news/thumb/:id with long cache headers. Never hotlink.
  4. Backfill: run the thumbnail job for every existing item, then on every new ingest.
- CARD LOOK: the photo fills the top of the card (object-fit: cover, 16:9) like a news site; the headline sits UNDER the photo (or over a dark bottom gradient on the hero only); a small category chip top-left and the impact chip (Opportunity / Threat / Regulatory) top-right. No icon tiles unless the article truly has no image and the screenshot failed.
- GRID: 4 cards wide below the hero, filling the row (no empty right half).
- "Your briefing" rail card: list the 4 items as numbered rows stacked vertically (number + title on one line each), not squeezed into 4 narrow columns.

## 2) PLAYBOOK - fix the bottom row and the title
- LONGER BEATS cards: the titles ("4ormIQ - 1,000 users", "Marketing drop", "Newsletter", "Research paper", "Investor update", "Investor letter") are rendering as white bars with unreadable text. They must match the mockup: dark card, title in white 13.5px weight 750 on the left, the countdown number large on the right with a small "d" / "d to launch", progress bar under, footer line (cadence left, status right in green). The Shadow DOM fix in 0) should cure this; confirm it.
- The "Playbook" heading must be white 28px weight 850 as in the mockup (currently dim blue).
- The TODAY band must stop at the bottom of the grid; it currently runs down over the legend.
- Seed streak values only from real logs (5 days / 5/5 shown today are placeholders); with no history show "-".

## 3) SPACE WORKBENCH (open space, e.g. "Design partners") - alignment
Match design-reference/space-detail-redesign.html. Fix:
- "Drive folder" card: the "Choose a Drive folder" field runs past the card's right edge. Every input/button sits inside the card padding (width:100%; box-sizing:border-box).
- "What ships" card: controls wrap unevenly. Lay them out as the mockup: one row "+ New folder" button + folder-name input (input flexes), one row "Choose files" + destination picker (picker flexes), then "Move to Drive", then the drop zone - all the same height (32px), aligned left and right.
- Replace the raw browser <select> ("This space", "Choose a Drive folder") with the app's styled dropdown - no default browser selects anywhere.
- Top header bar: give it the same inner padding as the cards below (Back button and "Send via GHL" must not touch the edges); Follow up / Gmail draft / Send via GHL all 34px tall and vertically centred with the title block.
- Recipients form: Name/Email on one row and Role/Add on the next, equal widths, same height; "Add" is a proper button.
- All card headers use the mockup's header style; all spacing on the 8px rhythm.

## SELF-CHECK + FINISH
Run `npm run visual-check` and paste the table. Then open /news and confirm the first 8 cards each show a real photo from their article. Commit to `main`, push, confirm the Vercel production deployment.
