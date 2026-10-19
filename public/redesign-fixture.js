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
    },
    pipeline: {
      pills: [
        { name: 'Design partners', n: 128, on: true },
        { name: 'Investors', n: 66 },
        { name: 'Grants', n: 67 },
        { name: 'Friends & family', n: 30 },
        { name: 'Regulators & partners', n: 24 }
      ],
      more: 6,
      kpis: [
        { n: '128', label: 'opportunities', note: 'in Design partners', tone: 'nt' },
        { n: '54', label: 'sent this week', note: '+12 vs last week', tone: 'up' },
        { n: '\u2013', label: 'open rate', note: 'tracking starts next send', tone: 'nt' },
        { n: '0', label: 'replies', note: 'none yet this week', tone: 'dn' },
        { n: '9 days', label: 'average time in a stage', note: '2 stuck past 14 days', tone: 'dn' }
      ],
      funnel: [['Storage', 103], ['Cold', 21], ['1st reach out', 1], ['2nd reach out', 0], ['Contact made', 0], ['Send email', 2], ['Check back', 0], ['Call back', 1], ['Meeting booked', 0], ['Info pack sent', 0], ['Rebooked', 0], ['Meeting done', 0], ['2nd meeting', 0]],
      funnelLabel: 'Design partners \u00b7 13 stages \u00b7 click a stage to filter the list',
      needs: [
        { name: 'AMF', color: '#e0364f', meta: 'Regulator \u00b7 cold, no touch on record' },
        { name: 'ASC', color: '#2e6bf2', meta: 'Regulator \u00b7 cold, no touch on record' },
        { name: 'Alan Goff', color: '#12a36a', meta: 'Network \u00b7 cold, no touch on record' },
        { name: 'Alex Fontaine', color: '#c98408', meta: 'Network \u00b7 cold' },
        { name: 'Mary Morris', color: '#6b4fd8', meta: 'Network \u00b7 cold' }
      ],
      matrix: [
        { cat: 'Strategic', cells: [107, 3, 0, 0, 0] },
        { cat: 'Network', cells: [36, 1, 0, 0, 0] },
        { cat: 'Regulators', cells: [17, 0, 0, 0, 0] },
        { cat: 'VC', cells: [8, 2, 1, 0, 0] },
        { cat: 'Angel', cells: [1, 0, 0, 0, 0] }
      ],
      activity: [
        { text: 'CLHIA Affiliates \u2014 email sent', when: 'today', tone: '' },
        { text: 'Canadian Life and Health Insurance Association \u2014 email sent', when: 'today', tone: '' },
        { text: 'Bruce Fair \u2014 email sent', when: '1d', tone: '' },
        { text: 'Enrich Mortgage Group \u2014 moved to Send Email', when: '2d', tone: 'g' },
        { text: 'Daniel Moore \u2014 email sent', when: '3d', tone: '' }
      ],
      storageHead: '103 of 128',
      tableFoot: 'Showing 8 of 103',
      rows: [
        ['Enrich Mortgage Group', 'Mortgage Alliance', 'Strategic', 'Send email', 'warm', '2d', 'Follow up Thursday'],
        ['BrokerSquared', '', 'Strategic', 'Storage', '', '3d', 'Add to a Space'],
        ['Sukhwant Singh Samra', 'BC Best Mortgages Group', 'Strategic', 'Storage', '', '3d', 'Add to a Space'],
        ['Zaheed Valli-Hasham', 'City Wide Mortgage Services', 'Strategic', 'Storage', '', '3d', 'Add to a Space'],
        ['Geoff Lee', 'GLM Mortgage Group', 'Strategic', 'Storage', '', '3d', 'Add to a Space'],
        ['Frances Hinojosa', 'Tribe Financial', 'Strategic', 'Storage', '', '3d', 'Add to a Space'],
        ['Lisa Gryba', 'One-Link Mortgage & Financial', 'Strategic', 'Storage', '', '3d', 'Add to a Space'],
        ['Surinderjit Khamba', 'Coast to Coast Mortgage Group', 'Strategic', 'Storage', '', '3d', 'Add to a Space']
      ]
    },
    spaces: {
      stats: [
        { n: '53', label: 'spaces', cls: '' },
        { n: '2', label: 'ready to send', cls: 'blue' },
        { n: '0', label: 'sent this week', cls: '' },
        { n: '0', label: 'replies', cls: '' },
        { n: '0', label: 'meetings booked', cls: '' },
        { n: '0', label: 'committed', cls: '' }
      ],
      groups: [
        ['General', 'c-gen', 3, [['Regulator intro', 'RPAA note - independent review', 2, 'docs'], ['Friends & Family email', 'Friends and family - $25,000 for 5%', 2, 'docs'], ['Design partners', 'Design partner - brokerage discovery', 2, 'docs']]],
        ['Venture Capital', 'c-vc', 10, [['Joe Canavan', '~80% of his angel book is fintech: Wealthsimple, Borrowell, CapIntel, Homewise.', 4, 'send'], ['Neil Mitchell', 'Advises early-stage insurtech founders; backed YouSet and QuickFacts.', 4, 'docs'], ['Norm Cappell', 'North Exit Ventures invests pre-seed in insurance, lending and wealth.', 4, 'docs'], ['Daniel Moore', 'Writes $5K-$300K cheques into financial services.', 4, 'send'], ['Paul Hill', 'Backed Verafin, QuickFacts, DisclosureNet, Una - compliance and regtech.', 4, 'docs'], ['Philip Daniel', 'C-suite fintech and payments leader; sits on boards; lists angel investing.', 4, 'docs'], ['Glenn Yuen', 'Founded POPcodes (payments); VA Angels member; Invest-Tech at Innovate BC.', 4, 'docs'], ['Hanif Joshaghani', 'Built Symend, a Calgary fintech selling to banks; MIT fintech; angels in fintech.', 4, 'docs']]],
        ['Business', 'c-bus', 25, [['Tom Robertson', 'Continental Currency Exchange', 4, 'ppl'], ['Elizabeth Wood', 'CMI Canadian Mortgages Inc. (CMI Financial Group)', 4, 'ppl'], ['L\u00e9opold Beaudoin', 'Credit Bail Globale (Globale Leasing)', 4, 'ppl'], ['Rasha Katabi', 'Brim Financial Inc.', 4, 'ppl']]],
        ['Regulators', 'c-reg', 15, [['FINTRAC', 'Federal AML regulator - reach-out only', 4, 'docs'], ['Bank of Canada - RPAA', 'Retail payment supervision', 4, 'docs'], ['CSA', 'Canadian Securities Administrators', 4, 'docs'], ['BCFSA', 'BC mortgage broker regulator', 4, 'docs']]]
      ]
    },
    documents: {
      folders: [
        ['All documents', 9, true], ['Angel', 1], ['Banking', 0], ['Design partners', 2], ['Dev', 0],
        ['Dev partners', 0], ['Friends & family', 2], ['Government', 1], ['Regulators', 3]
      ],
      sets: [['Investor data room', 1], ['Regulator pack', 0], ['F&F bundle', 0]],
      files: [
        ['img', 'Welcome to 4orm | 2026.png', 'Angel \u00b7 1.2 MB', 'loc', '#dfe8ff'],
        ['ppt', 'Business Overview | 4orm | 2026', 'Design partners \u00b7 24 slides', 'ok', '#ffe6cf'],
        ['pdf', '4orm VC and Design Partner Resources', 'Investor data room \u00b7 12 pages', 'ok', '#fde9ec'],
        ['doc', 'Top incumbents', 'Research \u00b7 4 pages', 'ok', '#e1ecff'],
        ['pdf', 'RPAA note - independent review', 'Regulators \u00b7 6 pages', 'ok', '#fde9ec'],
        ['doc', 'Friends & family email', 'Friends & family \u00b7 1 page', 'loc', '#e1ecff'],
        ['xls', 'Raise tracker - F&F', 'Friends & family \u00b7 sheet', 'ok', '#e4f6ee'],
        ['pdf', 'BCFSA suitability guidance (summary)', 'Regulators \u00b7 3 pages', 'ok', '#fde9ec'],
        ['ppt', 'Design partner pilot outline', 'Design partners \u00b7 9 slides', 'loc', '#ffe6cf']
      ],
      drops: [
        { ini: 'RI', color: '#c98408', name: 'Regulator intro', meta: '0 docs' },
        { ini: 'JC', color: '#e0364f', name: 'Joe Canavan', meta: '0 docs \u00b7 send today' },
        { ini: 'NM', color: '#e0364f', name: 'Neil Mitchell', meta: '0 docs' },
        { ini: 'DM', color: '#e0364f', name: 'Daniel Moore', meta: '0 docs \u00b7 send today' },
        { ini: 'DP', color: '#2e6bf2', name: 'Design partners', meta: '2 docs' }
      ],
      recent: [
        ['t-img', 'IMG', 'Welcome to 4orm | 2026.png'],
        ['t-ppt', 'PPT', 'Business Overview | 4orm | 2026.pptx'],
        ['t-pdf', 'PDF', '4orm VC and Design Partner Resources.pdf'],
        ['t-doc', 'DOC', 'Top incumbents']
      ]
    },
    links: {
      tree: [
        { name: 'AI', n: 9, on: true, car: 'closed' },
        { name: 'Chad', n: 1, car: 'open' },
        { name: 'Company', n: 6, car: 'closed' },
        { name: 'Fund raising', n: 4, car: 'open' },
        { name: 'Data Room', n: 3, car: 'open', indent: 2 },
        { name: 'New folder', n: 0, car: '', indent: 3, noSub: true },
        { name: 'Incumbents', n: 5, car: 'closed' },
        { name: 'Market validation', n: 4, car: 'closed' },
        { name: 'Music', n: 4, car: 'closed' },
        { name: 'Notes & docs', n: 7, car: 'closed' },
        { name: 'Partners & dev', n: 7, car: 'closed' },
        { name: 'Regulation', n: 2, car: 'closed' },
        { name: 'Research', n: 1, car: 'closed' },
        { name: 'Resources', n: 2, car: 'closed' },
        { name: 'Tools & ops', n: 10, car: 'closed' },
        { name: 'VC', n: 7, car: 'closed' },
        { name: 'Validation', n: 1, car: 'closed' },
        { name: 'Uncategorized', n: 0, car: '', noHv: true }
      ],
      crumb: 'AI',
      crumbN: 9,
      wall: [
        ['Lumo', 'proton.me/lumo', '#6d4aff', 'Private AI assistant from Proton', 1],
        ['Riverside', 'riverside.fm', '#111827', 'Record the 30-min videos'],
        ['Neon', 'neon.tech', '#00a77e', 'Database for 4ormop'],
        ['Vercel', 'vercel.com', '#111827', 'Hosting + deploys'],
        ['Cursor', 'cursor.com', '#2b2b2b', 'Build the site from prompts'],
        ['Perplexity', 'perplexity.ai', '#1f6f78', ''],
        ['ChatGPT', 'chatgpt.com', '#10a37f', ''],
        ['Claude', 'claude.ai', '#d97757', 'Cowork + build prompts'],
        ['Lumo', 'proton.me/lumo', '#6d4aff', 'Same link saved twice', 2]
      ]
    },
    email: {
      need: 5, investors: 2, unread: 56, rules: 4,
      columns: [
        { icon: '&#9888;&#65039;', name: 'Needs now', count: 5, rule: 'Real people owed a reply, investors first', messages: [
          { name: 'Bruce Fair', color: '#c98408', age: '3d', subject: 'Deck \u2014 notes', preview: 'Need to tighten messaging with respect to "What is it that 4orm is providing?" Counselling\u2026', tags: [['t-rep', 'Reply'], ['t-vc', 'Investor']], unread: true },
          { name: 'Cindy J. S. \u00b7 CLHIA', color: '#0f9fb5', age: '5h', subject: 'RE: Are we a bad fit for the Affiliates Program?', preview: 'Thank you for your email. Can you provide a list of Canadian life and health insurers you currently do business with?', tags: [['t-rep', 'Reply'], ['t-reg', 'Association']], unread: true },
          { name: 'Mike Stephens', color: '#12a36a', age: '6d', subject: 'RE: 4orm Finance business overview', preview: 'That works. Please can you send an invite? Thanks Chad. All the best, Mike', tags: [['t-rep', 'Reply'], ['t-dp', 'Advisor']] },
          { name: 'Antonia Pettenon', color: '#6b4fd8', age: '5d', subject: 'RE: Invoice payment', preview: 'Okay, thank you! Antonia Pettenon, Executive Assistant to Veronica Armstrong, Law Corporation', tags: [['t-rep', 'Reply'], ['t-biz', 'Legal']] }
        ] },
        { icon: '&#128176;', name: 'Investors', count: 2, rule: 'Rule: from bruce@, don@ \u00b7 subject has "cheque"', messages: [
          { name: 'Bruce Fair', color: '#c98408', age: '21h', subject: '4orm Finance \u2013 2-pager overview', preview: 'This version may be better. Let me know your thoughts. B', tags: [['t-vc', 'Investor'], ['t-w', 'Waiting 1d']], unread: true },
          { name: 'Bruce Fair', color: '#c98408', age: '6d', subject: 'RE: Welcome to 4orm Finance | Major Financial Decisions', preview: 'Chad, please check the number sequence at the top of each slide. Thanks, B', tags: [['t-vc', 'Investor']] }
        ] },
        { icon: '&#128200;', name: 'VCs', count: 0, rule: 'Rule: sender in the VC pipeline', messages: [] },
        { icon: '&#127919;', name: 'Prospects', count: 2, rule: 'Rule: domain matches Pipeline \u203a Business', messages: [
          { name: 'Ivan Pierce', color: '#2e6bf2', age: '3h', subject: 'Settlement finality', preview: 'Hi Chad, 4orm\u2019s settlement finality work for Canadian capital markets stood out to me. I\u2019m Ivan at Tactera Digital\u2026', tags: [['t-biz', 'New'], ['t-dp', 'Prospect']], unread: true },
          { name: 'Brad Barrett', color: '#e0364f', age: '2d', subject: 'Hey Chad \u2014 credit card idea', preview: 'Hello, excited to share something we\u2019ve been building for brokers\u2026', tags: [['t-biz', 'New']] }
        ] },
        { icon: '&#129309;', name: 'Design partners', count: 0, rule: 'Rule: domain is a brokerage in Spaces', messages: [] },
        { icon: '&#128101;', name: 'Team', count: 1, rule: 'Rule: @4ormfinance.com, Speer', messages: [
          { name: 'Zed', color: '#7a86a0', age: '1d', subject: 'Spear design spec \u2014 v3', preview: 'File-based orchestration notes attached; each stage output feeds the next.', tags: [['t-biz', 'Team']] }
        ] },
        { icon: '&#128263;', name: 'Quiet', count: 48, rule: 'Bulk + notifications, auto-filed', quiet: true, messages: [
          { name: 'Upwork', color: '#7a86a0', age: '1h', subject: 'Stay visible to clients', preview: 'Your profile could be shown to more clients this week\u2026', tags: [['t-biz', 'Bulk']] },
          { name: 'Shortform', color: '#7a86a0', age: '4h', subject: 'Take this quiz', preview: 'What kind of reader are you? Find out in 2 minutes\u2026', tags: [['t-biz', 'Bulk']] }
        ] }
      ]
    }
  };
})();
