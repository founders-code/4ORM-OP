# 4ormop.com - News: Canadian only, real articles only, fix Refresh, match the design. Paste into Cursor.

Do not touch Clerk sign-in. DATA SAFETY: never delete rows - hide them (add a `hidden boolean default false` + `hidden_reason text` column, IF NOT EXISTS).

I checked production (Oct 19). The sweep works (92 items, photos stored) but the content is wrong and two things are broken:
- Non-Canadian stories: Finextra (Philippines real-time payments, EPC EU wallet, Huntington Bank, Euronet), ComplyAdvantage (Philippines FATF greylist x2), Wealth Professional US items (Wells Fargo/Merrill, Nasdaq sell-off, investment-banking revenue), Medium posts (incl. one in Hindi, crypto travel rule, casino KYC, UAE).
- Not news at all: regulator static pages scraped as "stories" - BCFSA "Mortgage Brokers Forms", "Trust Account Declaration", "Becoming a principal broker", "Archive: Legal Update"; FSRA "Stay in the loop", "Pension Services Portal" webinars; AMF regulation amendment pages.
- Duplicates: the same CSA "Investor Education Month" release 4 times (CSA, OSC, BCSC, ASC); Northguard Financial twice.
- The page's own sweep call returns 401 (POST /api/news/sweep from the News page and from Refresh). Calling it from the signed-in browser console with fetch works, so the client call is missing credentials/Clerk token. Fix: send `credentials:'include'` and the Clerk session token (await getToken()) as Authorization: Bearer, and accept it server-side.

## 1) SOURCES - Canadian only
Replace the feed list with Canadian sources only (keep it in NEWS_SOURCES.md):
- Canadian media: Canadian Mortgage Trends, Canadian Mortgage Professional, Mortgage Professionals Canada news, The Globe and Mail (Business, Real Estate, Banking), Financial Post, BNN Bloomberg, CBC News Business, The Canadian Press business, Investment Executive, Advisor.ca, Wealth Professional (Canada stories only), BetaKit (Canadian fintech), IT World Canada (cyber/AI in finance).
- Regulators and government - their NEWS / MEDIA-RELEASE feeds only (never site pages): FINTRAC news releases and penalty notices, OSFI news, Bank of Canada press releases (incl. retail payments supervision / RPAA), Department of Finance Canada news, FCAC news, Competition Bureau news, BCFSA news and enforcement, FSRA news releases and enforcement, CSA news (one copy - prefer CSA over OSC/BCSC/ASC duplicates), CIRO news, CMHC news, Privacy Commissioner of Canada news.
- Google News RSS only with Canadian edition + Canada in the query: `hl=en-CA&gl=CA&ceid=CA:en` and queries like `FINTRAC`, `"Retail Payment Activities Act" OR RPAA`, `OSFI AI`, `BCFSA mortgage broker`, `FSRA mortgage`, `mortgage fraud Canada`, `"suitability" Canada financial advice`, `AI financial advice Canada`, plus each competitor name AND Canada.
- REMOVE: Finextra, Medium (all tags), ComplyAdvantage blog, generic global fintech blogs, US-only outlets.

