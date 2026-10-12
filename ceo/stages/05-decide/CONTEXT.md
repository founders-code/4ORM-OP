# Stage 05 · Decide

Pressure-test one decision and write it down so a future reader sees why it was made.

## Inputs
| Source | File/Location | Section/Scope | Why |
|---|---|---|---|
| The question | Chad's message | Full | What is being decided |
| Latest snapshot | `../01-read-the-board/output/` | Most recent file, Cash and Raise | Live facts |
| Principles | `../../shared/principles/` | The 2 to 4 that apply, full file | Judgement |
| Playbook | `../../skills/` | Only if the decision matches one | Known moves |
| Guardrails | `../../_config/guardrails.md` | Full | Counsel routing |
| Template | `references/decision-record.md` | Full | Format |

## Process
1. Restate the decision in one line. Confirm it with Chad if unclear.
2. Lay out two or three real options, never one.
3. For each: evidence for, the case against, which principles it serves or breaks.
4. Recommend one. Say what would prove it wrong.
5. If it cannot be undone (P9), the recommendation is "take to counsel by <date>".
6. Checkpoint: Chad decides. Record his decision, not yours.

## Outputs
| File | Holds |
|---|---|
| `output/YYYY-MM-DD-<slug>.md` | One decision record, filled from the template |

## Audit
- [ ] At least two options.
- [ ] A case against the recommendation is written.
- [ ] An owner and a review date are set.
- [ ] Evidence labels on every material claim.
