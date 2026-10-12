# Stage 03 · Score the moves

Rank every open item by the board's own score plus the principle boosts.

## Inputs
| Source | File/Location | Section/Scope | Why |
|---|---|---|---|
| Snapshot | `../01-read-the-board/output/` | Today's file, open items | What to score |
| Lamps | `../02-light-the-lamps/output/` | Today's file | Red lamps become items |
| Not now marks | `../04-three-moves/output/` | Last 3 days, Not now lines | The −100 rule |
| Weights | `../../_config/weights.md` | Base score, Principle boosts | The arithmetic |
| Principles | `../../shared/principles/` | Only the files the items are tagged with, "Rule" and "Breaks when" | To judge each boost |

## Process
1. Base score per item from `weights.md`.
2. Add each principle boost that applies. Write which and why in five words.
3. Each Red lamp with no matching item: add a new item at 200.
4. Sort high to low. Keep the top 10.

## Outputs
| File | Holds |
|---|---|
| `output/YYYY-MM-DD-scored.md` | Top 10: item, base, boosts with principle numbers, total, internal or external |

## Audit
- [ ] Every boost names its principle.
- [ ] Arithmetic adds up on every row.
- [ ] Items Chad marked Not now in the last 3 days carry −100.
