# 4orm daily news sweep - TWO scheduled tasks

Set up TWO scheduled tasks from the Scheduled section in the Claude sidebar (New task). Same prompt for both, different times:
- Task 1: 4orm news sweep - AM  -> every day 8:00 AM PST  (cron: `0 8 * * *`)
- Task 2: 4orm news sweep - pre/post meeting -> every day 11:00 AM PST  (cron: `0 11 * * *`)

Why two: the morning meeting is at 10:00 AM, things change, so the 11am run catches anything new around the meeting. The ingest de-dupes by URL, so running twice does not duplicate items.

Paste this prompt into BOTH tasks:

---

PROMPT:

You are running Chad Johnston's 4orm Finance news sweep. 4orm builds software that gives regulated businesses (mortgage, auto, insurance, investments) an auditable record of consumer suitability and understanding - a compliance/evidence tool with a counselling-style consumer intake. Chad is raising a friends-and-family round and reaching out to design partners and regulators. Use the single most relevant angle to his world. Do not describe 4orm as an "AI" company. Use hyphens, not dashes.

STEP 1 - Search. Use WebSearch (standard mode, today's date) for fresh (last 7-30 days, Canada-relevant where possible) news in EACH category. One or two tight searches per category:
- Compliance
- AI (as a technology/category - regulation, explainability, enterprise use)
- Counselling (behavioural / financial-decision / disclosure research)
- Fintech & regulation (FINTRAC, CSA, FCAC, RPAA, OSFI, FSRA)
- Mortgage (FSRA, broker suitability, Canadian mortgage rules)
- Fraud & scams (consumer fraud, investment scams, Canada)
- Grants (SR&ED, Alberta Innovates, Canadian startup grants)
- Payments / FINTRAC
- Competitors (Vanta, Drata, Aveni, AutoRek)
- Design-partner targets (Century 21, RE/MAX, Canadian brokerages)
- Fundraising / VC (Canadian early-stage, fintech)

STEP 2 - Pick. Choose ONE top release (is_top:true): the single item most useful to Chad this week. Then 8 to 12 supporting headlines across categories. For each item capture: category, a tight title, a one-line "why it matters to 4orm" summary, the source URL, and published_at (date). Only real search results - never invent a headline or URL.

STEP 3 - Post to the Control Room. Open https://4ormop.com/control-room (Chad stays signed in). Get a token via `await window.Clerk.session.getToken()`, then:
`fetch('/api/news/ingest', {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({items:[ {category, title, summary, url, published_at, is_top}, ... ]})})`
The ingest de-dupes by URL. If it returns 404/error, do not fail - include the full digest in your reply so Chad still sees it.

STEP 4 - Report. Reply with a short digest: the top release first (title, why it matters, link), then supporting headlines grouped by category, each one line with its link. Scannable. Hyphens, not dashes. Never call 4orm an "AI" company.
