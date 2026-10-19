/* Fixture = DATA only. Same shape the page renderer reads. Never HTML.
   Parts B/C/D must follow: fixtureOn() ? REDESIGN_FIXTURE.page : liveState(). */
(function () {
  window.REDESIGN_FIXTURE = {
    navBadges: { Pipeline: '246', Integrations: '6' },
    dashboard: {
      cash: '$3,180',
      burn: 'see Financials',
      runway: '~1 day',
      raise: '$80K of $250K',
      daysToClose: 11,
      closeWhen: 'Oct 30',
      lamps: [
        { led: 'r', name: 'Runway', st: 'r', word: 'Critical' },
        { led: 'a', name: 'Raise pace', st: 'a', word: 'Behind' },
        { led: 'g', name: 'Pipeline', st: 'g', word: 'Live' },
        { led: 'a', name: 'Spend', st: 'a', word: 'Watch' },
        { led: 'a', name: 'Legal docs', st: 'a', word: 'Open' },
        { led: 'r', name: 'Concentration', st: 'r', word: 'High' },
        { led: 'g', name: 'Integrations', st: 'g', word: '6 live' }
      ],
      alerts: [
        { sev: 'r', text: 'Raise closes in 11 days — 4 of 7 cheques still open.', area: 'Raise' },
        { sev: 'a', text: '4 tasks are overdue.', area: 'Tasks' },
        { sev: 'b', text: '5 people are waiting on a reply.', area: 'Inbox' }
      ],
      cheques: [
        { cls: 'in', label: 'In' }, { cls: 'in', label: 'In' }, { cls: 'in', label: 'In' },
        { cls: 'pd', label: 'Pend' }, { cls: 'op', label: '5' }, { cls: 'op', label: '6' }, { cls: 'op', label: '7' }
      ],
      toGo: '$170K',
      bookedWeek: '$0',
      paceNote: 'Behind pace — widen the round today.',
      worries: [
        { tone: 'r', title: 'Concentration.', body: 'One friends-and-family track — one delayed cheque is the whole pace.' },
        { tone: 'r', title: 'About a day of runway.', body: 'A cheque has to land before the desk goes dark.' },
        { tone: 'a', title: 'Unsigned docs + short runway.', body: 'That pairing is what stalls a close.' }
      ],
      linkedin: [
        { name: 'Mary Njuguna', action: 'wants to connect', snippet: 'Mary, Azure AI Engineer from Freelance, is waiting for your response', age: '19h' },
        { name: 'James Keirstead', action: 'sent you a message', snippet: '1 new message awaits your response', age: '2d' },
        { name: 'Erin Oei', action: 'sent you a message', snippet: 'Hi Chad, following up on our conversation about 4orm', age: '3d' },
        { name: 'James Keirstead', action: 'wants to connect', snippet: "See James Keirstead's connections, experience and more", age: '3d' },
        { name: 'Dorian Verdier Grand', action: 'viewed your profile', snippet: 'Directeur de la Galerie d’art #1 au Canada · Montréal', age: '4d' },
        { name: 'Christian Wekam Wenego', action: 'commented on your post', snippet: '“The suitability record is the missing piece for brokers…”', age: '4d' },
        { name: 'Maélle Rome', action: 'wants to connect', snippet: 'Founder · Montréal · 3 mutual connections', age: '5d' },
        { name: 'Zachary Tristan Luheshi', action: 'sent you a message', snippet: 'Hi Chad — saw 4ormIQ, would love to compare notes', age: '6d' }
      ],
      inbox: [
        { from: 'Ivan Pierce', color: '#2e6bf2', flag: '', subject: 'Settlement finality', preview: 'Hi Chad, 4orm’s settlement finality work for Canadian capital markets stood out to me…', age: '3h' },
        { from: 'Cindy J. S. · CLHIA', color: '#0f9fb5', flag: 'rg', subject: 'RE: Are we a bad fit for the Affiliates Program?', preview: 'Thank you for your email. Can you provide a list of Canadian life and health insurers…', age: '5h' },
        { from: 'Bruce Fair', color: '#c98408', flag: 'vc', subject: '4orm Finance – 2-pager overview', preview: 'This version may be better. Let me know your thoughts.', age: '21h' },
        { from: 'Antonia Pettenon', color: '#6b4fd8', flag: '', subject: 'RE: Invoice payment', preview: 'Okay, thank you! Antonia Pettenon, Executive Assistant…', age: '5d' },
        { from: 'Mike Stephens', color: '#12a36a', flag: 'dp', subject: 'RE: 4orm Finance business overview', preview: 'That works. Please can you send an invite? Thanks Chad.', age: '6d' }
      ],
      meetings: [
        { when: 'in 38m', title: 'Dean and Chad weekly call', kind: 'join' },
        { when: 'in 3h 38m', title: 'Don and Chad 1:1', kind: 'bell-on' },
        { when: 'Tue 9:00', title: "Executive Advisor's War Room", kind: 'bell' }
      ],
      moves: [
        { title: 'Call Kevin about his $25K cheque', why: 'Lock the wire date before Friday', zone: 'z1', zoneLabel: 'Raise' },
        { title: 'Send Brooks the delay-cost tally', why: "Bruce asked for it on Thursday's call", zone: 'z2', zoneLabel: 'Raise' },
        { title: 'Move the 2 design-partner cards to Send', why: 'Century 21 + Remax broker discovery', zone: 'z3', zoneLabel: 'Partners' }
      ],
      health: {
        score: 36,
        dash: '108.6 301.6',
        bars: [
          { name: 'Cash', pct: 12, color: 'var(--red)', n: 12 },
          { name: 'Raise', pct: 34, color: 'var(--amber)', n: 34 },
          { name: 'Pipeline', pct: 72, color: 'var(--green)', n: 72 },
          { name: 'Product', pct: 30, color: 'var(--amber)', n: 30 },
          { name: 'Legal', pct: 40, color: 'var(--amber)', n: 40 }
        ]
      },
      momentum: {
        bars: [
          { h: 28, day: 'Tue' }, { h: 40, day: 'Wed' }, { h: 22, day: 'Thu' }, { h: 52, day: 'Fri' },
          { h: 36, day: 'Sat' }, { h: 58, day: 'Sun' }, { h: 70, day: 'Mon', now: true }
        ],
        desk: 154, done: 9, overdue: 4, blocked: 2
      },
      content: {
        queued: 0,
        queuedNote: 'posts queued — runs dry today',
        barPct: 4,
        cadence: '1 a day, Mon–Fri',
        newsletter: 'due in 15 days',
        nextClip: 'record today in Studio'
      }
    },
    war: {
      cash: '$3,180',
      runway: '~1 day',
      raise: '$80K of $250K',
      daysToClose: 11,
      launch: 'Oct 23',
      momentumHours: '13h open today',
      coach: "Regulators can wait. Don't let them take a cash-first morning — drop them or give them 10 minutes, then back to the one thing.",
      streak: 'Focus streak · start today',
      hero: {
        title: 'Call Kevin about his $25K chunk today',
        why: '$100 cash, ~1 day of runway, $170K to close. Kevin named an amount as the next private-network conversation — lock the wire date on this call.'
      },
      moves: [
        { title: 'Call Kevin about his $25K chunk today', zone: 'z-cash', zoneLabel: 'Cash', one: true, why: 'The only near-term cheque that covers a ~1-day runway.', src: 'Source: cash tracker + company profile next-network list' },
        { title: 'Send Brooks the delay-cost tally Bruce asked for', zone: 'z-raise', zoneLabel: 'Raise', why: '$500K subscription is papered separately; Brooks went dark and Chad owes him a number.', src: 'Source: commitments · Bruce Fair follow-up on Brooks' },
        { title: 'Move the 2 design-partner Send-Email cards to today', zone: 'z-part', zoneLabel: 'Partners', why: '2 mortgage brokerages are in Send-Email; none reached a meeting yet.', src: 'Source: Design Partner pipeline stage counts' }
      ],
      meetingActions: [
        { tag: 't-fu', tagLabel: 'Follow up', text: 'Bruce Fair on Brooks (went dark): send him a tally of what ~3–4 months of delay cost the company.', from: 'Deck rework + investor-outreach planning · Sep 28' },
        { tag: 't-fu', tagLabel: 'Follow up', text: 'The contact only "took a peek" at materials — secure a concrete next step even when a call falls apart.', from: 'Kinley Financial check-in · Sep 18' },
        { tag: 't-you', tagLabel: 'You said', text: "Follow up on all volunteered commercial structures (API, finder's fee, rev-share) with a defined use case.", from: 'Transactor settlement + compliance stack · Aug 4' },
        { tag: 't-fu', tagLabel: 'Follow up', text: 'Michael Stephens + James Atherton: NMDA with Michael, chase securities lawyer Veronica Armstrong, note incorporation.', from: 'Advisor debrief after the AI call · Aug 4' },
        { tag: 't-fu', tagLabel: 'Follow up', text: 'Michael flagged weak meeting discipline in regulator meetings — capture decisions, assign owners, follow up.', from: 'DAO / regulator strategy · Jul 28' }
      ],
      meetingActionTotal: 8,
      nextUp: [
        { when: 'in 38m', title: 'Dean and Chad weekly call', link: 'Join' },
        { when: 'in 3h 38m', title: 'Don and Chad 1:1', link: 'Prep' }
      ],
      reachChips: ['All 4', 'VC 2', 'Design partner 1', 'Regulator 1', 'Corporate 0', 'Client 0'],
      reach: [
        { name: 'Kevin Wong', meta: 'VC · private network · call' },
        { name: 'Joe Canavan', meta: 'VC · angel · email' },
        { name: 'Enrich Mortgage Group', meta: 'Design partner · discovery' },
        { name: 'BCFSA', meta: 'Regulator · reach-out only' }
      ],
      today: {
        count: 7, more: 2,
        tasks: [
          { title: 'Widen the round past one cheque by Friday', tag: 'Investors' },
          { title: 'Request to join the CLHIA Affiliates Program', tag: 'Outreach' },
          { title: 'Reach out to Bank of Canada about RPAA supervision', tag: 'Regulator' },
          { title: 'Reach out to CSA', tag: 'Regulator' },
          { title: 'Reach out to ASC and BCSC', tag: 'Regulator' }
        ]
      },
      week: { count: 0, more: 0, tasks: [] },
      later: {
        count: 41, more: 37,
        tasks: [
          { title: 'Send the Business Overview page to the CLHIA contact', tag: 'Outreach' },
          { title: 'Fix the failed Granola workspace payment', tag: 'Ops' },
          { title: 'Reply to "Delivering your funding round" — decide if worth it', tag: 'Investors' },
          { title: 'Review the Grande Prairie Mortgage Group outreach', tag: 'Outreach' }
        ]
      }
    },
    notes: {
      counts: { all: 11, pinned: 2, todo: 2, idea: 3, person: 2, decision: 2 },
      pinned: [
        {
          color: 'y', type: 'Thesis', typeCls: '', title: 'The challenge',
          body: 'Financial businesses face rising penalties and costs, and they need to construct better evidence of suitability — that every recommendation was understood and right for the person.',
          checks: [], links: [], reminder: '', convert: 'Send to content runway', pin: true
        },
        {
          color: 'p', type: 'To-do', typeCls: 'todo', title: 'Where I would start',
          body: 'The first paid feature to test is a suitability evidence review of an existing mortgage file — synthetic examples first, then real cases only under a pilot arrangement.',
          checks: [
            { done: true, text: 'Draft the review checklist' },
            { done: false, text: 'Pick 2 synthetic files' },
            { done: false, text: 'Ask Enrich Mortgage about a pilot' }
          ],
          links: ['Design partners Space'], reminder: '', convert: 'Convert to tasks', pin: true
        }
      ],
      notes: [
        {
          color: 'g', type: 'Idea', typeCls: 'idea', title: '4ormIQ: the free tool that could build our market',
          body: 'A free Suitability Readiness Check could be significantly more powerful than ads — brokers learn the BCFSA rules and we learn their gaps.',
          checks: [], links: [], reminder: 'before Oct 23 launch', convert: 'Make a launch task'
        },
        {
          color: 'b', type: 'Person', typeCls: 'person', title: 'Michael Stephens · Keegan',
          body: 'Michael wants an NMDA in place before the next session. Keegan backs the pivot but wants a named design partner before build.',
          checks: [], links: ['Michael Stephens', 'Speer'], reminder: '', convert: 'Open his Space'
        },
        {
          color: 'o', type: 'Decision', typeCls: 'dec', title: 'Build the ten capabilities in stages',
          body: 'All ten fit, but we stage them. First: suitability record, consent capture, reviewer view. Later: monitoring and integrations.',
          checks: [], links: [], reminder: 'revisit in 2 weeks', convert: 'Make a task'
        },
        {
          color: 'v', type: 'Research', typeCls: '', title: 'Drata · Aveni — what they cover',
          body: '',
          checks: [
            { done: false, text: 'Compliance readiness' },
            { done: false, text: 'Financial-services quality assurance' },
            { done: false, text: 'Automated evidence collection' },
            { done: false, text: 'Continuous control monitoring' }
          ],
          links: ['Competitors'], reminder: '', convert: 'Save to a Space'
        },
        {
          color: 'y', type: 'Decision', typeCls: 'dec', title: "Brokers must explain why it's suitable",
          body: 'Explain why an option is suitable, document the rationale and obtain written acknowledgement — this is the record 4orm produces.',
          checks: [], links: [], reminder: '', convert: 'Send to content runway'
        },
        {
          color: 'w', type: 'Positioning', typeCls: '', title: 'Initial customers',
          body: 'Canadian mortgage brokerages, lenders and financial institutions, expanding into auto finance, insurance and other regulated financial services — enterprise sales and design partnerships.',
          checks: [], links: [], reminder: '', convert: 'Add to the deck'
        },
        {
          color: 'p', type: 'To-do', typeCls: 'todo', title: 'Pipeline = GoHighLevel',
          body: '',
          checks: [
            { done: true, text: 'Categories sync both ways' },
            { done: false, text: 'Table view for every pipeline' },
            { done: false, text: 'Click a contact → opens their Space' }
          ],
          links: [], reminder: '', convert: 'Convert to tasks'
        },
        {
          color: 'g', type: 'Idea', typeCls: 'idea', title: '',
          body: 'Runway math: $170K ÷ 11 days = about $15K a day. Widen the round.',
          checks: [], links: [], reminder: 'tomorrow 9am', convert: 'Pin to dashboard'
        },
        {
          color: 'b', type: 'Person', typeCls: 'person', title: '',
          body: 'Ask Bruce who he knows at FSRA — a warm intro beats a cold email.',
          checks: [], links: ['Bruce Fair'], reminder: '', convert: 'Convert to task'
        }
      ]
    }
  };
})();
