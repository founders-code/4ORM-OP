const DATA = {
  updated: "June 7, 2026",
  overallPct: 37,
  overallNote: "Roughly a third of the way to an operating, regulated exchange - and moving every week. Capital-efficient by design: a $44K founding cheque has already produced an estimated $111K-$264K of finished, secured value (2.6-6.3× per $1). Well ahead of a typical pre-seed on product proof, web presence, advisory bench, and institutional pipeline; on-par-to-early on closing capital and on regulatory filings. The list below is the receipts: what's done, what's underway now, and what's next, in every workstream.",

  /* ███ CAPITAL IN, VALUE OUT ███ - shown under the pipelines on the overview page. */
  capitalValue: {
    asOf: "May 2026",
    lead: "A founding investor committed $50,000; $44,000 is in to date. Against roughly $42,000 deployed, we have produced and secured an estimated $111,000 - and as much as $264,000 - in finished assets and professional value.",
    stats: [
      { k:"$44K",      l:"Founding capital received to date (of $50K committed)" },
      { k:"~$42K",     l:"Capital deployed" },
      { k:"$111-264K", l:"Value delivered & secured" },
      { k:"2.6-6.3×",  l:"Value per $1 deployed" }
    ],
    groups: [
      { title:"Built in-house - cost avoided", rows:[
        { item:"Websites - 3 sites", detail:"~80-100 pages across kcs-capital.com, 4ormfinance.com & 4ormex.com; 250+ design iterations.", cons:"$30,000", head:"$96,000" },
        { item:"Pitch deck", detail:"Finalized investor pitch deck, designed and built in-house.", cons:"$3,000", head:"$8,000" },
        { item:"Financial model, pro forma & cap table", detail:"Finalized cap table and financial models.", cons:"$5,000", head:"$15,000" },
        { item:"Market & regulatory research", detail:"16-page Runway Briefing, case studies, RWA market & Canadian regulatory research.", cons:"$8,000", head:"$25,000" },
        { item:"Sourcing data & pipeline", detail:"442 verified records - 191 institutional CEO direct contacts, 81 VC contacts, 170 grants.", cons:"$9,000", head:"$25,000" }
      ], subtotal:{ label:"Subtotal - built in-house", cons:"$55,000", head:"$169,000" } },
      { title:"Professional services secured - pro bono / in-kind", rows:[
        { item:"Capital-markets advisory", detail:"Bruce - embedded advisor (~4 months); sourced both law firms. $8,000/mo.", cons:"$32,000", head:"$50,000" },
        { item:"Technical architecture", detail:"Zed Zendila - 80+ hrs; 3 architecture overviews + 30/60/90-day roadmap.", cons:"$16,000", head:"$28,000" },
        { item:"Securities counsel", detail:"Osler + Fasken - 4+ hrs senior counsel, $0 billed; equity offer outstanding.", cons:"$2,800", head:"$4,800" },
        { item:"CFA audit", detail:"Miika - audited pro forma, models & case studies; eligible CCO.", cons:"$5,000", head:"$12,000" }
      ], subtotal:{ label:"Subtotal - pro bono / in-kind", cons:"$55,800", head:"$94,800" } }
    ],
    total: { label:"Total value delivered & secured", cons:"$110,800", head:"$263,800" },
    foot: "The one-line version for the board: we took $44K and turned it into a finished, credible company - websites, a deck, an audited model, an embedded advisor, an architect, two top-tier law firms and two banks at the table - conservatively worth about 2.6× the cheque, and plausibly more than 6×. Value estimates are illustrative judgment calls based on quotes received and standard market rates (website ~$1,200/page; Bruce $8,000/mo; Zed fractional-CTO rates $200-$350/hr; sourcing data at ZoomInfo-class rates) - not invoiced amounts. Source: KCS finance tracker, May 2026."
  },

  /* ███ WEEKLY WINS ███  - add one line each week. Newest first.
     date "YYYY-MM-DD". vertical = a vertical id (for the colored tag). */
  wins: [
    { date:"2026-06-07", vertical:"bd",        text:"Education go-to-market adopted: a build-phase revenue bridge that warms the same institutional pipeline the exchange needs, stress-tested with the founding team and held out of the base-case model as upside and OpEx relief." },
    { date:"2026-06-07", vertical:"product",   text:"Expansion revenue surface mapped: eleven tokenizable asset classes the exchange is built to list (stablecoins, sovereign and sub-sovereign debt, gold and commodities, real estate, private credit, carbon, infrastructure, equities, technology-linked, education), each with sourced market sizing and fee mechanics." },
    { date:"2026-06-07", vertical:"legal",     text:"Corporate structure papered: multi-entity HoldCo / Marketplace / Exchange / Trust Co designed to the CIRO custody-separation requirement, with the Mission Anchor drafted as benefit-company provisions for BCBCA incorporation." },
    { date:"2026-06-07", vertical:"capital",   text:"Capital Structure Memorandum finalized: $10M pre-money / $3M unit offering, tiered super-voting cap table with 10-year sunset, reverse-vesting and clawback framework, benchmarked to Osler 2025 and Canadian dual-class precedent." },
    { date:"2026-06-07", vertical:"legal",     text:"Governance set: Decision Matrix mapping every material decision across five tiers, Mission Stewardship Trustee role (BCBCA s.137), and a CEO Commitment Statement binding the founder to the Mission Anchor personally." },
    { date:"2026-06-07", vertical:"marketing", text:"Investor collateral completed: 31-page white paper, 9-page executive summary, and an investor 2-pager; full institutional data room live and organized for diligence." },
    { date:"2026-06-03", vertical:"capital",   text:"Pre-seed round set at $3M, opening August 1, 2026." },
    { date:"2026-06-03", vertical:"product",   text:"Architect (Zed) onboarded into ClickUp + Drive; architecture review advanced toward the execution-ready pack." },
    { date:"2026-06-02", vertical:"team",      text:"First discovery meeting with Martin Hack - Silicon Valley CTO and technology expert - who mentioned he already has a team ready to assemble." },
    { date:"2026-06-02", vertical:"legal",     text:"Initial Coin Offering (ICO) strategy development in place." },
    { date:"2026-06-02", vertical:"investors", text:"Neo Financial cultivation in progress; Digital Commodities meeting being set up." },
    { date:"2026-06-02", vertical:"capital",   text:"Cap table finalized with the CFO - $10M valuation, 20M shares @ $0.50, ~10% dilution; two raise scenarios modeled." },
    { date:"2026-06-01", vertical:"bd",        text:"Go-to-market strategy completed; institutional outreach first batch of 10 launched." },
    { date:"2026-06-01", vertical:"investors", text:"Accredited-investor network identified - up to 12,000 international accredited investors." },
    { date:"2026-06-01", vertical:"product",   text:"LayerZero Phase-3 interoperability reviewed (80% cross-chain share, mint-and-burn OFT model) - confirmed as an optional adapter, not a dependency." },
    { date:"2026-05-31", vertical:"capital",   text:"\"Capital In, Value Out\" board summary produced - $44K in → $111K-$264K value delivered & secured (2.6-6.3× per $1)." },
    { date:"2026-05-31", vertical:"marketing", text:"16-page Runway Briefing produced for founding investors." },
    { date:"2026-05-30", vertical:"capital",   text:"Raise revised upward - valuation reset to $10M, target increased." },
    { date:"2026-05-29", vertical:"product",   text:"Institutional architecture validated - 7.5/10 architecture fit, 8.5/10 strategic fit (Zed review)." },
    { date:"2026-05-27", vertical:"marketing", text:"SEO program kicked off with Ming for 4orm Finance and the Canadian go-to-market strategy." },
    { date:"2026-05-25", vertical:"product",   text:"Major upgrade to the institutional demo - compliance workflow, transaction simulator, savings breakdown." },
    { date:"2026-05-19", vertical:"bd",        text:"ATB Financial relationship opened - primary contacts established; 4orm flagged internally as a client of interest." },
    { date:"2026-05-08", vertical:"legal",     text:"Three-firm legal structure locked - Capiche (corporate), CFA (TFSA/RRSP trust), Fasken (securities)." },
    { date:"2026-05-07", vertical:"capital",   text:"Angel investor's $50K finalized into 200,000 shares (1%); our first pre-seed investor's $250K will be the first tranche of the $3M pre-seed raise." },
    { date:"2026-05-04", vertical:"legal",     text:"Selected Capiche over Osler for corporate setup - ~$85K (≈70%) legal-cost reduction while keeping TFSA/RRSP eligibility." },
    { date:"2026-05-04", vertical:"investors", text:"Neo Financial founders (Skip the Dishes exit) added to the pre-seed pipeline via a warm intro." },
    { date:"2026-04-27", vertical:"team",      text:"Advisory council assembled - Bruce Fair (30-yr VC), Mike Andrews (ex-SWIFT/Morgan Stanley), Michael Stevens (Fasken), Zed (architect)." },
    { date:"2026-04-27", vertical:"grants",    text:"170+ grant programs identified (16 Canada-specific) - sourced directly rather than paying a facilitation fee." },
    { date:"2026-04-27", vertical:"bd",        text:"Institutional database built - 191 contacts across ~100 institutions; BD pipeline stages defined." },
    { date:"2026-04-27", vertical:"investors", text:"VC pipeline compiled - 81 Canadian + international VC contacts with check sizes and decision-makers." },
    { date:"2026-04-24", vertical:"capital",   text:"Financial pro forma completed and CFA-audited; pipeline/timeline tracking system built across all workstreams." },
    { date:"2026-04-24", vertical:"product",   text:"ClickUp + Google Drive rebuilt to scale for a 66-person org, with autonomous agents deployed across operations." },
    { date:"2026-04-22", vertical:"product",   text:"Four high-end websites deployed." },
    { date:"2026-04-22", vertical:"team",      text:"Mike Andrews (original dev lead for the SWIFT network) joined as advisor after a rigorous vetting session." },
    { date:"2026-04-08", vertical:"capital",   text:"Legal + financial modeling session with Miika & Bruce - early cap structure and pro forma groundwork." },
    { date:"2026-03-30", vertical:"team",      text:"Three KCS Advisory Council calls held - monthly cadence established." },
    { date:"2026-03-26", vertical:"product",   text:"Build partner vetted - Spear Technologies intro (netcoins / SIX Digital exchange experience); $211K-317K phased, full IP ownership." },
    { date:"2026-03-23", vertical:"legal",     text:"Securities framework scoped with counsel - $3-4M pre-seed via SAFE, super-voting governance, BC vs AB jurisdiction decision." },
    { date:"2026-03-21", vertical:"capital",   text:"Earliest documented strategy working session - the foundation the raise and structure were built on." }
  ],

  verticals: [
    /* 1 ---------------------------------------------------------- */
    {
      id:"product", name:"Product & Engineering", short:"Product",
      pct:24, stage:"Architecture & Discovery · Phase 1→2 of 6",
      benchmark:{level:"ahead", note:"<b>Ahead of the typical pre-seed on artifacts, behind on shipped code.</b> Most pre-seed teams have neither a full institutional architecture nor a working interactive demo - 4orm has both, plus a scaled ops backend. The production MVP build has not started, so the platform itself is still early - by design, it's sequenced behind the pre-seed close."},
      checkpoints:[
        {state:"done", t:"30/60/90 technical discovery + 12-month plan", d:"End-to-end architecture aligned to settlement, issuance, custody, compliance; phased delivery model."},
        {state:"done", t:"Institutional architecture v1 (Zed)", d:"Layered model: canonical ledger of record, compliance engine, token registry, treasury controls, settlement finality (DvP), interoperability abstraction layer; ~7 modules."},
        {state:"done", t:"40 user stories defined", d:"Agile backbone: requirements → test cases → user guide."},
        {state:"done", t:"Architecture validated", d:"Scored 7.5/10 architecture fit and 8.5/10 strategic fit (Zed review, May 29)."},
        {state:"done", t:"Interactive institutional demo live", d:"Simulates 191 institutions on real public financials; KYC/AML/settlement sim + savings calculator (~3.3s settlement finality vs ~1.3-day legacy)."},
        {state:"done", t:"Four high-end websites deployed", d:"KCS, 4orm Finance, 4ormEx, and the demo exchange - built in-house for a few hundred dollars of credits."},
        {state:"done", t:"Ops backend rebuilt to scale", d:"ClickUp + Google Drive restructured for a 66-person org with automated document routing; CRM, Sales Navigator, ZoomInfo deployed."},
        {state:"done", t:"Build partner shortlisted", d:"Spear Technologies (~$211K-317K quote; netcoins / SIX Digital exchange experience) preferred over ChainUp; Finhaven (holds BCSC exemptive relief) a partner candidate."},
        {state:"active", t:"Architecture finalization", d:"~90-day target to an execution-ready pack for partners, regulators, and engineering."},
        {state:"active", t:"Insurance layer + agentic design", d:"Insurance identified as the 4th component (smart-contract policy validation); multi-agent compliance automation."},
        {state:"active", t:"Education platform concept - in discovery", d:"White-label SaaS backed by a 46-expert network - a non-dilutive revenue stream; in discovery."},
        {state:"active", t:"Custom data room build", d:"On the KCS site (Google + Microsoft login), replacing the Drive-based room."},
        {state:"todo", t:"Engage CTO → discovery → hackathon MVP", d:"4-6 week discovery then a focused MVP build with a design-partner bank."},
        {state:"todo", t:"MVP build (deposit-token pilot)", d:"Canada's first tokenized deposit flow as the MVP candidate; 6-12 months."},
        {state:"todo", t:"Sandbox + ATB bank pilot", d:"Regulator-aligned sandbox deployment (Phase 5)."},
        {state:"todo", t:"LayerZero Phase-3 interoperability", d:"Optional cross-chain adapter - not required for the Alberta pilot or provincial scale."},
        {state:"todo", t:"Production hardening", d:"Security audits, multi-bank governance; full product to market in 18-24 months."}
      ],
      facts:[
        "Lead architect: <b>Zed</b> (80+ hrs, building for equity)",
        "Settlement finality: <b>~3.3-9s</b> vs legacy 1.3-3 days",
        "Web build value: <b>$30K-96K</b> built in-house",
        "Build quote: <b>Spear Tech ~$211-317K</b>",
        "LayerZero = Phase-3 adapter, <b>not</b> core",
        "Full product to market: <b>18-24 months</b>"
      ],
      links:[{label:"institutional demo · 4ormedc.com ↗", url:"https://www.4ormedc.com"},{label:"4ormex.com ↗", url:"https://4ormex.com"}]
    },
    /* 2 ---------------------------------------------------------- */
    {
      id:"compliance", name:"Compliance & Regulatory", short:"Compliance",
      pct:18, stage:"Pathway defined · filings ahead",
      benchmark:{level:"onpar", note:"<b>On-par, with an early-engagement edge.</b> The regulatory pathway is mapped across all four bodies and the team is already in the room with regulators (CSA Calgary event + private dinner) - unusual this early. And the regulatory rails are forming in the same window: CIRO published its Digital Asset Custody Framework in Feb 2026 and federal stablecoin legislation is expected. But no sandbox application or registration has been filed yet."},
      subs:[{name:"CIRO (custody framework, Tier-2 target)", pct:28},{name:"CSA (NI 45-106 / 31-103 / 21-101)", pct:25},{name:"OSFI (banking controls / sandbox)", pct:18},{name:"FINTRAC (MSB - not yet started)", pct:5}],
      checkpoints:[
        {state:"done", t:"Full regulatory mapping", d:"CSA, OSFI, CIRO, FINTRAC, PFMI, PIPEDA, ISO 27001 mapped to the architecture."},
        {state:"todo", t:"MSB registration (FINTRAC)", d:"Money Services Business registration - not yet started."},
        {state:"done", t:"Three-entity structure mapped", d:"HoldCo / OpCo / CustodyCo per the CIRO Digital Asset Custody Framework (Tier-2 target)."},
        {state:"done", t:"Securities counsel engaged (2 firms)", d:"Michael Stevens / Fasken (offered to work for equity) + Matthew / Osler (published on tokenization legal architecture)."},
        {state:"done", t:"Prior compliance discovery sourced", d:"~$12M of pre-existing exchange compliance/legal discovery available via Fasken for an update fee."},
        {state:"done", t:"Competitive/regulatory intel", d:"Mapped Broadridge, VersaBank, ChainUp; tracked CSA Project Tokenization + BoC Project Samara."},
        {state:"done", t:"In the regulator room", d:"Inside the CSA Calgary tokenization event with the Bank of Canada, Scotiabank, TD and LayerZero present; private dinner with senior regulators on supervision gaps."},
        {state:"active", t:"CSA / CIRO pre-clearance research", d:"Mapping the registration pathway before formal filings."},
        {state:"active", t:"Compliance review w/ Michael Stevens", d:"Run by Miika (CFA, CCO-eligible) alongside Fasken."},
        {state:"active", t:"Hybrid onshore/offshore structuring", d:"Canadian ops onshore (+ SR&ED credits); offshore the components not yet viable in Canada."},
        {state:"todo", t:"OSFI / CSA / FINTRAC sandbox application", d:"Targeted Q3 2026."},
        {state:"todo", t:"CAMLO sign-off (ATB onboarding)", d:"Final AML approval in the ATB banking relationship."},
        {state:"todo", t:"Registration & approvals", d:"Regulator review (Phase 5) → production supervision model (Phase 6)."}
      ],
      facts:[
        "MSB / FINTRAC: <b>not yet started</b>",
        "Structure: <b>HoldCo / OpCo / CustodyCo</b> (CIRO Tier-2)",
        "Counsel: <b>Fasken</b> + <b>Osler</b> (2 top-tier firms)",
        "CIRO custody framework: <b>published Feb 2026</b>",
        "Sandbox application target: <b>Q3 2026</b>",
        "Context: <b>no central RWA marketplace</b> in Canada yet"
      ]
    },
    /* 3 ---------------------------------------------------------- */
    {
      id:"capital", name:"Capital & Pre-Seed Raise", short:"Pre-Seed",
      pct:45, stage:"Round structured · $3M Pre-Seed · opens August 1, 2026",
      benchmark:{level:"onpar", note:"<b>On-par for an opening pre-seed - but unusually capital-efficient.</b> Terms, valuation, cap table and a CFA-audited model are set, with real soft commitments in hand. The founding $44K has already produced $111K-$264K of secured value (2.6-6.3× per $1). The round is not yet formally open: the $3M Pre-Seed opens August 1, 2026."},
      checkpoints:[
        {state:"done", t:"Investor-ready model + pro forma (CFA-audited)", d:"Built with Miika (CFA) and backed as valid & correct; dilution scenarios for multiple raise sizes."},
        {state:"done", t:"Cap table finalized", d:"$10M valuation, 20M shares @ $0.50, ~10% dilution; warrant strategy to absorb raise uncertainty."},
        {state:"done", t:"Three-class share structure defined", d:"Class A common voting, Class B founder super-voting (sunset), and investor voting-preferred with revenue-based redemption (10-15% of revenue)."},
        {state:"done", t:"$50K bootstrap / angel investment secured", d:"Founding cheque of $50K committed ($44K received to date); ~$42K deployed across legal, build, advisory and ops."},
        {state:"done", t:"First pre-seed tranche secured", d:"Our first pre-seed investor's $250K - the first tranche of the $3M raise."},
        {state:"done", t:"Third-party submission & reporting secured", d:"External submission and reporting in place for the raise."},
        {state:"done", t:"Capiche Capital retained", d:"$10K retainer; financing platform + subscription docs."},
        {state:"done", t:"Pitch deck built", d:"Finalized institutional pitch deck."},
        {state:"active", t:"Round sized at $3M", d:"Valuation $10M; $3M Pre-Seed confirmed as the build scope firmed up."},
        {state:"active", t:"Alberta incorporation (ABCA)", d:"Incorporated in Alberta; TFSA/RRSP eligibility being set up; investor subscription in process."},
        {state:"active", t:"Subscription documents", d:"Drafting via Capiche."},
        {state:"todo", t:"Formally open the $3M pre-seed round", d:"Opens August 1, 2026, once docs land."},
        {state:"todo", t:"Final pitch deck v2.0 + investor ROI section", d:"Refreshed with the revised valuation."},
        {state:"todo", t:"Close pre-seed", d:"Target 30-60 days."}
      ],
      facts:[
        "Target: <b>$3M</b> · Opens August 1, 2026",
        "Valuation: <b>$10M</b>",
        "Committed: <b>$50K</b> angel ($44K in) + <b>$250K</b> 1st pre-seed",
        "Capital efficiency: <b>2.6-6.3×</b> per $1 ($111-264K value)",
        "Vehicle: <b>Alberta corporation</b> (ABCA)",
        "Close target: <b>30-60 days</b>"
      ]
    },
    /* 4 ---------------------------------------------------------- */
    {
      id:"grants", name:"Grants & Non-Dilutive", short:"Grants",
      pct:20, stage:"Programs identified · advisory secured · applications next",
      benchmark:{level:"ahead", note:"<b>Ahead on identification, early on execution.</b> Most pre-seed companies ignore non-dilutive funding entirely; 4orm has mapped a large grant pipeline and secured a grant advisor. Applications have not yet been submitted or won."},
      checkpoints:[
        {state:"done", t:"Grant landscape compiled", d:"170+ programs identified (16 Canada-specific), incl. NRC IRAP, Creative Destruction Lab, Elevate IP, SR&ED, Alberta productivity/export programs, blockchain incubators."},
        {state:"done", t:"Grant advisory secured (GetUpgraded)", d:"$1M+ in grants identified over 3 years with a 5× ROI guarantee."},
        {state:"active", t:"Prioritizing fastest-fit programs", d:"MyDax and SR&ED flagged as the quickest first applications; free matchmaking underway."},
        {state:"todo", t:"Submit first applications", d:"File the top-priority programs."},
        {state:"todo", t:"Secure first non-dilutive grant", d:"Offset opex and reduce dilution."}
      ],
      facts:[
        "Programs identified: <b>170+</b> (16 Canada-specific)",
        "Identified value: <b>$1M+</b> over 3 yrs",
        "Advisor: <b>GetUpgraded</b> secured (5× ROI guarantee)",
        "First filings: <b>MyDax, SR&ED</b>",
        "Submitted to date: <b>0</b>",
        "Purpose: offset opex, <b>reduce raise size</b>"
      ]
    },
    /* 5 ---------------------------------------------------------- */
    {
      id:"bd", name:"Business Development & GTM", short:"BD & GTM",
      pct:30, stage:"GTM complete · ATB live · outreach launching",
      benchmark:{level:"ahead", note:"<b>Well ahead of a typical pre-seed.</b> A mapped 191-institution target list, named contacts inside the majors, a completed GTM strategy, and two regulated deposit-takers leaning in (ATB asking for a second meeting; Bow Valley met) are rare this early. The bank relationships run the 'right' way - institutions are pulling, not being pushed. The gap is conversion - no signed MOU or pilot yet."},
      checkpoints:[
        {state:"done", t:"191 Canadian FIs mapped", d:"CEO/CTO/CFO/CRO contacts + scraped financials, scored into 4 priority waves (A-D)."},
        {state:"done", t:"442-record sourcing database", d:"191 institutional CEO direct contacts + 81 VC contacts + 170 grants - verified and organized in ClickUp."},
        {state:"done", t:"Go-to-market strategy completed", d:"Institutional GTM playbook finalized."},
        {state:"done", t:"BD pipeline stages defined", d:"Outreach → Attempted → Contact Made → Qualified, tracked in ClickUp under each institution."},
        {state:"done", t:"90-day ABM outreach engine (v4)", d:"3-touch: LinkedIn research DM → day-7 email (Sam) → 45-min call with Chad; 42 user personas mapped."},
        {state:"done", t:"Sales / education tool decision", d:"The interactive demo is the funnel asset - show understanding, book exec calls (not a passive audit)."},
        {state:"done", t:"ATB relationship opened", d:"Named contacts (Ali Syed, Jonathan Rizzo ex-Kraken, + C-suite); ATB flagged 4orm internally as a client of interest; first meeting held."},
        {state:"done", t:"Bow Valley Credit Union met", d:"Second regulated deposit-taker engaged; Brett (BVCU) interested in tokenized deposits."},
        {state:"done", t:"Handshakes at the CSA Calgary event", d:"Met StableCorp, Oak Creek Capital and the Samara Project; in the room with BoC, Scotiabank, TD and LayerZero."},
        {state:"active", t:"Institutional outreach - first batch of 10", d:"Testing the ABM sequence before scaling."},
        {state:"active", t:"ATB second meeting / tokenized deposits", d:"ATB asked to go deeper and explore tokenized deposits with us."},
        {state:"active", t:"ATB due-diligence package", d:"Corporate docs, cap table, deck, MSB registration (pending), transaction-flow, vendor list - due within 4 weeks."},
        {state:"active", t:"3-step pilot validation", d:"Validate operations → technical build → market with pilot banks before pitching."},
        {state:"todo", t:"Launch full outbound", d:"Scale across the 191 after the test batch."},
        {state:"todo", t:"5 pilot banks → case studies", d:"Named targets include ATB and Bow Valley; dev-partner model (~$500K buy-in)."},
        {state:"todo", t:"Secure 3 institutional MOUs", d:"Primary near-term GTM goal."}
      ],
      facts:[
        "Institutions mapped: <b>191</b> (191 CEO direct contacts)",
        "Deposit-takers leaning in: <b>ATB + Bow Valley</b>",
        "ATB account opening: <b>1-3 months</b>",
        "Pilot target: <b>5 banks</b>",
        "Open lane: <b>no central RWA marketplace</b> in Canada",
        "Near-term goal: <b>3 MOUs</b>"
      ]
    },
    /* 6 ---------------------------------------------------------- */
    {
      id:"marketing", name:"Marketing & Web", short:"Marketing",
      pct:80, stage:"Built & live · launch, SEO & content engine remaining",
      benchmark:{level:"ahead", note:"<b>Far ahead of a typical pre-seed.</b> Four live web properties, an interactive institutional demo, a brand system, a 22-brief content library and a 16-page investor Runway Briefing exceed what most companies have at Series A - built in-house for a fraction of agency cost. Remaining work is the ongoing SEO/content engine, the budget/roadmap, and PR, not the build."},
      checkpoints:[
        {state:"done", t:"Brand kits finalized", d:"KCS Capital + 4orm Finance brand systems, stored in the shared drive."},
        {state:"done", t:"Four web properties live", d:"kcs-capital.com, 4ormfinance.com, 4ormex.com + the institutional demo (~80-100 pages, 250+ design iterations)."},
        {state:"done", t:"Institutional sales tool (pitch deck) live", d:"Interactive demo + investor pitch deck used as the institutional sales tool - 4ormedc.com (4orm education)."},
        {state:"done", t:"Positioning locked", d:"KCS = \"Canada's leading research & advisory firm\"; 4orm = the separate exchange entity (deliberate regulatory separation)."},
        {state:"active", t:"Landing video + LinkedIn rebuild - in process", d:"Company page rebuild and landing video underway; founders updating profiles with affiliation."},
        {state:"done", t:"ClickUp Command Center + CRM", d:"Pipeline/tasks separation, contact directory."},
        {state:"done", t:"22 research briefs published", d:"KCS Briefs library; voice narration added."},
        {state:"done", t:"16-page Runway Briefing produced", d:"Single-view investor progress briefing across all seven lanes of work."},
        {state:"done", t:"Foresights live", d:"Foresight content series live and public-facing."},
        {state:"active", t:"Brand / logo redesign", d:"Shifting to institutional blues/greens (away from crypto purple/gold)."},
        {state:"active", t:"Marketing budget", d:"Phase-based budget being finalized (~$200K phase one)."},
        {state:"active", t:"Marketing roadmap / timeline", d:"Sequencing the campaign calendar - in progress."},
        {state:"active", t:"LinkedIn content strategy", d:"Primary social channel content plan - in progress."},
        {state:"active", t:"Email marketing strategy", d:"Newsletter + nurture sequences - in progress."},
        {state:"active", t:"SEO engagement (Ming)", d:"Discovery/audit; dual-track KCS (C-suite) + 4ormEx (volume); plan 4-8 briefs/month."},
        {state:"active", t:"Data audit for personalized pages", d:"Auditing bank-specific financials before they go live."},
        {state:"todo", t:"SEO / content engine ongoing", d:"Reverse-engineer Onyx/Polymath; close the new-domain authority gap."},
        {state:"todo", t:"PR / newswire campaign", d:"Position 4orm as \"Canada's first RWA marketplace.\""},
        {state:"todo", t:"Bank-specific personalized pages", d:"ATB, Scotia using actual financials."}
      ],
      facts:[
        "Live web properties: <b>4</b>",
        "Research briefs: <b>22</b> + 16-pg Runway Briefing",
        "Built in-house value: <b>$30K-96K</b> of sites",
        "SEO lead: <b>Ming</b> (Canada-wide; + web back-end ops)",
        "Web partner: <b>Evolve One Media</b>",
        "Phase-1 budget: <b>~$200K</b> (in progress)"
      ],
      links:[{label:"kcs-capital.com ↗", url:"https://www.kcs-capital.com"},{label:"4ormfinance.com ↗", url:"https://www.4ormfinance.com"},{label:"4ormex.com ↗", url:"https://4ormex.com"},{label:"institutional demo · 4ormedc.com ↗", url:"https://www.4ormedc.com"}]
    },
    /* 7 ---------------------------------------------------------- */
    {
      id:"team", name:"Team & Talent", short:"Team",
      pct:38, stage:"Founders + deep advisory bench · key hires ahead",
      benchmark:{level:"ahead", note:"<b>The advisory bench is a genuine standout.</b> Two top-tier securities firms engaged (one offering to work for equity), an architect building for equity, a CFA backing the numbers and eligible to serve as CCO, and an ex-SWIFT banking lead - deeper than most pre-seeds. The gap investors will probe is a committed full-time CTO and an engineering team - both in progress."},
      checkpoints:[
        {state:"done", t:"Founding team in place", d:"Chad Johnston (CEO), Kevin Wong (CMO / marketing), Sam Junior (relations / co-founder)."},
        {state:"done", t:"Bruce Fair - capital-markets advisor", d:"30-yr VC (raised $500M+, 3 public boards); embedded ~4 months; sourced both law firms."},
        {state:"done", t:"Michael Stevens - Partner, Fasken", d:"Technology & securities lawyer; offered to work for equity."},
        {state:"done", t:"James - Capiche Capital", d:"Securities & capital-structure lawyer; handling incorporation and subscription docs."},
        {state:"done", t:"Matthew - Osler", d:"Securities & tokenization lawyer; Osler has published on tokenization legal architecture."},
        {state:"done", t:"Mike Andrews - banking & technology advisor", d:"Original dev lead for the SWIFT network for global institutions; ex-Morgan Stanley / BofA / Barclays."},
        {state:"done", t:"Miika (CFA) - finance & compliance", d:"Audited the pro forma, models and case studies; eligible to serve as Chief Compliance Officer."},
        {state:"done", t:"Zed - enterprise architect", d:"80+ hrs; 3 architecture overviews + 30/60/90 roadmap; building for equity."},
        {state:"done", t:"Ming - SEO expert (Canada-wide)", d:"Leading SEO and website back-end operations for marketing & web."},
        {state:"active", t:"Martin Hack - CTO / technology advisor", d:"Silicon Valley operator (scaled to $5M rev, raised ~$25M seed). Proposal + NDA + architecture docs sent; ~$20K/mo."},
        {state:"active", t:"Partnership lanes defined", d:"Three lanes - full-time / part-time / co-founder - to satisfy investor team-composition scrutiny."},
        {state:"active", t:"Equity incentive plan", d:"15% evergreen pool; reverse-vesting agreements drafted."},
        {state:"todo", t:"Engage full-time CTO / tech lead", d:"Convert advisor into committed technical leadership."},
        {state:"todo", t:"Recruit dev leads + founding engineers", d:"2 dev leads + supporting roles, post pre-seed close."},
        {state:"todo", t:"Advisory council charter", d:"Formalize the advisory council."}
      ],
      facts:[
        "Founders: <b>3</b> (Chad, Kevin, Sam)",
        "Securities firms engaged: <b>Fasken + Osler</b>",
        "Lawyer offering <b>equity</b>: Michael Stevens",
        "CFA on the numbers: <b>Miika</b> (CCO-eligible)",
        "Prospective CTO: <b>Martin Hack</b> (~$20K/mo)",
        "Next hires: <b>2 dev leads</b> + engineers"
      ]
    },
    /* 8 ---------------------------------------------------------- */
    {
      id:"legal", name:"Legal & Corporate Structure", short:"Legal",
      pct:48, stage:"Multi-entity structure papered · Mission Anchor & governance drafted",
      benchmark:{level:"ahead", note:"<b>Strong and remarkably capital-efficient.</b> Two elite securities firms are engaged (one offering equity), the cap table and three-class share structure are set, and the firm cut ~$85K by choosing Capiche over Osler. The whole company has converted a $44K founding cheque into $111K-$264K of secured value (2.6-6.3× per $1). Incorporation completion is the gating item."},
      checkpoints:[
        {state:"done", t:"Three-firm legal structure locked", d:"Capiche (incorporation / subscription / shareholder agreements), CFA (TFSA/RRSP trust), Fasken / Michael Stevens (securities)."},
        {state:"done", t:"~$85K legal cost reduction", d:"Capiche ($30-35K) selected over Osler ($115K) while preserving TFSA/RRSP eligibility."},
        {state:"done", t:"Cap table finalized", d:"Founder, advisor and investor allocations modeled and locked into the structure."},
        {state:"done", t:"Share classes defined", d:"Common (1:1) + founder super-voting (sunset) + investor voting-preferred; founder shares at $0.001."},
        {state:"done", t:"First-tranche convertible structured", d:"Our first pre-seed investor's $250K (~$5K legal) to deploy ahead of subscription docs."},
        {state:"done", t:"\"Capital In, Value Out\" summary produced", d:"Board summary documenting $44K in → $111K-$264K value out; in-house build replaced ~$55K-169K of agency cost for $5,923 of tooling (9-29×)."},
        {state:"active", t:"Initial Coin Offering (ICO) strategy", d:"ICO strategy development in place - not yet completed."},
        {state:"active", t:"Shareholder agreement", d:"Super-voting clauses (with sunset); drag-along + buyback; in review."},
        {state:"active", t:"Founder protections", d:"Reverse-vesting agreements; in review."},
        {state:"active", t:"Incorporation + registration", d:"Alberta incorporation under the Business Corporations Act (Alberta)."},
        {state:"active", t:"TFSA / RRSP eligibility - in process", d:"Trust accounts being set up so investors can subscribe via registered accounts."},
        {state:"active", t:"Subscription agreements - in process", d:"Being drafted for the pre-seed close."},
        {state:"todo", t:"Privacy charter", d:"Values-based / lawful-resistance language."},
        {state:"todo", t:"Track incorporation completion", d:"Gating item for the raise mechanics."}
      ],
      facts:[
        "Entity: <b>Alberta corporation</b> (ABCA)",
        "Firms: <b>Capiche</b> + <b>CFA</b> + <b>Fasken</b>",
        "Legal cost saved: ~<b>$85K</b> vs Osler",
        "Capital in → value out: <b>$44K → $111-264K</b>",
        "Shares: <b>3 classes</b>; ICO strategy in development"
      ]
    },
    /* 9 ---------------------------------------------------------- */
    {
      id:"investors", name:"Investor Pipeline & Future Rounds", short:"Investors",
      pct:24, stage:"Pipeline built · first capital in · seed mapped",
      benchmark:{level:"ahead", note:"<b>Ahead on pipeline breadth, early on conversion.</b> The investor and strategic-interest list is unusually broad for pre-seed - 81 VC contacts plus an identified network of up to 12,000 international accredited investors - and first capital is committed. Conversion to closed capital is the early-stage gap, and the seed round is deliberately gated behind the pre-seed close."},
      checkpoints:[
        {state:"done", t:"VC pipeline compiled", d:"81 VC contacts loaded in ClickUp with check sizes ($500K-$50M) and decision-makers."},
        {state:"done", t:"Accredited-investor network identified", d:"Reach to up to 12,000 international accredited investors mapped."},
        {state:"done", t:"First capital committed", d:"$50K angel investment (→1% / 200,000 shares); first pre-seed investor $250K - the first tranche of the $3M raise."},
        {state:"done", t:"100+ institutional CEO direct emails", d:"Personal (not info@) lines to the people who actually decide."},
        {state:"done", t:"Data room built", d:"Custom data room (migrating onto the KCS site)."},
        {state:"active", t:"Neo Financial - cultivation", d:"Founders (Skip the Dishes exit) being cultivated via a warm intro."},
        {state:"active", t:"Digital Commodities - meeting setup", d:"Strategic conversation being scheduled."},
        {state:"active", t:"$250K first tranche of the $3M - in process", d:"First tranche from our first pre-seed investor, landing over the registered-account transfer window."},
        {state:"active", t:"Warm intros to Tier-1 VCs + bank", d:"Mapping intro paths; strategic interest from Spear and LayerZero (open to the seed)."},
        {state:"todo", t:"Pre-seed investor ROI model", d:"Projected-ROI section for the deck."},
        {state:"todo", t:"Seed round planning", d:"\"Seed-strapping\" $15-25M (2027), likely via a US entity."}
      ],
      facts:[
        "VC contacts: <b>81</b> ($500K-$50M)",
        "Accredited network: <b>up to 12,000</b> intl.",
        "Committed: <b>$50K angel</b> + <b>$250K</b> 1st pre-seed",
        "Cultivating: <b>Neo Financial</b>, <b>Digital Commodities</b>",
        "Strategic: <b>Spear</b>, <b>LayerZero</b>",
        "Seed plan: <b>$15-25M</b> (2027)"
      ]
    }
  ]
};
