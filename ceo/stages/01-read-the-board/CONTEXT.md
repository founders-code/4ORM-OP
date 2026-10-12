# Stage 01 · Read the board

Turn the live board into one dated snapshot of facts. No opinions here.

## Inputs
| Source | File/Location | Section/Scope | Why |
|---|---|---|---|
| Control Room | `GET /api/board` (items, links, contacts, daily_brief) | Open items only, plus items closed in the last 7 days | What is on Chad's plate |
| Calendar | Google Calendar, chad@4ormfinance.com | Next 7 days | Meetings that count as customer, investor or regulator conversations |
| Pipeline | GoHighLevel, 4orm Finance sub-account | Design Partner, Speer, regulator pipelines: stage counts and last activity | Customer and regulator motion |
| Company profile | `../../shared/company-profile.md` | Raise, Cash, People | Stable facts to compare against |
| Field map | `references/board-fields.md` | Full file | How to read each source |

## Process
1. Pull each source. If one cannot be reached, write "Unavailable" for it. Never guess.
2. Copy facts only: titles, owners, dates, amounts, stages.
3. Tag each item with its area and any principle it touches (P1 to P12).
4. Mark any fact that disagrees with `company-profile.md`. The live figure wins; flag the profile for update.

## Outputs
| File | Holds |
|---|---|
| `output/YYYY-MM-DD-snapshot.md` | Cash and raise, open items with scores' raw fields, 7-day calendar, pipeline counts, open promises, team changes, unavailable sources |

## Audit
- [ ] Every number has a source and a date.
- [ ] No sentence gives advice.
- [ ] Every unavailable source is named.
