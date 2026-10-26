/* Planner live seed, built 26 Oct 2026 from Chad's docs, memory, calendar and Gmail.
   Same shape as RAW in 18-timeline.html, plus c (confidence) and src (where the date came from).
   c: 'confirmed' = Chad said it, or it is in the calendar or an email
      'sourced'   = written in a 4orm plan or roadmap
      'estimated' = no date found; placeholder for Chad to confirm in the Planner
   Sources in detail: CLAUDE/AUDIT/timeline-sources-docs.md and timeline-sources-calendar-gmail.md.
   Live seed only. The pixel check keeps using RAW in 18-timeline.html.
   Two OPEN DECISIONS are flagged with decide: - seed them as written and Chad changes them in the Planner. */
window.PLANNER_SEED = [
 /* ---------- Milestones ---------- */
 {id:'g-window',p:'goals',n:'Pre-seed window closes',m:'2026-10-30',o:'Bruce, Chad',c:'confirmed',src:'90-day window from 1 Aug 2026 (Chad)'},
 {id:'g-ff',p:'goals',n:'Friends and family at $250,000',m:'2026-11-30',o:'Chad',c:'estimated',src:'$80K in, $170K to go (finance sheet / CEO brain); no target date'},
 {id:'g-mvp',p:'goals',n:'MVP demo-ready',m:'2027-02-26',o:'Mathew',c:'sourced',src:'Oct 2026 product roadmap: MVP Dec 2026 to Feb 2027'},
 {id:'g-pilot',p:'goals',n:'Two paid design partners live ($84,000 Q1 target)',m:'2027-03-31',o:'Kevin, Chad',c:'confirmed',src:'Chad asked for the Q1 2027 revenue line: $84K, two paid design partners'},
 {id:'g-round',p:'goals',n:'Pre-seed round complete',m:'2027-03-31',o:'Bruce, Chad',c:'sourced',decide:'Data room capital roadmap says C$2.5M closed Q1 2027; CEO brain (12 Oct) says $2.05M in five tranches ending May 2027. Pick one.',src:'capital roadmap PDF / CEO brain'},
 {id:'g-1000',p:'goals',n:'1,000 people using 4ormIQ',m:'2027-01-29',o:'Chad',c:'estimated',src:'Goal is Chad\'s; no date found'},

 /* ---------- Capital ---------- */
 {id:'preseed',p:'capital',t:'Pre-seed',n:'Pre-seed raise window',s:'2026-08-01',e:'2026-10-30',o:'Bruce, Chad',g:'g-window',c:'confirmed',src:'Chad',tasks:[['Close friends-and-family to $250,000 ($80K in)',0],['Zahar, BJ, Daryl and Kevin: one $25,000 cheque each',0],['Widen the round past one cheque',0]]},
 {id:'shares',p:'capital',t:'Pre-seed',n:'Counsel makes the shares official (Capiche Legal)',s:'2026-10-26',e:'2026-11-20',o:'Chad, James Atherton',g:'g-ff',c:'confirmed',src:'Investor update 26 Oct: "in the coming weeks"; cap table sent to James 26 Oct',dep:['preseed']},
 {id:'ffclose',p:'capital',t:'Pre-seed',n:'Friends and family to $250,000',s:'2026-10-26',e:'2026-11-30',o:'Chad',g:'g-ff',c:'estimated',src:'$170K to go'},
 {id:'placecard',p:'capital',t:'Investors',n:'Investor place card sessions',s:'2026-10-27',e:'2026-10-29',o:'Chad',c:'confirmed',src:'Calendar 27 to 29 Oct'},
 {id:'invupd',p:'capital',t:'Investor relations',n:'Investor update, monthly',dates:'monthly:26',o:'Chad',c:'confirmed',src:'First sent 26 Oct 2026'},
 {id:'ycdec',p:'capital',t:'Accelerators',n:'Y Combinator answer',m:'2026-12-11',o:'Chad',c:'sourced',src:'YC application notes: answer by 11 Dec'},
 {id:'tranche',p:'capital',t:'Pre-seed',n:'Pre-seed tranches 2 to 5',s:'2026-12-01',e:'2027-03-31',o:'Bruce, Chad',g:'g-round',c:'sourced',decide:'End date depends on the round decision above (31 Mar or 31 May 2027).',src:'capital roadmap / CEO brain'},
 {id:'speerdep',p:'capital',t:'Spend',n:'Speer deposit paid',m:'2027-02-01',o:'Chad',c:'sourced',src:'Cash model: Speer deposit Feb 2027',dep:['msa']},
 {id:'seedprep',p:'capital',t:'Seed',n:'Seed round preparation (~$3.55M at $30M)',s:'2027-04-01',e:'2027-06-30',o:'Bruce, Chad',c:'sourced',src:'Financing strategy: seed ~$3.55M closing ~Sep 2027'},

 /* ---------- Partnership (Speer) ---------- */
 {id:'speerask',p:'partnership',t:'Speer',n:'Speer proposal, MSA and start date due',m:'2026-10-31',o:'Chad',c:'confirmed',src:'Email to Speer 12 Oct asking for all three by 31 Oct; follow-up 21 Oct, no reply yet'},
 {id:'msa',p:'partnership',t:'Speer',n:'Speer MSA signed',m:'2026-11-13',o:'Chad',g:'g-mvp',c:'estimated',src:'No signing date in any source',dep:['speerask']},
 {id:'sred',p:'partnership',t:'Funding',n:'SR&ED and grant sourcing',s:'2027-01-04',e:'2027-02-26',o:'Chad',c:'estimated',src:'No date found',dep:['msa']},

 /* ---------- Development ---------- */
 {id:'iqready',p:'development',t:'4ormIQ',n:'4ormIQ ready for users',m:'2026-10-23',o:'Chad',g:'g-1000',c:'confirmed',src:'Chad 16 Oct: "ready to go in one week"'},
 {id:'counsel',p:'development',t:'4ormIQ',n:'4ormIQ counsel conversation',s:'2026-10-05',e:'2026-10-30',o:'Chad',g:'g-1000',c:'sourced',src:'4ormIQ counsel area notes'},
 {id:'brokers1',p:'development',t:'4ormIQ for Brokers',n:'BC broker first release ($29/month)',s:'2026-10-22',e:'2026-12-11',o:'Chad',g:'g-pilot',c:'estimated',src:'$29/month is the working BC broker price; no release date found'},
 {id:'ops',p:'development',t:'4orm Ops',n:'Planner page live in 4ormop',s:'2026-10-26',e:'2026-11-13',o:'Chad',c:'confirmed',src:'Approved 26 Oct'},
 {id:'disc',p:'development',t:'Platform build',n:'Speer phase 1: discovery (one month)',s:'2026-11-16',e:'2026-12-15',o:'Mathew, Zed',g:'g-mvp',c:'sourced',src:'Product and technical roadmaps Oct 2026: discovery one month, November',dep:['msa']},
 {id:'mvp',p:'development',t:'Platform build',n:'Speer phase 2: MVP design and build',s:'2026-12-16',e:'2027-02-26',o:'Mathew',g:'g-mvp',c:'sourced',src:'Roadmap: MVP Dec 2026 to Feb 2027',dep:['disc']},
 {id:'pilots',p:'development',t:'Platform build',n:'Pilot and measure (two to five design partners)',s:'2027-03-01',e:'2027-05-31',o:'Kevin, Mathew',c:'sourced',src:'Product roadmap: March to May 2027, months 5 to 7',dep:['mvp']},

 /* ---------- Revenue ---------- */
 {id:'vernon',p:'revenue',t:'Brokers',n:'Vernon broker door-knock',m:'2026-10-27',o:'Chad',c:'confirmed',src:'Calendar 27 Oct'},
 {id:'ralph',p:'revenue',t:'Brokers',n:'Coffee with Ralph Gardner (Sterling Benefits)',m:'2026-11-03',o:'Chad',c:'confirmed',src:'Email: planned around 3 Nov'},
 {id:'dppack',p:'revenue',t:'Design partners',n:'Design partner package',s:'2026-10-19',e:'2026-11-13',o:'Kevin, Chad',g:'g-pilot',c:'estimated',src:'No date found',tasks:[['One-page offer',1],['Pilot terms outline',0],['Short list of 20 firms',0]]},
 {id:'dpconv',p:'revenue',t:'Design partners',n:'First design partner conversations',s:'2026-11-16',e:'2026-12-18',o:'Kevin',g:'g-pilot',c:'estimated',src:'No date found',dep:['dppack']},
 {id:'paid',p:'revenue',t:'Design partners',n:'Paid delivery starts',m:'2027-04-01',o:'Kevin',c:'sourced',src:'Revenue roadmap: paid delivery from April 2027',dep:['dpconv']},
 {id:'outreach',p:'revenue',t:'Daily',n:'Daily outreach',dates:'weekdays',o:'Chad',c:'confirmed',src:'Chad: daily outreach'},

 /* ---------- Marketing ---------- */
 {id:'content14',p:'marketing',t:'Content',n:'Marketing content, every 14 days',dates:'every14:2026-10-26',o:'Chad',c:'confirmed',src:'Chad: content every 14 days'},
 {id:'newsl',p:'marketing',t:'Research',n:'Newsletter, monthly',dates:'monthly:2',o:'Chad',c:'confirmed',src:'First newsletter set for 2 Oct'},
 {id:'testers',p:'marketing',t:'4ormIQ users',n:'100 consumer testers from the trader group',s:'2026-10-26',e:'2026-11-27',o:'Chad',g:'g-1000',c:'estimated',src:'No date found'},
 {id:'k1000',p:'marketing',t:'4ormIQ users',n:'1,000-user push',s:'2026-11-02',e:'2027-01-29',o:'Chad',g:'g-1000',c:'estimated',src:'No date found',dep:['iqready']},

 /* ---------- Corporate ---------- */
 {id:'bizplan',p:'corporate',t:'Planning',n:'Business plan overview with Bruce',m:'2026-10-27',o:'Bruce, Chad',c:'confirmed',src:'Calendar 27 Oct'},
 {id:'cim',p:'corporate',t:'Documents',n:'CIM draft',s:'2026-10-01',e:'2026-11-13',o:'Chad',c:'estimated',src:'CIM area notes; no deadline found',tasks:[['Executive summary',1],['Market and challenge pages',1],['Financial pages',0],['Team pages',0],['Counsel read-through',0]]},
 {id:'plan27',p:'corporate',t:'Planning',n:'2027 operating plan',s:'2026-11-30',e:'2026-12-18',o:'Chad',c:'estimated',src:'No date found',dep:['cim']},

 /* ---------- Regulators ---------- */
 {id:'stephens',p:'regulators',t:'Introductions',n:'Introductions through Michael Stephens (Fasken)',s:'2026-10-14',e:'2027-01-29',o:'Michael Stephens',c:'confirmed',src:'Met 14 Oct; has the regulator list; on holiday now'},
 {id:'fpf',p:'regulators',t:'Direct',n:'Fraud Prevention Forum call',m:'2026-10-16',o:'Chad',c:'confirmed',src:'Calendar 16 Oct',st:'done'},
 {id:'clhia',p:'regulators',t:'Direct',n:'Send CLHIA the list of insurers',m:'2026-10-30',o:'Chad',c:'confirmed',src:'CLHIA replied 19 Oct asking for it; still owed (due date estimated)'},
 {id:'bcfsa',p:'regulators',t:'Direct',n:'BCFSA, FCAC and CMHC follow-ups',s:'2026-10-19',e:'2026-11-27',o:'Chad',c:'confirmed',src:'Chad: contacted; follow-up window estimated'},
 {id:'bcpmc',p:'regulators',t:'External dates',n:'BC personal mortgage corporation applications due',m:'2027-01-11',o:'External',c:'sourced',src:'Broker research'},
 {id:'rpaa',p:'regulators',t:'External dates',n:'RPAA annual report due',m:'2027-03-31',o:'External',c:'sourced',src:'Evidence plan'},
 {id:'bcteams',p:'regulators',t:'External dates',n:'BC teams rules apply',m:'2027-04-01',o:'External',c:'sourced',src:'Broker research'},
 {id:'amf3p',p:'regulators',t:'External dates',n:'AMF third-party guideline',m:'2027-04-01',o:'External',c:'sourced',src:'Evidence plan'},
 {id:'e23',p:'regulators',t:'External dates',n:'OSFI E-23 and AMF AI guideline take effect (largest demand event)',m:'2027-05-01',o:'External',c:'sourced',src:'Evidence plan'},

 /* ---------- Team ---------- */
 {id:'kickoff',p:'team',t:'Weekly',n:'Weekly Kick-Off, Mondays 09:00',dates:'weekly:MO',o:'Chad, Bruce, Kevin, Dean, Don',c:'confirmed',src:'Calendar, from 26 Oct'},
 {id:'review',p:'team',t:'Weekly',n:'Weekly review, Fridays 09:00',dates:'weekly:FR',o:'Chad',c:'sourced',src:'CEO brain: weekly review Friday 09:00 PT'},
 {id:'oneones',p:'team',t:'One-on-ones',n:'One-on-ones: Kevin (Fri), Don (Fri), Dean (Mon)',dates:'weekly:FR',o:'Chad',c:'confirmed',src:'Calendar recurring'},
 {id:'advisors',p:'team',t:'Advisors',n:'Advisor meetings and onboarding',s:'2026-10-05',e:'2027-04-30',o:'Chad',c:'confirmed',src:'Advisor meetings since 5 Oct; six-month clock'},
 {id:'arch',p:'team',t:'Technology',n:'Architecture review with Zed',s:'2026-11-23',e:'2026-12-04',o:'Zed',g:'g-mvp',c:'estimated',src:'No date found',dep:['msa']},
 {id:'hire',p:'team',t:'Technology',n:'Technology hire decision',m:'2027-01-22',o:'Founders',g:'g-mvp',c:'estimated',src:'No date found',dep:['disc']}
];
