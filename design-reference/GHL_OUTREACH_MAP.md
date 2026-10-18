# 4orm outreach - everything through GoHighLevel (the map)

One rail for all outreach. A Space is a campaign; GHL is the engine that sends, tracks, and reports; the ops app is the cockpit on top.

## 1. Sending identity (set up once) - GHL sends, NOT your mailbox
- Authenticate the 4ormfinance.com domain inside GoHighLevel (SPF, DKIM, DMARC) and set chad@4ormfinance.com as the From address with Chad's signature.
- The ops website sends the email DATA to GHL via its API; GHL's own email service does the actual sending on the authenticated domain. Nothing routes through Gmail / Google Workspace.
- Result: it goes out AS Chad (From chad@4ormfinance.com, signature appended, Reply-To = Chad's inbox), tracked by GHL. Your personal mailbox is never in the path.

## 2. Contacts = GHL (source of truth)
- All recipients live in GHL, tagged by category (angel, VC, prospect, design-partner, regulator). The ops app reads them.
- A Space's recipient list is GHL contacts. Adding "from contacts" pulls from GHL.

## 3. Send from a Space
- "Send via GHL" posts the Space's email (subject + body + merge tokens {{first_name}} {{company}} + attached docs as Drive links) to GHL via API; GHL sends it 1:1 to each recipient on the authenticated domain, From chad@4ormfinance.com.
- Confirm before send - never a silent blast. Personalized per recipient via tokens + the intel on the Space.

## 4. Tracking flows BACK into the app
- GHL records delivered / opened / clicked / replied.
- The app receives these (GHL webhook, or API poll) and updates the recipient's status in the Space mini-CRM (sent -> opened -> replied) and moves the Space across the pipeline board (Sent -> Replied -> Meeting -> Committed).

## 5. Pipeline = GHL opportunities (two-way)
- Each Space/contact maps to a GHL opportunity in a stage. Dragging a Space on the board updates the GHL stage; a stage change in GHL updates the board. One pipeline, two windows.

## 6. Follow-ups + sequences
- GHL workflows handle auto follow-ups ("no reply in 3 days -> send follow-up and/or create a task").
- A follow-up also drops a task into the War Room so Chad sees it on his desk.

## 7. Reporting
- The Spaces metrics strip (ready, sent this week, opens, replies, meetings, committed $) reads from GHL stats. The raise funnel is live.

## Honest caveats
- Keep angel/investor sends 1:1 and personal (low volume) for best deliverability; GHL is strongest for the prospect/design-partner volume.
- Deliverability depends on domain auth (SPF/DKIM/DMARC) on 4ormfinance.com - a required setup step.
- Open tracking is a pixel, so it is directional (Apple Mail Privacy inflates opens); replies and clicks are the reliable signals.
- Exact GHL API endpoints depend on the plan/version; the build reads the stored GHL credential + location id (never hardcoded).

## What the build wires
- GHL send endpoint: the website POSTs the email to GHL via API; GHL sends it on the authenticated 4ormfinance.com domain (From chad@4ormfinance.com, signature appended, tokens filled, docs linked). No Gmail/mailbox in the path.
- GHL webhook/poll -> update Space recipient status + pipeline stage.
- GHL opportunities <-> Spaces board stages (two-way).
- GHL workflow trigger for follow-ups -> also create a War Room task.
- Spaces metrics read from GHL.
- Gmail stays only as an optional manual fallback (open a draft), not the default path.
