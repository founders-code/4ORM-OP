# Stage 02 · Light the lamps

Set each of the eight lamps to Green, Amber, Red or Unknown, with the fact behind it.

## Inputs
| Source | File/Location | Section/Scope | Why |
|---|---|---|---|
| Snapshot | `../01-read-the-board/output/` | Today's file | The facts |
| Lamp rules | `../../_config/lamps.md` | Full table | Thresholds |

## Process
1. For each lamp L1 to L8, find the fact in the snapshot that decides it.
2. Apply the threshold. No fact means Unknown, never Green.
3. For each Red or Amber, write one line: what it is, and the principle it breaks.

## Outputs
| File | Holds |
|---|---|
| `output/YYYY-MM-DD-lamps.md` | Eight rows: lamp, state, deciding fact with date, principle |

## Audit
- [ ] Eight rows, no more, no less.
- [ ] Every state word is written out, not only a colour.
- [ ] Every Red names its fact.
