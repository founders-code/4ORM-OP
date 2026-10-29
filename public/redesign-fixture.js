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
      runway: '~1 day',
      toGo: '$170K',
      daysToClose: 11,
      nextMeet: { title: 'Dean and Chad', when: '11:00', url: 'https://us06web.zoom.us/j/7783632424' },
      lights: 11,
      sigCount: 6,
      coach: "Regulators can wait. Don't let them take a cash-first morning — drop them or give them 20 minutes after 3pm.",
      hero: {
        title: 'Call Kevin about his $25K chunk today',
        why: '$100 cash, ~1 day of runway, $170K to close. Kevin named an amount as the next private-network conversation — lock the wire date on this call.'
      },
      moves: [
        { id: 'm1', title: 'Call Kevin about his $25K chunk today', zone: 'z-cash', zoneLabel: 'Cash', one: true, why: 'The only near-term cheque that covers a ~1-day runway.', src: 'Source: cash tracker + company profile next-network list',
          steps: [
            { done: true, text: "Check Kevin's last email about the $25K", when: 'done 9:02' },
            { done: false, text: 'Open the cash tracker so the number is in front of you', act: 'Open' },
            { done: false, text: 'Call Kevin: confirm amount and wire date', act: 'Call' },
            { done: false, text: 'Log the date in Raise tracker and tell Bruce', act: 'Raise tracker' }
          ]
        },
        { id: 'm2', title: 'Send Brooks the delay-cost tally Bruce asked for', zone: 'z-raise', zoneLabel: 'Raise', why: '$500K subscription is papered separately; Brooks went dark and Chad owes him a number.', src: 'Source: commitments · Bruce Fair follow-up on Brooks' },
        { id: 'm3', title: 'Move the 2 design-partner Send-Email cards to today', zone: 'z-part', zoneLabel: 'Partners', why: '2 mortgage brokerages are in Send-Email; none reached a meeting yet.', src: 'Source: Design Partner pipeline stage counts' }
      ],
      meetingActionTotal: 8,
      reachToday: 4,
      today: {
        count: 7, more: 0,
        tasks: [
          { title: 'Widen the round past one cheque by Friday', tag: 'Investors' },
          { title: 'Send Bruce the tally of what Brooks\' delay is costing', tag: 'from Zoom · Bruce Fair' },
          { title: 'Request to join the CLHIA Affiliates Program', tag: 'Outreach' },
          { title: 'NMDA: answer Michael\'s two points, send to James', tag: 'from Zoom · Michael Stevens' },
          { title: 'Reach out to Bank of Canada about RPAA supervision', tag: 'Regulator' },
          { title: 'Reach out to CSA', tag: 'Regulator' },
          { title: 'Reach out to ASC and BCSC', tag: 'Regulator' }
        ]
      },
      week: {
        count: 2, more: 0,
        tasks: [
          { title: 'Send the Business Overview page to the CLHIA contact', tag: 'Outreach' },
          { title: 'Review the Grande Prairie Mortgage Group outreach', tag: 'Outreach' }
        ]
      },
      later: {
        count: 39, more: 37,
        tasks: [
          { title: 'Fix the failed Granola workspace payment', tag: 'Ops' },
          { title: 'Reply to "Delivering your funding round" — decide if worth it', tag: 'Investors' }
        ]
      },
      done: {
        count: 3, more: 0,
        tasks: [
          { title: "Check Kevin's last email about the $25K", tag: '9:02' },
          { title: 'Inbox zero', tag: 'Playbook · 8:40' },
          { title: "Post today's clip", tag: 'Playbook · 8:15' }
        ]
      },
      signals: {
        brain: '4orm Intelligence, 10:21: Kevin replied "wiring the $25K Thursday". Move 1 updated, raise tracker now shows 1 pending.',
        needYou: 6,
        since: '8:00',
        needs: [
          { color: '#e0364f', title: 'Inbox', count: '5 need a reply', detail: 'Bruce, CLHIA, Mike Gardner, Ashish, Bow Valley CU', dest: 'mail', go: 'Email' },
          { color: '#e0364f', title: 'Owed from meetings', count: '8 open', detail: '3 added to Today, 5 to review', dest: 'review', go: 'Review' },
          { color: '#c98408', title: 'Reach out', count: '4 today', detail: 'Kevin Wong, Joe Canavan, Enrich, BCFSA', dest: 'pipe', go: 'Pipeline' },
          { color: '#c98408', title: 'Going cold', count: '3 people', detail: 'Dean Hesse 16d, BCFSA 21d, Mench Capital 9d', dest: 'people', go: 'People' }
        ],
        news: [
          { color: '#2e6bf2', title: 'LinkedIn', count: '7 new messages', detail: 'people only, system notices hidden', dest: 'people', go: 'People' },
          { color: '#2e6bf2', title: 'Pipeline', count: '2 moved', detail: 'Bow Valley CU → Meeting booked · Enrich → Contact made', dest: 'pipe', go: 'Pipeline' },
          { color: '#12a36a', title: 'Zoom', count: 'notes ready', detail: 'Don and Chad 1on1 · 2 actions', dest: 'zoom', go: 'Zoom' }
        ],
        watch: [
          { color: '#e0364f', title: 'Raise', count: '$0 booked this week', detail: '$170K to go, 11 days', dest: 'finance', go: 'Financials' },
          { color: '#c98408', title: 'Integrations', count: '1 needs attention', detail: 'OpenAI key not set', dest: 'int', go: 'Fix' }
        ]
      }
    },
    notes: {
      counts: { all: 11, pinned: 2, todo: 2, idea: 3, person: 2, decision: 2 },
      openNote: {
        id: 'n-challenge', source: 'sticky', color: 'y', type: 'Note', pin: false,
        title: 'The Challenge',
        edited: 'Edited Oct 22, 10:24 am',
        body: 'Canadian compliance and anti-money laundering requirements are increasing obligations, penalties, and costs for financial businesses to help protect consumers. While the industry invests in technology to collect and reconstruct better evidence of suitability, a fundamental question still remains: How can a business even prove suitability when it hasn\'t established what suitable means for the person?\n\nThe solution: 4orm Finance is building integrated, counselling-centred AI tools that help consumers explore their financial goals, circumstances, potential outcomes, and short- and long-term risks, allowing them to make better-informed decisions while giving businesses a deeper understanding of what suitability means for each client.'
      },
      pinned: [
        {
          id: 'n-challenge', color: 'y', type: 'Thesis', typeCls: '', title: 'The challenge',
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
        { name: "Kevin Wong", color: "#0f8a8a", meta: "VC \u00b7 private network \u00b7 call about the $25K", kind: "reach", why: "Reach out", act: "Call" },
        { name: "Bow Valley Credit Union", color: "#c2560c", meta: "Design partner \u00b7 asked for the compliance requirements", kind: "follow", why: "Follow up \u00b7 1d", act: "Reply" },
        { name: "Joe Canavan", color: "#e0364f", meta: "VC \u00b7 angel \u00b7 email", kind: "reach", why: "Reach out", act: "Email" },
        { name: "Enrich Mortgage Group", color: "#12a36a", meta: "Design partner \u00b7 discovery call to book", kind: "follow", why: "Follow up \u00b7 3d", act: "Book" },
        { name: "Dean Hesse", color: "#6b4fd8", meta: "Advisor \u00b7 offered investor intros", kind: "cold", why: "Going cold \u00b7 16d", act: "Email" },
        { name: "BCFSA", color: "#b02a3c", meta: "Regulator \u00b7 intro meeting requested Oct 1", kind: "cold", why: "Going cold \u00b7 21d", act: "Nudge" },
        { name: "Mench Capital", color: "#c98408", meta: "Investor \u00b7 questions on the capture rate", kind: "follow", why: "Follow up \u00b7 1d", act: "Reply" },
        { name: "CLHIA Affiliates", color: "#0f6e8a", meta: "Association \u00b7 wants the insurer list", kind: "follow", why: "Follow up \u00b7 9h", act: "Reply" },
        { name: "Ashish Dhir", color: "#2a7f62", meta: "Prospect \u00b7 settlement finality", kind: "cold", why: "Going cold \u00b7 9d", act: "Reply" }
      ],
      ro: "2 moved today \u00b7 54 sent this week \u00b7 0 replies",
      board: [{"id": "fx0", "name": "Storage", "count": 103, "pipe": "", "opps": [{"id": "fx0-0", "contact": "AMF", "sub": "regulatory", "hot": false}, {"id": "fx0-1", "contact": "ASC", "sub": "regulatory", "hot": false}, {"id": "fx0-2", "contact": "Alan Goff", "sub": "network \u00b7 0d", "hot": false}, {"id": "fx0-3", "contact": "Alex Fontaine", "sub": "network", "hot": false}]}, {"id": "fx1", "name": "Cold", "count": 21, "pipe": "", "opps": [{"id": "fx1-0", "contact": "BDC Seed Venture Fund", "sub": "vc", "hot": false}, {"id": "fx1-1", "contact": "Bank of Canada RPAA", "sub": "regulatory", "hot": false}, {"id": "fx1-2", "contact": "Amy Morris", "sub": "facebook", "hot": false}]}, {"id": "fx2", "name": "1st reach out", "count": 1, "pipe": "", "opps": [{"id": "fx2-0", "contact": "Grande Prairie Mortgage Group", "sub": "broker \u00b7 5d", "hot": false}]}, {"id": "fx3", "name": "Send email", "count": 2, "pipe": "", "opps": [{"id": "fx3-0", "contact": "Enrich Mortgage Group", "sub": "design partner \u00b7 due", "hot": true}, {"id": "fx3-1", "contact": "Century 21 desk", "sub": "broker", "hot": false}]}, {"id": "fx4", "name": "Call back", "count": 1, "pipe": "", "opps": [{"id": "fx4-0", "contact": "Remax desk", "sub": "broker \u00b7 2d", "hot": false}]}, {"id": "fx5", "name": "Meeting booked", "count": 1, "pipe": "", "opps": [{"id": "fx5-0", "contact": "Bow Valley Credit Union", "sub": "credit union \u00b7 Thu 10:00", "hot": true}]}, {"id": "fxe0", "name": "2nd reach out", "count": 0, "pipe": "", "opps": []}, {"id": "fxe1", "name": "Contact made", "count": 0, "pipe": "", "opps": []}, {"id": "fxe2", "name": "Check back", "count": 0, "pipe": "", "opps": []}, {"id": "fxe3", "name": "Info pack", "count": 0, "pipe": "", "opps": []}, {"id": "fxe4", "name": "Rebooked", "count": 0, "pipe": "", "opps": []}, {"id": "fxe5", "name": "Meeting done", "count": 0, "pipe": "", "opps": []}, {"id": "fxe6", "name": "2nd meeting", "count": 0, "pipe": "", "opps": []}, {"id": "fxe7", "name": "Legal counsel", "count": 0, "pipe": "", "opps": []}, {"id": "fxe8", "name": "Not now", "count": 0, "pipe": "", "opps": []}, {"id": "fxe9", "name": "Not interested", "count": 0, "pipe": "", "opps": []}],
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
      ],
      open: {
        id: 'neil',
        name: 'Neil Mitchell',
        group: 'Venture Capital',
        ini: 'NM',
        who: 'Marsh Canada MD \u00b7 advises early-stage insurtech founders \u00b7 backed YouSet and QuickFacts',
        whoLinks: [['Marsh Canada', '#'], ['YouSet', '#'], ['QuickFacts', '#']],
        heroLinks: [{ label: 'LinkedIn', url: '#' }, { label: 'marsh.com', url: '#' }, { label: 'QuickFacts', url: '#' }, { label: 'YouSet', url: '#' }],
        source: 'VC research list, Oct 18',
        tags: [['vc', 'Venture Capital'], ['', 'Angel \u00b7 insurtech'], ['', 'Pipeline: Storage'], ['', 'Never contacted']],
        ready: '2/5',
        readyDash: '100.5 251.3',
        steps: [['d', 'Person'], ['d', 'Notes'], ['', 'Docs attached'], ['', 'Link added'], ['', 'Intro written']],
        angle: 'Neil has backed <b>QuickFacts</b>, and he spends his days on <b>insurance distribution and conduct risk</b> at Marsh. 4orm records the suitability evidence every advice conversation needs, which is the same problem QuickFacts solves, one step later. Lead with conduct risk, not AI.',
        hooks: ['+ FINTRAC fines, Oct 12', '+ OSFI on AI governance', '+ Insurer distribution angle', '+ Ask for 20 minutes'],
        to: 'Neil Mitchell',
        subject: 'Suitability evidence for insurance advice - 20 minutes?',
        intro: 'Neil - you backed QuickFacts, so you know how much of distribution risk lives in what was said in the room and never written down. We built 4orm to record that evidence automatically. Two pages attached. Worth 20 minutes next week?',
        files: [
          { sug: true, bg: '#fde9ec', kind: 'PDF', color: 'var(--red)', name: '4orm VC and Design Partner Resources.pdf', sub: 'suggested for VCs', inner: 'pg' },
          { sug: true, bg: '#fff0e6', kind: 'PPT', color: '#e36b1c', name: 'Business Overview | 4orm | 2026.pptx', sub: 'suggested for VCs', inner: 'sl', sl: 'Business Overview' },
          { sug: true, bg: 'var(--blue50)', kind: 'DOC', color: 'var(--blue)', name: 'Top incumbents', sub: 'from Documents \u203a Legal', inner: 'pg' }
        ],
        link: { host: '4ormiq.com', label: 'Try the free Suitability Readiness Check' },
        people: [{ ini: 'NM', name: 'Neil Mitchell', meta: 'Marsh Canada \u00b7 no email on file', role: 'Lead' }],
        facts: [['\u2014', 'last contact'], ['0', 'emails'], ['Storage', 'pipeline stage']],
        todos: [
          { d: true, t: 'Space created', em: 'Oct 18' },
          { d: true, t: 'Notes captured', em: 'Oct 18' },
          { d: false, t: 'Attach the 2-pager and the deck', em: '2 suggested' },
          { d: false, t: 'Add the Readiness Check link', em: '' },
          { d: false, t: 'Approve the intro, then send a test to yourself', em: '' }
        ],
        notes: 'Advises early-stage insurtech founders; backed YouSet and QuickFacts. Marsh Canada MD - deep in insurance distribution and conduct risk. Connect-on: QuickFacts is adjacent to our suitability-evidence angle in insurance.',
        saved: 'Saved \u00b7 Oct 18',
        history: [
          { ic: 'n', t: 'Notes added from the VC research list', when: 'Oct 18' },
          { ic: 'p', t: 'Added to Venture Capital \u00b7 Storage', when: 'Oct 18' }
        ]
      }
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
        ['Riverside', 'riverside.fm', '#111216', 'Record the 30-min videos'],
        ['Neon', 'neon.tech', '#00a77e', 'Database for 4ormop'],
        ['Vercel', 'vercel.com', '#111216', 'Hosting + deploys'],
        ['Cursor', 'cursor.com', '#2b2b2b', 'Build the site from prompts'],
        ['Perplexity', 'perplexity.ai', '#1f6f78', ''],
        ['ChatGPT', 'chatgpt.com', '#10a37f', ''],
        ['Claude', 'claude.ai', '#d97757', 'Cowork + build prompts'],
        ['Lumo', 'proton.me/lumo', '#6d4aff', 'Same link saved twice', 2]
      ]
    },
    email: {
      unread: 58, need: 5, colN: 2, feedTab: 'everything',
      messages: [
        { id: 1, day: 'Today', f: 'Bruce Fair', e: 'bruce@4ormfinance.com', c: '#2e6bf2', sj: 'Revised - This version may be better', pv: 'Let me know your thoughts. B', t: '47m', un: 1, att: ['2-pager v3.pdf'], tag: 'Needs reply' },
        { id: 2, day: 'Today', f: 'CLHIA Affiliates Program', e: 'affiliates@clhia.ca', c: '#0f6e8a', sj: 'RE: Are we a bad fit for the Affiliates Program?', pv: 'Hi Chad, thank you for your email. Can you provide a list of Canadian life and health insurers that you\u2026', t: '9h', un: 1, att: [], tag: 'Needs reply' },
        { id: 3, day: 'Today', f: 'Simen Ruud', e: 'simen@foundersuite.com', c: '#4a5672', sj: 'Chad\u2019s Foundersuite account', pv: 'Hi Chad, Simen here from Foundersuite\u2026', t: '10h', un: 0, att: [], tag: '' },
        { id: 4, day: 'Today', f: 'Michael Stevens', e: 'michael@example.ca', c: '#6b4fd8', sj: 'NMDA with James - next steps', pv: 'Chad, James sent over the markup. Two points I\u2019d push back on\u2026', t: '11h', un: 1, att: ['NMDA-markup.docx'], tag: '' },
        { id: 5, day: 'Yesterday', f: 'Kevin Wong', e: 'kevin@4ormfinance.com', c: '#0f8a8a', sj: 'Re: GTM outline', pv: 'Looked at it. Two edits on the broker section, then it\u2019s good.', t: '1d', un: 0, att: [], tag: '' },
        { id: 6, day: 'Yesterday', f: 'Bow Valley Credit Union', e: 'partnerships@bowvalleycu.com', c: '#c2560c', sj: 'Follow-up from Thursday\u2019s call', pv: 'Thanks for walking us through the suitability record. Our compliance lead would like to see\u2026', t: '1d', un: 1, att: ['BVCU-requirements.pdf'], tag: 'Needs reply' },
        { id: 7, day: 'Yesterday', f: 'Mike (Mench Capital)', e: 'menchcapital@telus.net', c: '#c98408', sj: 'Re: 4orm Finance - Overview for Investors', pv: 'Had a look over the weekend. A couple of questions on the capture rate\u2026', t: '1d', un: 0, att: [], tag: '' },
        { id: 8, day: 'Yesterday', f: 'TekSavvy', e: 'billing@teksavvy.com', c: '#7a86a0', sj: 'TekSavvy invoice for account 4421', pv: 'Your invoice is ready.', t: '1d', un: 0, att: ['invoice.pdf'], tag: 'Bulk' },
        { id: 9, day: 'Yesterday', f: 'Don Hickling', e: 'donhickling.dh@gmail.com', c: '#6b4fd8', sj: 'Friday 1on1 - agenda', pv: 'Three things: the raise, Kevin\u2019s path, and the regulator note.', t: '1d', un: 0, att: [], tag: '' }
      ],
      cols: [
        { id: 'c1', n: 'Raise', c: '#c2560c', from: ['bruce@4ormfinance.com', 'menchcapital@telus.net'], ids: [1, 7] },
        { id: 'c2', n: 'Regulators & associations', c: '#e0364f', from: ['affiliates@clhia.ca'], ids: [2] }
      ],
      people: {
        looseMore: 10,
        loose: [
          { n: 'Ivan Pierce', c: '#c98408', pv: 'Settlement finality: 4orm\u2019s work\u2026' },
          { n: 'Ralph Gardner', c: '#12a36a', pv: 'Re: Introduction - Thursday works' },
          { n: 'Antonia Pettenon', c: '#2b8a9a', pv: 'Re: Invoice payment' },
          { n: 'Ashish Dhir', c: '#2a7f62', pv: 'Re: Settlement finality for PSPs' }
        ],
        person08g: [
          { id: 'bf', n: 'Bruce Fair', org: '4orm Finance', role: 'Co-founder, Capital', cat: 'team', ini: 'BF', col: '#e0364f', from: 7, to: 0, files: 12, links: 3, last: '7m', owe: true, stage: '-', meet: 'Mon 26 Oct 09:00 · Weekly Kick-Off', items: 2, first: '3 Mar 2026',
            em: [['in', '4orm Finance - 2 pager', 'FYI Best regards, Bruce', '7m'], ['in', '4orm Finance - Business Overview Deck', 'FYI Best regards, Bruce', '1h'], ['in', 'Slide #1 - AML and Compliance Regulations', 'What does Canada\'s new AML and Compliance rules...', '3h'], ['out', 'Re: Pitch Deck', 'Sending the PDF version now', '1d']],
            fl: [['pdf', '4orm_Finance_-_2_Pager.pdf', '26 Oct', 'Bruce'], ['ppt', '4orm Finance - Business Overview.pptx', '26 Oct', 'Bruce'], ['pdf', '4orm Finance - 2 Pager v3.pdf', '25 Oct', 'Bruce'], ['ppt', 'Slide 1 - AML and Compliance.pptx', '25 Oct', 'Bruce'], ['img', 'image001.png', '25 Oct', 'Bruce']],
            lk: [['Canada AML rules - FINTRAC guidance', 'fintrac-canafe.canada.ca', '25 Oct'], ['Capital roadmap - data room', '4ormdr.com', '22 Oct'], ['Investor place card booking', '4ormop.com/book', '20 Oct']] },
          { id: 'mg', n: 'Mike Gardner', org: 'Mench Capital', role: 'Investor', cat: 'inv', ini: 'MG', col: '#c98408', from: 3, to: 5, files: 2, links: 1, last: '2d', owe: true, stage: 'Info pack sent', meet: 'Tue 20 Oct 12:00 · Lunch', items: 1, first: '14 Sep 2026',
            em: [['in', 'Re: 4orm Finance - Overview for Investors', 'A couple of questions on the capture rate...', '2d'], ['out', '4orm Finance - Overview for Investors', 'Base case and the three scenarios attached', '5d']], fl: [['pdf', 'Base case model.pdf', '21 Oct', 'You'], ['pdf', 'Three scenarios.pdf', '21 Oct', 'You']], lk: [['Data room', '4ormdr.com', '21 Oct']] },
          { id: 'bv', n: 'Bow Valley Credit Union', org: 'Compliance lead', role: 'Design partner', cat: 'dp', ini: 'BV', col: '#12a36a', from: 4, to: 4, files: 3, links: 0, last: '1d', owe: true, stage: 'Meeting booked', meet: 'Thu 22 Oct 10:00 · Requirements walkthrough', items: 2, first: '2 Oct 2026',
            em: [['in', 'Follow-up from Thursday\'s call', 'Our compliance lead would like to see...', '1d']], fl: [['pdf', 'BVCU-requirements.pdf', '25 Oct', 'Bow Valley']], lk: [] },
          { id: 'cl', n: 'CLHIA Affiliates', org: 'Canadian Life and Health Insurance Association', role: 'Association', cat: 'reg', ini: 'CL', col: '#6b4fd8', from: 2, to: 1, files: 0, links: 1, last: '9h', owe: true, stage: 'Contact made', meet: '-', items: 1, first: '16 Oct 2026',
            em: [['in', 'Re: 4orm introduction', 'Could you send the list of insurers?', '9h']], fl: [], lk: [['CLHIA members', 'clhia.ca', '19 Oct']] },
          { id: 'ja', n: 'James Atherton', org: 'Capiche Legal LLP', role: 'Partner, counsel', cat: 'legal', ini: 'JA', col: '#0f8a8a', from: 9, to: 8, files: 6, links: 0, last: '4h', owe: false, stage: '-', meet: 'Wed 26 Aug 11:00 · Closing agenda', items: 0, first: '2 Jul 2026',
            em: [['out', 'Updated cap table', 'Capital_Table__4orm__10242026.xlsx', '4h']], fl: [['xls', 'Capital_Table__4orm__10242026.xlsx', '26 Oct', 'You']], lk: [] },
          { id: 'li', n: 'LinkedIn', org: 'notifications-noreply@linkedin.com', role: 'Notifications', cat: 'other', ini: 'L', col: '#0a66c2', from: 24, to: 0, files: 0, links: 0, last: '7m', owe: false, stage: '-', meet: '-', items: 0, first: '-',
            em: [['in', 'Chad R, your posts got 173 impressions last week', 'Your weekly performance...', '7m']], fl: [], lk: [] }
        ],
        boxes: [
          { id: 'bf', n: 'Bruce Fair', o: '4orm Finance \u00b7 co-founder', c: '#2e6bf2', tags: ['team', 'raise'], in: 19, out: 14, files: [['P', '2-pager v3.pdf'], ['p', 'Business Overview.pptx'], ['D', 'Deck notes.docx']], more: 4, st: ['rep', 'You owe a reply'], last: '47m',
            m: [['in', 'Revised - This version may be better', 'Let me know your thoughts. B', 1], ['out', 'Re: 4orm Finance - 2 pager', 'Thanks Bruce. Looking now; I\u2019ll mark up the numbers\u2026', 0], ['in', 'Deck - Notes', 'Need to tighten messaging with respect to\u2026', 0]] },
          { id: 'ms', n: 'Michael Stevens', o: 'Advisor \u00b7 NMDA', c: '#6b4fd8', tags: ['advisor', 'legal'], in: 6, out: 5, files: [['D', 'NMDA-markup.docx'], ['P', 'Term sheet draft.pdf']], more: 0, st: ['rep', 'You owe a reply'], last: '11h',
            m: [['in', 'NMDA with James - next steps', 'Chad, James sent over the markup. Two points\u2026', 1], ['out', 'Intro: James Atherton', 'Michael, meet James, our counsel at JHA\u2026', 0], ['in', 'Re: Advisory agreement', 'Signed and attached.', 0]] },
          { id: 'bv', n: 'Bow Valley Credit Union', o: 'Design partner prospect', c: '#c2560c', tags: ['prospect', 'credit union'], in: 3, out: 4, files: [['P', 'BVCU-requirements.pdf'], ['p', '4orm for credit unions.pptx']], more: 0, st: ['rep', 'You owe a reply'], last: '1d',
            m: [['in', 'Follow-up from Thursday\u2019s call', 'Thanks for walking us through the suitability record\u2026', 1], ['out', 'Thursday 10:00 - Zoom link', 'Looking forward to it. Link below.', 0], ['out', 'Introduction | 4orm Finance', 'Kevin suggested I reach out\u2026', 0]] },
          { id: 'kw', n: 'Kevin Wong', o: '4orm Finance \u00b7 co-founder', c: '#0f8a8a', tags: ['team', 'gtm'], in: 22, out: 31, files: [['P', 'GTM outline.pdf'], ['D', 'Broker script v2.docx']], more: 9, st: ['ok', 'Up to date'], last: '1d',
            m: [['in', 'Re: GTM outline', 'Looked at it. Two edits on the broker section\u2026', 0], ['out', 'GTM outline', 'Here\u2019s the GTM outline for Wednesday.', 0], ['in', 'Re: $25K chunk', 'Talked to my guy. Let\u2019s lock the wire date\u2026', 0]] },
          { id: 'dh', n: 'Don Hickling', o: 'Executive advisor', c: '#6b4fd8', tags: ['advisor'], in: 5, out: 6, files: [['P', 'Advisor memo.pdf']], more: 0, st: ['ok', 'Up to date'], last: '1d', closed: true,
            m: [['in', 'Friday 1on1 - agenda', 'Three things: the raise, Kevin\u2019s path\u2026', 0], ['out', 'Re: Road to 4orm Finance', 'Don, here\u2019s the memo we discussed.', 0]] },
          { id: 'cl', n: 'CLHIA', o: 'Association', c: '#0f6e8a', tags: ['association', 'insurance'], in: 2, out: 2, files: [], more: 0, st: ['rep', 'You owe a reply'], last: '9h',
            m: [['in', 'RE: Are we a bad fit for the Affiliates Program?', 'Can you provide a list of Canadian life and health insurers\u2026', 1], ['out', 'Are we a bad fit for the Affiliates Program?', 'Hello, we\u2019re a Canadian suitability-evidence platform\u2026', 0]] },
          { id: 'ja', n: 'James Atherton', o: 'JHA Law', c: '#1f6f78', tags: ['legal'], in: 3, out: 3, files: [['D', 'NMDA v2.docx'], ['P', 'Engagement letter.pdf']], more: 0, st: ['wait', 'Waiting on James'], last: '2d',
            m: [['out', 'NMDA - Michael\u2019s two points', 'James, Michael pushed back on 4(b) and 7\u2026', 0], ['in', 'James - Bruce - Chad', 'Confirmed for Thursday 3:00.', 0]] },
          { id: 'mc', n: 'Mench Capital', o: 'Investor \u00b7 Mike', c: '#c98408', tags: ['investor', 'raise'], in: 2, out: 3, files: [['P', '2-pager.pdf']], more: 0, st: ['wait', 'Waiting on Mike'], last: '1d', closed: true,
            m: [['in', 'Re: Overview for Investors', 'Had a look over the weekend. A couple of questions\u2026', 0], ['out', '4orm Finance - Overview for Investors', 'Mike, hopefully you had a great holiday out East\u2026', 0]] }
        ]
      }
    },
    playbook: { weekLabel: 'WEEK 43 · OCT 19 - 25', dates: [19, 20, 21, 22, 23, 24, 25], todayIdx: 0, pct: '0%' },
    zoom: { meta: '43 meetings · synced 2 min ago' },
    completed: {}
  };
})();
