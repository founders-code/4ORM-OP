# Scoring weights

Starting settings, not research findings. Chad changes them here or from the Control Room command bar.

## Base score
The Control Room's own rank for the item:
- Priority: urgent 100, high 70, normal 40, low 15
- Days overdue × 3, capped at 120
- +40 if due within 3 days
- +20 if status is doing
- −45 if delegated
- −60 if parked

## Principle boosts
| Item is about | Principle | Boost |
|---|---|---|
| Cash, runway or the raise | P1 | +40 |
| A promise past its date | P8 | +35 |
| A customer or design-partner conversation | P2 | +30 |
| A money record, consent or approval | P5 | +20 |
| A decision open more than 7 days | P9 | +20 |
| A regulator or a licence (reach-out only, lowest) | P4 | +5 |
| Spend not backed by cash in the bank or proof | P10 | −30 |

Regulator is deliberately the lowest boost: it is a reach-out track, never a blocker. It should not take one of the three slots unless cash, the raise, a design partner and overdue promises have nothing live.
| Signs, files or commits money and is due within 7 days | P9, guardrails | +60 |

An item can take more than one boost. Add them.

## Picking the three
1. A red lamp with no matching item creates one, scored at 200.
2. Take the highest score.
3. At most one internal task in the three.
4. At least one move faces a customer, an investor or a regulator.
5. Anything that signs, files or commits money and is due within 7 days takes a slot, written as "Take <item> to counsel by <date>", never "Sign".
6. No two moves from the same principle. If two tie, take the earlier principle in `CLAUDE.md`'s order.

## Not now
An item Chad marks Not now drops by 100 for 3 days, then returns at its normal score. Its reason goes to the decision log.
