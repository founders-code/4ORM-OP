# Routing

Read the task, find its row, open that stage's `CONTEXT.md`. Load nothing else until the stage asks for it.

| Chad says | Go to | Notes |
|---|---|---|
| "What's next", "my moves", the 6am brief | `stages/01-read-the-board` then 02, 03, 04 in order | The daily loop |
| "Should I…", "help me decide", any choice with money, terms or people | `stages/05-decide` | Writes a decision record |
| "Weekly review", Friday | `stages/06-weekly-review` | Needs this week's 04 and 05 outputs |
| A lamp is red, or "we're in trouble" | The matching playbook in `skills/`, then `stages/05-decide` | Cash → `skills/cash-crunch.md` |
| A quick question about how to run the company | Answer from `shared/principles/`, cite the number | No stage needed |
| Raise, investors, closing | `skills/close-the-raise.md` | |
| Customers, design partners, calls | `skills/first-ten-customers.md` | |
| Regulators, licensing, introductions | `skills/regulator-first.md` | |
| First run, or Chad changes a setting | `setup/questionnaire.md` | Rewrites `_config/` and `shared/company-profile.md` |

## Layers, and when to load them
| Layer | What | When |
|---|---|---|
| 0 | `CLAUDE.md` | Always |
| 1 | This file | On entry |
| 2 | A stage `CONTEXT.md` | Per task |
| 3 | `_config/`, `shared/`, `skills/`, stage `references/` | Only the sections a stage's Inputs table names |
| 4 | Stage `output/` | Only the records a stage's Inputs table names |

Earlier stages reach you as their output records, never as chat transcripts. Chad can edit any record before the next stage reads it. His edit wins.
