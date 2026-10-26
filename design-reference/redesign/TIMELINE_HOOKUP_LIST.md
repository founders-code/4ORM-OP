# Timeline - what has to hook up

Timeline takes the War Room's place. Below is everything it connects to, what changes, and what you decide.

## 1. New data (Part T1)
- Timeline items: the eight pipelines plus Milestones. Each row has a stream, owner, start, due, status, the milestone it feeds and notes.
- Dependencies ("waits on") between items.
- Your view settings: pipeline order, hidden and open pipelines, zoom, lines on or off, today's one move.
- Tasks stay in the existing task list. Each task links to its timeline item through the link field the site already has.
- Seed: the mockup's five milestones and 40 items load once. You confirm the dates after.

## 2. Clean-up (Part T1)
- Archive the 165 Gmail newsletters that were filed as tasks, and the two TEST items. Archived, not deleted.
- Stop Gmail creating tasks from newsletters and bulk mail.
- Lift the 200-task cap on the board feed.

## 3. Where each War Room part goes (Part T3)
| War Room part | Goes to |
|---|---|
| Capture bar | Timeline top, now with a "which list" picker |
| One move, 25-min focus, streak | Timeline focus bar (same timer and streak) |
| 4orm Intelligence ranked moves | First three choices in the One move picker |
| Ribbon: cash, runway, raise, days to close, 4ormIQ launch, coaching note | Dashboard (already there) |
| After your meetings | Zoom page, "You owe N" (unchanged) |
| Reach out lane | Pipeline page, "Needs you today" (unchanged) |
| Execution: Today / This week / Later | Retired. Due 7 days, Red and the list replace it |
| Signals | Top bar (unchanged) |

Routes: /war-room, /control-room and / open Timeline. The War Room code stays in the repo until you sign off.

## 4. What Timeline feeds (Part T3)
- **Morning brief and 4orm Intelligence:** red items and at-risk milestones, in your order: cash first, regulators last.
- **Calendar:** milestones (gold) and key dates on the existing Milestones layer. Click one to open it in Timeline.
- **Completed:** each day's snapshot logs items done, milestones hit and dates moved.
- **Playbook:** the One move row links to Timeline. Nothing else changes.

## 5. Your decisions
1. **Dates.** Everything past October in the seed is a placeholder. Confirm or change once it is live.
2. **Loose tasks.** After the clean-up, the real tasks left over get filed under timeline items. Claude Code shows you the list first.
3. **Other people.** Owner is a name field for now. Logins for Bruce, Kevin and Mathew come later if you want them.
4. **ClickUp.** Import your ClickUp lists into Timeline: yes or no.

## 6. Order of work
STEP 0 (copy the designs), then T1 (data and clean-up), T2 (the page), T3 (War Room retirement and hook-ups). Each part waits for all-PASS tables. After each part, check it live by clicking through it, not only by reading the tables.