## 1b) VERIFIED FEEDS (checked Oct 19, 2026) - start with these
Working RSS/Atom, Canadian:
- Canadian Mortgage Trends - https://www.canadianmortgagetrends.com/feed/ (has media:content image per item)
- Canadian Mortgage Professional - https://www.mpamag.com/ca/rss (image in content html)
- Wealth Professional - https://www.wealthprofessional.ca/rss (mixed: many US/global items - the Canada gate MUST filter it)
- Investment Executive - https://www.investmentexecutive.com/feed/
- BetaKit (Canadian tech/fintech) - https://betakit.com/feed/
- Bank of Canada press releases - https://www.bankofcanada.ca/content_type/press-releases/feed/
Working HTML lists (scrape the list, follow each item link):
- FINTRAC penalty notices - https://fintrac-canafe.canada.ca/pen/4-eng (table: date, entity link, amount) and FINTRAC news - https://fintrac-canafe.canada.ca/new-neuf/1-eng
- OSFI news - https://www.osfi-bsif.gc.ca/en/news (news releases + statements; skip "media advisory")
Need a server-side test (blocked for bots or empty from my checker): The Globe and Mail RSS, Financial Post, CBC Business (returns Access Denied to bots - drop it), Google News RSS (works in a browser; its terms limit it to personal feed-reader use - acceptable for Chad's private desk, keep volume low).
On deploy, the sweep must log per source: HTTP status, items found, items kept. Any source returning 0 for 3 sweeps in a row is flagged in a small "Sources" panel (Settings) so it can be fixed.

## 2) GATES - every item must pass ALL of these to be shown
1. Canadian: publisher is on the Canadian list above AND the article is about Canada (mentions Canada, a province/city, or a Canadian regulator/institution). Reject if the main subject is another country (Philippines, EU/EPC, UK/FCA, US banks/Nasdaq, UAE, etc.) with no Canadian angle.
2. A real article: has a headline, a publish date within the window, and a URL from the outlet's news/article or media-release path. Reject regulator static pages: titles or paths containing forms, licensing, education, "becoming a", archive, portal, webinar, "stay in the loop", advisory index pages, regulation-amendment text pages, policy library pages.
3. English only.
4. On-topic for 4orm: payments/RPAA/FINTRAC/AML, financial-advice suitability and conduct, AI in Canadian financial services and its governance, mortgage/brokerage regulation and fraud, Canadian housing/mortgage market, consumer protection, competitors in Canada. Reject general markets news (stock indexes, IB revenue, airline/trucking deals) unless tied to these topics.
5. De-dupe: same story across outlets = one card (keep the primary source, list the others as "also in ..."). Normalise titles (strip " - Outlet name", lowercase, remove punctuation) and compare.
If OPENAI_API_KEY is set, run a final yes/no check per item: "Is this a Canadian news article relevant to <topics>?" - keep only yes. Without the key, the keyword gates above still apply.

## 3) CLEAN UP WHAT IS ALREADY STORED
Re-run the gates over all existing news_items; set hidden=true (with hidden_reason: not_canadian / not_article / duplicate / off_topic) for anything that fails. GET /api/news returns only hidden=false. Report counts per reason.

## 4) LET CHAD TEACH IT
Each card gets a small "Not relevant" x. Clicking hides the item and asks one tap: "Hide this source" / "Hide stories like this". Persist as news_rules (owner_id, kind source|keyword, value, created_at) IF NOT EXISTS and apply on every sweep.

## 5) MATCH THE DESIGN (design-reference/news-redesign.html) - text is running over everywhere
What I see on production at 1440px, every item must be fixed:
- HERO: the headline is printed on top of the "TOP RELEASE TODAY - PAYMENTS/FINTRAC" label (they overlap), and the impact chip is unreadable over the photo. The summary, "Why it matters" and source lines sit flush against the card edge with no padding. The action buttons are raw browser buttons (grey bevel) and wrap onto a second row.
- CARDS: the category chip and the impact chip collide on the photo ("PAYMENTS/FINTRAC" runs into "OPPORTUNITY"). Card text has almost no side padding. Summaries run long so cards in a row have different heights. The "Save >" button breaks onto two lines. The source line wraps ("Canadian Mortgage / Professional - today").
- RIGHT RAIL: in Competitor watch the item text runs into the date ("...built into y today"), and long items are cut mid-word.
Fix by porting the mockup exactly, inside a Shadow DOM so app CSS cannot interfere:
- Hero = 2 columns: photo left (object-fit:cover, min-height 300px) with the category chip top-left and impact chip top-right ON the photo (white pill backgrounds, never over each other); text right in a 20-22px padded column: small blue "Top story" label, headline 24px/1.2 (max 3 lines), dek (max 3 lines), "Why it matters to 4orm" in the blue-bar box, source line, then styled buttons (one primary blue, rest white outlined, 32px tall, wrap cleanly with 7px gap).
- Cards: 16:9 photo; chips inside the photo corners with 10px inset and max-width 45% each + ellipsis so they can never touch; body padding 12-14px; headline max 3 lines, "Why it matters" max 2 lines (-webkit-line-clamp), footer pinned to the bottom (margin-top:auto) with source on the left (one line, ellipsis) and "Save" on the right (white-space:nowrap). All cards in a row equal height.
- Rail: each row is a flex row - text (flex:1; min-width:0; ellipsis or 2-line clamp) + date (flex:none; white-space:nowrap; margin-left:8px). Nothing overlaps.
- Global: box-sizing:border-box, no text ever touching a card edge, overflow-wrap:anywhere for long words/URLs.
- Check at 1440, 1280 and 1024 wide: nothing overlaps, nothing runs outside its box.

## SELF-CHECK + REPORT
Run the sweep on production, then report: total shown, counts hidden per reason, list of the sources that contributed, and the first 12 headlines with their source. Every one must be a Canadian article on a 4orm topic. Confirm the page's Refresh works without a 401. Commit to `main`, push, confirm the Vercel production deployment.
