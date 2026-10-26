/* Sample rows for ?fixture=mockup only. Loaded by control-room.html only when
   the fixture flag is on, so none of this ships into the live page. */
(function () {
  var D = 'done', M = 'miss', O = 'off', U = 'due', N = 'next';
  var PB_ROWS = [
    { s: 'Daily' },
    { n: 'One move', room: 'war', c: '--blue', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>2</b> days' },
    { n: '30-min video', room: 'studio', sub: 'Mon-Fri', c: '--red', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>3</b> / 5' },
    { n: "Post today’s clip", room: 'li', c: '--pink', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>4</b> / 5', nw: 1 },
    { n: 'Engage 10 min', room: 'li', sub: 'comment on 5', c: '--sky', d: [U, N, N, N, N, O, O], lab: ['0/5'], st: '<b>3</b> / 5', nw: 1 },
    { n: 'Reach out 5', room: 'pipe', c: '--green', d: [U, N, N, N, N, O, O], lab: ['2/5'], st: '<b>21</b> sent' },
    { n: 'Raise touch', room: 'spaces', sub: 'one cheque closer', c: '--gold', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>$170K</b> to go', nw: 1 },
    { n: 'Inbox zero', room: 'msg', c: '--violet', d: [U, N, N, N, N, N, O], lab: ['5'], st: '<b>4</b> days' },
    { n: 'Clear commitments', room: 'war', sub: 'after calls', c: '--orange', d: [U, N, N, N, N, O, O], lab: ['3'], st: '<b>3</b> open', nw: 1 },
    { n: 'Check 4ormIQ', room: 'iq', sub: 'launch prep → users', c: '--lime', d: [U, N, N, N, N, O, O], lab: ['7d'], st: '<b>0</b> / 1,000', nw: 1 },
    { n: 'News sweep', room: 'news', c: '--teal', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>9</b> days' },
    { n: 'Shutdown + snapshot', room: 'done', sub: '5 min', c: '--slate', d: [U, N, N, N, N, O, O], lab: ['6pm'], st: '<b>4</b> days', nw: 1 },
    { s: 'Weekly' },
    { n: 'Schedule clips', room: 'studio', sub: 'Mon', c: '--pink', d: [U, O, O, O, O, O, O], lab: ['GO'], st: 'weekly' },
    { n: 'Chase cold', room: 'contacts', sub: 'Tue', c: '--amber', d: [O, N, O, O, O, O, O], lab: ['GO'], st: 'weekly' },
    { n: 'Speer sync', room: 'team', sub: 'Wed', c: '--teal', d: [O, O, N, O, O, O, O], lab: ['GO'], st: 'weekly', nw: 1 },
    { n: 'Metrics snapshot', room: 'dash', sub: 'Thu', c: '--sky', d: [O, O, O, N, O, O, O], lab: ['GO'], st: 'weekly', nw: 1 },
    { n: 'Weekly review', room: 'dash', sub: 'Fri', c: '--white', d: [O, O, O, O, N, O, O], lab: ['GO'], st: 'weekly' }
  ];
  var ZOOM_M = [
    { wk: 'This week', m: 'OCT', d: 10, t: 'Pitch-deck edits and the suitability thesis', p: [], solo: 1, s: 'Note to self: tighten slides 6-9 around suitability; move the RPAA timeline earlier.', src: 'Granola' },
    { wk: 'This week', m: 'OCT', d: 9, t: 'Investor feedback - Jeff Tindale walks the deck', p: ['Jeff Tindale', 'Bruce Fair'], owe: 3, s: 'Veteran of ~1,000 pitch calls. 34 slides is far too heavy - condense "Why now", move the ask up.', src: 'Zoom', on: 1 },
    { wk: 'This week', m: 'OCT', d: 8, t: 'Speer Technologies review - direction, MSA, AI specialist', p: ['Keegan Poulton', 'Mathew Mozaffari', 'Zed'], owe: 2, s: 'Keegan backed the pivot; wants a named design partner before build starts.', src: 'Zoom' },
    { wk: 'This week', m: 'OCT', d: 7, t: 'Consumer / institutional / partnership life cycles with Zed', p: ['Zed'], owe: 1, s: 'Chasing introductions to UBC, Vancity and WorkSafeBC legal; user stories to visuals is slow.', src: 'Zoom' },
    { wk: 'This week', m: 'OCT', d: 6, t: 'Don Hickling weekly catch-up - framing market and crypto macro', p: ['Don Hickling'], owe: 1, s: 'Framing slowed, lots of spec inventory; open to a second cheque once F&F closes.', src: 'Zoom' },
    { wk: 'This week', m: 'OCT', d: 6, t: 'File-based orchestration and Spear design spec with Zed', p: ['Zed'], s: 'Pull logic out of the agent into folders/files; each stage output feeds the next.', src: 'Granola' },
    { wk: 'Last week', m: 'OCT', d: 5, t: 'Internal working session - deck, marketing, architecture, IP', p: ['Bruce Fair', 'Kevin Wong', 'Zed'], owe: 4, s: 'Bruce: simplify like the US reference decks; Kevin wants the GTM deck before Tuesday.', src: 'Zoom' },
    { wk: 'Last week', m: 'OCT', d: 1, t: 'Dean Hesse - wallet setup and investor-intro offer', p: ['Dean Hesse'], owe: 1, s: 'Offered intro to "Neil", ex-advisor who knows investors looking to park money.', src: 'Zoom' },
    { wk: 'Sep 28 - Oct 4', m: 'SEP', d: 30, t: 'Dean Hesse beta-tests FormIQ on the Newton exchange', p: ['Dean Hesse'], s: 'Flagged a withdrawal-refusal pattern but noted it is an allegation, not a finding.', src: 'Zoom' },
    { wk: 'Sep 28 - Oct 4', m: 'SEP', d: 29, t: 'Carmen - FormIQ demo feedback and a referral idea', p: ['Carmen R'], owe: 1, s: '"Basically a credit check on the company you are dealing with." Has a BD referral.', src: 'Zoom' },
    { wk: 'Sep 28 - Oct 4', m: 'SEP', d: 28, t: 'Deck rework and investor-outreach planning with Bruce and Kevin', p: ['Bruce Fair', 'Kevin Wong'], owe: 2, s: 'Align page one with the prior deck; "major financial decisions" lands best.', src: 'Zoom' }
  ];
  var ZREADER = {
    1: { when: 'Thu, Oct 9, 2026 · 10:00 - 10:52 am · 52 min', roles: { 'Jeff Tindale': 'angel, ex-founder', 'Bruce Fair': 'advisor' },
      said: { 'Jeff Tindale': ['34 slides is far too heavy. Condense "Why now" to one slide and move the ask to slide 3.', 'Built a software company in Brazil replacing the broker/notary arrangement with blockchain deeds - not deep in fintech himself.', 'Would look again after the F&F close; wants to see one paying design partner.'], 'Bruce Fair': ['Agrees on length; keep the suitability thesis but lead with the person and the decision.', 'Offered to dry-run the new version Friday.'] },
      summary: 'Jeff liked the thesis but lost the thread in a 34-slide deck. The fix is length and order, not substance: 15 slides, the ask on slide 3, one "Why now" slide tied to the RPAA review. He will look again after the F&F close if there is one paying design partner.',
      improve: ['You spent 9 minutes on architecture before the ask came up. Lead with the person, the decision and the ask; keep architecture for questions.', 'When Jeff pushed on traction you answered with the regulation. Answer with the pilot (Century 21 / Remax desks) first, then the rule.', 'You did not ask for a next step. Close with a dated one: "Can I send the 15-slide version Monday and get 20 minutes Thursday?"'],
      owe: [['you', 'Send Jeff the 15-slide version by Monday'], ['you', 'Book the Friday dry-run with Bruce'], ['fu', 'Ask Jeff for two angel intros once the deck is tight']],
      quotes: [['Jeff', "Nobody reads slide 20. If the ask isn't on three, it doesn't exist."], ['Bruce', 'Lead with the person and the decision, the regulation is the proof.']],
      decided: ['Cut the deck to 15 slides; ask moves to slide 3.', '"Why now" becomes one slide on the RPAA review timeline.'] }
  };

  var ZOOM_FIXTURE = [
    { id: 'fx-1', wk: 'This week', date: '2026-10-10', title: 'Pitch-deck edits and the suitability thesis', attendees: [], solo: true, others: ['tighten slides 6-9 around suitability; move the RPAA timeline earlier.'], origin: 'granola', owe: 0 },
    { id: 'fx-2', wk: 'This week', date: '2026-10-09', title: 'Investor feedback - Jeff Tindale walks the deck', attendees: ['Jeff Tindale', 'Bruce Fair'], others: ['Veteran of ~1,000 pitch calls. 34 slides is far too heavy - condense "Why now", move the ask up.'], origin: 'zoom', owe: 3, on: true, improve: ['You spent 9 minutes on architecture before the ask came up. Lead with the person, the decision and the ask; keep architecture for questions.', 'When Jeff pushed on traction you answered with the regulation. Answer with the pilot (Century 21 / Remax desks) first, then the rule.', 'You did not ask for a next step. Close with a dated one: "Can I send the 15-slide version Monday and get 20 minutes Thursday?"'], aiSummary: 'Jeff liked the thesis but lost the thread in a 34-slide deck. The fix is length and order, not substance: 15 slides, the ask on slide 3, one "Why now" slide tied to the RPAA review. He will look again after the F&F close if there is one paying design partner.', quotes: [['Jeff', 'Nobody reads slide 20. If the ask isn\'t on three, it doesn\'t exist.'], ['Bruce', 'Lead with the person and the decision, the regulation is the proof.']], decided: ['Cut the deck to 15 slides; ask moves to slide 3.', '"Why now" becomes one slide on the RPAA review timeline.'], roles: { 'Jeff Tindale': 'angel, ex-founder', 'Bruce Fair': 'advisor' }, said: { 'Jeff Tindale': ['34 slides is far too heavy. Condense "Why now" to one slide and move the ask to slide 3.', 'Built a software company in Brazil replacing the broker/notary arrangement with blockchain deeds - not deep in fintech himself.', 'Would look again after the F&F close; wants to see one paying design partner.'], 'Bruce Fair': ['Agrees on length; keep the suitability thesis but lead with the person and the decision.', 'Offered to dry-run the new version Friday.'] }, actions: [['you', 'Send Jeff the 15-slide version by Monday'], ['you', 'Book the Friday dry-run with Bruce'], ['fu', 'Ask Jeff for two angel intros once the deck is tight']] },
    { id: 'fx-3', wk: 'This week', date: '2026-10-08', title: 'Speer Technologies review - direction, MSA, AI specialist', attendees: ['Keegan Poulton', 'Mathew Mozaffari', 'Zed'], others: ['Keegan backed the pivot; wants a named design partner before build starts.'], origin: 'zoom', owe: 2 },
    { id: 'fx-4', wk: 'This week', date: '2026-10-07', title: 'Consumer / institutional / partnership life cycles with Zed', attendees: ['Zed'], others: ['Chasing introductions to UBC, Vancity and WorkSafeBC legal; user stories to visuals is slow.'], origin: 'zoom', owe: 1 },
    { id: 'fx-5', wk: 'This week', date: '2026-10-06', title: 'Don Hickling weekly catch-up - framing market and crypto macro', attendees: ['Don Hickling'], others: ['Framing slowed, lots of spec inventory; open to a second cheque once F&F closes.'], origin: 'zoom', owe: 1 },
    { id: 'fx-6', wk: 'This week', date: '2026-10-06', title: 'File-based orchestration and Spear design spec with Zed', attendees: ['Zed'], others: ['Pull logic out of the agent into folders/files; each stage output feeds the next.'], origin: 'granola' },
    { id: 'fx-7', wk: 'Last week', date: '2026-10-05', title: 'Internal working session - deck, marketing, architecture, IP', attendees: ['Bruce Fair', 'Kevin Wong', 'Zed'], others: ['Bruce: simplify like the US reference decks; Kevin wants the GTM deck before Tuesday.'], origin: 'zoom', owe: 4 },
    { id: 'fx-8', wk: 'Last week', date: '2026-10-01', title: 'Dean Hesse - wallet setup and investor-intro offer', attendees: ['Dean Hesse'], others: ['Offered intro to "Neil", ex-advisor who knows investors looking to park money.'], origin: 'zoom', owe: 1 },
    { id: 'fx-9', wk: 'Sep 28 - Oct 4', date: '2026-09-30', title: 'Dean Hesse beta-tests FormIQ on the Newton exchange', attendees: ['Dean Hesse'], others: ['Flagged a withdrawal-refusal pattern but noted it is an allegation, not a finding.'], origin: 'zoom' },
    { id: 'fx-10', wk: 'Sep 28 - Oct 4', date: '2026-09-29', title: 'Carmen - FormIQ demo feedback and a referral idea', attendees: ['Carmen R'], others: ['"Basically a credit check on the company you are dealing with." Has a BD referral.'], origin: 'zoom', owe: 1 },
    { id: 'fx-11', wk: 'Sep 28 - Oct 4', date: '2026-09-28', title: 'Deck rework and investor-outreach planning with Bruce and Kevin', attendees: ['Bruce Fair', 'Kevin Wong'], others: ['Align page one with the prior deck; "major financial decisions" lands best.'], origin: 'zoom', owe: 2 }
  ];
  var CAL_FIXTURE = {
    events: [['2026-10-02',9,10,'Zed and Chad 1on1'],['2026-10-02',12,13,'Dean and Chad'],['2026-10-02',16,17,"4orm's first investor call",'inv'],
 ['2026-10-05',9,10,'4orm Dev'],['2026-10-05',14,15,'Bruce and Chad 1on1'],['2026-10-06',11,12,'Zed and Chad 1on1'],['2026-10-06',14.75,15.5,'Kevin and Chad'],
 ['2026-10-08',15,16,'Speer and 4orm'],['2026-10-09',11.5,12.5,'Jeff intro | Bruce'],['2026-10-13',12,13,'Content Posting Run'],['2026-10-14',9,10,'Mike Stephens | Bruce'],
 ['2026-10-15',10,11,'Development End to End'],['2026-10-15',11,12,'Dean and Chad 1on1'],['2026-10-16',9.5,10.5,'Call the Fraud Prevention Centre'],
 ['2026-10-16',13,14,'Quinton and Chad'],['2026-10-16',14,15,'Kevin Zahar | 4orm','inv'],['2026-10-17',10.5,12,'Shawn and Chad | Meet at home'],['2026-10-17',14,15,'Bruce and Chad 1on1'],
 ['2026-10-19',12,13,'Chad Fournier | 4orm Investment review','inv']
],
    allDay: [['2026-10-09','Hack a thon','hol'],['2026-10-12','Thanksgiving','hol'],['2026-10-20','Marketing drop','mile'],['2026-10-23','4ormIQ launch','mile'],
 ['2026-10-30','F&F close - $250K','inv'],['2026-10-31','Newsletter + paper + update','mile']
]
  };
  window.REDESIGN_FIXTURE_C = {
    DOC_VIEW: {
      type: 'PPT', name: 'Business Overview | 4orm | 2026.pptx', sub: 'Welcome to 4orm \u00b7 14 slides',
      folder: 'Welcome to 4orm', kind: 'PowerPoint', modified: 'Oct 16', owner: 'Chad', drive: 'Synced',
      spaces: ['Neil Mitchell', 'Bruce Fair'], note: 'Note: v3 - numbers sequence fixed at the top of each slide.',
      kicker: '4ORM FINANCE \u00b7 2026', title: 'Business Overview', body: 'Suitability evidence for every financial advice conversation.',
      page: 1, pages: 14, thumbs: 6
    },
    ZOOM_FIXTURE: ZOOM_FIXTURE,
    CAL_FIXTURE: CAL_FIXTURE,
    PB_ROWS: PB_ROWS,
    ZOOM_M: ZOOM_M,
    ZREADER: ZREADER,
    CAL_EVENT: { d: '2026-10-24', s: 13, e: 14, t: 'Bruce and Chad 1on1', c: 'meet', ppl: ['Bruce Fair'], loc: ['Zoom · us06web.zoom.us/j/7783632424'], links: [], docs: ['2-pager v3.pdf'], notes: 'Walk through the revised 2-pager. Decide the wire date.' }
  };
})();
