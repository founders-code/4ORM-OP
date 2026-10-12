# Board fields

## Control Room item
| Field | Values | Used for |
|---|---|---|
| title | text | The move's wording |
| area | investors, outreach, legal, dev, send, follow_up, other | Principle tag and lamp feed |
| priority | urgent, high, normal, low | Base score |
| status | open, doing, delegated, parked, done, dropped | Base score |
| due | date or empty | Overdue days, due within 3 days |

## Area to principle, first guess
| Area | Principles | Lamps |
|---|---|---|
| investors | P1, P8, P12 | L1, L2, L3, L4 |
| outreach | P2, P3 | L5 |
| legal | P5, P9; P4 only if the title names a regulator | L3, L7 |
| dev | P6, P10, P11 | L6 |
| send, follow_up | P8 | L4 |
| other | read the title | — |

## Calendar event counts as a conversation when
- An external attendee is a customer, design partner, investor or regulator, or
- The title names a brokerage, an investor or a regulator.

## GoHighLevel
- Design Partner Pipeline: batches of 25, tagged by batch. #1–25 protected.
- Speer pipeline stages: Discovery, Proposal, MSA, Second Discovery, Strategy, Review.
