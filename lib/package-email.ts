/* Designed info-pack emails. A package with a design wraps Chad's short note in a forwardable one-minute brief.
   Email-safe: one 600px table, inline styles, Arial, live text for every number, only the two logos are images.
   Every figure here comes from the Oct 2026 Business Overview and deck slides 02 and 09; change them there first. */

export type Design = '' | 'brief-broker' | 'brief-regulator' | 'brief-investor';
export const DESIGNS: Array<{ id: Design; name: string }> = [
  { id: '', name: 'Plain email' },
  { id: 'brief-broker', name: 'Info pack: brokers and design partners' },
  { id: 'brief-regulator', name: 'Info pack: regulators and partners' },
  { id: 'brief-investor', name: 'Info pack: investors' },
];
export function cleanDesign(v: unknown): Design {
  const d = String(v || '');
  return (DESIGNS.find((x) => x.id === d)?.id ?? '') as Design;
}

const SITE = 'https://www.4ormop.com';
const BLUE = '#2E6BF2';
const INK = '#14161c';
const MUTED = '#5a6275';
const LINE = '#e1e4ec';
const F = 'font-family:Arial,Helvetica,sans-serif;';

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

type Stat = [string, string];
type Pair = [string, string];

const STEPS = ['Explore privately', 'Build understanding', 'Share by choice', 'Support the professional', 'Preserve the why'];

function kicker(t: string) {
  return `<div style="${F}font-size:11px;letter-spacing:2px;font-weight:bold;color:${MUTED};margin:0 0 10px">${esc(t)}</div>`;
}
function section(inner: string, bg = '#ffffff') {
  return `<tr><td style="padding:20px 26px;background:${bg};border-top:1px solid ${LINE}">${inner}</td></tr>`;
}
function hero(k: string, h1: string, h2: string) {
  return `<tr><td style="background:#0b1430;padding:24px 26px 26px;border-radius:12px 12px 0 0">
<div style="${F}font-size:11px;letter-spacing:2px;font-weight:bold;color:#8fb0ff">${esc(k)}</div>
<div style="${F}font-size:24px;line-height:30px;font-weight:bold;color:#ffffff;margin-top:8px">${esc(h1)}</div>
<div style="${F}font-size:24px;line-height:30px;font-weight:bold;color:#6f9bff">${esc(h2)}</div></td></tr>`;
}
function stats(list: Stat[]) {
  const w = Math.floor(100 / list.length);
  const cells = list.map(([n, t], i) => `<td width="${w}%" valign="top" style="padding:16px 14px;${i < list.length - 1 ? `border-right:1px solid ${LINE};` : ''}">
<div style="${F}font-size:24px;font-weight:bold;color:${BLUE}">${esc(n)}</div>
<div style="${F}font-size:12px;line-height:17px;color:#3b4253;margin-top:4px">${esc(t)}</div></td>`).join('');
  return `<tr><td style="border-top:1px solid ${LINE};padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`;
}
function intro() {
  const p = (t: string) => `<p style="${F}font-size:14px;line-height:21px;color:#2a2f3c;margin:0 0 10px">${esc(t)}</p>`;
  return `<tr><td style="padding:20px 26px 10px;background:#ffffff">`
    + p('Businesses are carrying more of the weight of proving suitability, often by rebuilding the record after the decision has already been made. The industry already sees the value in evidence that is captured once and trusted by everyone.')
    + p("That is the challenge 4orm Finance works on. We help consumers think through a major financial decision and pass only what they choose to share into the firm's existing compliance tools. The professional ends up with an auditable suitability record, built in real time.")
    + `</td></tr>`;
}
function band(text: string, blue: string) {
  return `<tr><td style="background:#14161c;padding:14px 26px"><div style="${F}font-size:14px;line-height:20px;font-weight:bold;color:#ffffff">${esc(text)} <span style="color:#8fb0ff">${esc(blue)}</span></div></td></tr>`;
}
function steps(title: string, note = '') {
  const cells = STEPS.map((s, i) => `<td width="20%" valign="top" style="padding:3px"><div style="background:#f4f6fb;border-radius:8px;padding:9px 8px">
<div style="${F}font-size:11px;font-weight:bold;color:${BLUE}">0${i + 1}</div><div style="${F}font-size:12px;line-height:16px;font-weight:bold;color:${INK};margin-top:3px">${esc(s)}</div></div></td>`).join('');
  return section(kicker(title) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`
    + (note ? `<div style="${F}font-size:11px;color:#7d859a;margin-top:8px">${esc(note)}</div>` : ''));
}
function cols(title: string, items: Pair[]) {
  const w = Math.floor(100 / items.length);
  const cells = items.map(([h, t]) => `<td width="${w}%" valign="top" style="padding-right:12px">
<div style="${F}font-size:13.5px;font-weight:bold;color:${INK}">${esc(h)}</div><div style="${F}font-size:12.5px;line-height:18px;color:#3b4253;margin-top:3px">${esc(t)}</div></td>`).join('');
  return section(kicker(title) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`);
}
function tiles(title: string, list: Array<[string, string, string]>, foot: string) {
  const row = (a: Array<[string, string, string]>) => `<tr>${a.map(([n, t, src]) => `<td width="50%" valign="top" style="padding:4px"><div style="background:#f4f6fb;border-radius:10px;padding:12px 14px">
<div style="${F}font-size:20px;font-weight:bold;color:${BLUE}">${esc(n)}</div><div style="${F}font-size:12.5px;line-height:17px;font-weight:bold;color:${INK};margin-top:3px">${esc(t)}</div>
<div style="${F}font-size:11px;color:${MUTED};margin-top:5px">${esc(src)}</div></div></td>`).join('')}</tr>`;
  let rows = '';
  for (let i = 0; i < list.length; i += 2) rows += row(list.slice(i, i + 2));
  return section(kicker(title) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table><div style="${F}font-size:11px;color:#7d859a;margin-top:8px">${esc(foot)}</div>`);
}
function rows(title: string, list: Stat[], foot: string) {
  const r = list.map(([n, t]) => `<tr><td width="96" valign="top" style="${F}font-size:17px;font-weight:bold;color:${BLUE};padding:5px 0">${esc(n)}</td><td valign="top" style="${F}font-size:13px;line-height:19px;color:#2a2f3c;padding:6px 0">${t}</td></tr>`).join('');
  return section(kicker(title) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r}</table><div style="${F}font-size:11px;line-height:16px;color:#7d859a;margin-top:8px">${esc(foot)}</div>`);
}
function bullets(title: string, lead: string, list: string[]) {
  return section(kicker(title) + (lead ? `<div style="${F}font-size:13.5px;line-height:20px;color:#2a2f3c;margin-bottom:8px">${esc(lead)}</div>` : '')
    + list.map((t) => `<div style="${F}font-size:13px;line-height:19px;color:#2a2f3c;padding:3px 0 3px 14px"><span style="color:${BLUE};font-weight:bold;margin-left:-14px;padding-right:6px">&middot;</span>${esc(t)}</div>`).join(''));
}
function twoList(title: string, list: string[]) {
  const half = Math.ceil(list.length / 2);
  const col = (a: string[]) => a.map((t) => `<div style="${F}font-size:12.5px;line-height:19px;color:#2a2f3c">${esc(t)}</div>`).join('');
  return section(kicker(title) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="top">${col(list.slice(0, half))}</td><td width="50%" valign="top">${col(list.slice(half))}</td></tr></table>`);
}
function lockup() {
  return `<tr><td style="background:#f7f8fb;border-top:1px solid ${LINE};padding:14px 26px;border-radius:0 0 12px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><img src="${SITE}/assets/email/4orm-wordmark.png" alt="4orm" height="22" style="height:22px;width:auto;vertical-align:bottom;border:0"><span style="${F}font-size:19px;font-weight:bold;color:${BLUE};vertical-align:bottom;padding-left:3px">IQ</span></td>
<td align="right" valign="middle"><a href="https://4ormiq.com" style="${F}font-size:13px;font-weight:bold;color:${BLUE};text-decoration:none">4ormiq.com</a></td></tr></table></td></tr>`;
}

const CHALLENGE_SRC = 'Sources: FSRA 2025-26 (Ontario private mortgages), BCFSA, CMHC 2026, FINTRAC 2025-26, Torys 2026. Figures are penalty ceilings; samples and periods differ.';
const COMPARABLE: Array<[string, string, string]> = [
  ['90 to 15 minutes', 'AI-assisted checks helped reviewers assess cases faster', 'Key Group / Aveni'],
  ['~60%', 'Less post-meeting administration', 'Prosser Knowles / Aveni'],
  ['50%', 'Less staff time to review client calls', 'Octopus Money / Aveni'],
  ['59%', 'of Canadians comfortable with bank AI under meaningful human oversight', 'TD / Ipsos, June 2026'],
];
const CAVEAT = '4ormIQ is in validation with mortgage firms. Integrations, time savings and outcomes need pilot validation and are not measured 4orm results.';

function brief(design: Design) {
  if (design === 'brief-broker') {
    return hero('4ORMIQ IN ONE MINUTE', 'Major financial decisions.', 'Easier to understand. Easier to explain.')
      + intro()
      + stats([
        ['C$500K', 'B.C. brokerage penalty ceiling under new rules from Oct 13, 2026'],
        ['100%', 'of Ontario private mortgage files examined lacked a documented suitability assessment'],
        ['47%', 'of homebuyers felt uncertain or concerned during the process'],
      ])
      + band('The business pays twice. Once to guide the consumer,', 'again to rebuild the record.')
      + steps('HOW IT WORKS')
      + cols('WHAT YOUR FIRM GETS', [
        ['Records as you go', 'The decision record is built as the process happens, not rebuilt afterward.'],
        ['Less admin', 'Less staff time chasing information, rebuilding files and preparing cases for review.'],
        ['Clients who come back', 'Clients return when they feel educated and understood.'],
      ])
      + tiles('RESULTS OF COMPARABLE PLATFORMS', COMPARABLE, 'Published results from businesses using comparable technology. External evidence, not 4orm results.')
      + lockup();
  }
  if (design === 'brief-regulator') {
    return hero('4ORMIQ IN ONE MINUTE', 'Suitability evidence, captured once,', 'as the decision happens.')
      + intro()
      + stats([
        ['C$20M', 'Max FINTRAC penalty per very serious entity violation, a 40x increase'],
        ['8 to 30', 'FINTRAC penalties issued, 2021 versus 2025'],
        ['100%', 'of Ontario private mortgage files examined lacked a documented suitability assessment'],
      ])
      + band('The business pays twice. Once to guide the consumer,', 'again to rebuild the record.')
      + steps("WHAT REGULATORS WANT, TURNED INTO A BUSINESS WORKFLOW", 'Shaped by the FCAC National Financial Literacy Strategy 2021-2026. No government endorsement implied.')
      + cols('WHAT CHANGES', [
        ['The consumer leads', 'Goals, circumstances and risks are explored privately, in plain language.'],
        ['Consent first', 'The consumer chooses what to share with the professional.'],
        ['A record that holds', 'Reasoning and suitability evidence stay with the decision.'],
      ])
      + twoList('WHERE IT APPLIES', ['Mortgage companies', 'Insurance companies', 'Investment dealers', 'Auto finance', 'Banks and credit unions', 'Payments and money services'])
      + lockup();
  }
  if (design === 'brief-investor') {
    const sup = (n: number) => `<sup style="font-size:9px;color:${MUTED}">${n}</sup>`;
    return hero('4ORM FINANCE INTRODUCES', '4ormIQ', 'Counselling-inspired AI that connects compliance and consumer understanding.')
      + intro()
      + rows('THE CHALLENGE', [
        ['100%', `of files examined lacked a documented suitability assessment, up from 85%.${sup(1)}`],
        ['73%', `of files examined had missing or inadequate risk disclosure, up from 48%.${sup(1)}`],
        ['+81%', `compliance costs in two years, C$416M to C$753M across 24 Canadian P&amp;C insurers.${sup(2)}`],
        ['47%', `of homebuyers felt uncertain or concerned during the homebuying process.${sup(3)}`],
        ['8 to 30', `FINTRAC penalties issued, 2021 versus 2025.${sup(4)}`],
        ['40x', `higher FINTRAC penalty limits, up to C$20M per very serious entity violation.${sup(5)}`],
        ['Oct 2024', `mortgage administrators, brokers and lenders took on federal anti-money-laundering duties.${sup(5)}`],
        ['2.71x', `cost of non-compliance versus compliance in a 2017 multinational study.${sup(6)}`],
      ], 'Sources: 1 FSRA 2025-26, Ontario private mortgages. 2 Insurance Bureau of Canada. 3 CMHC 2026. 4 Torys 2026. 5 FINTRAC 2025-26. 6 Ponemon/Globalscape 2017, multinational study. Separate samples and periods.')
      + band('The business pays twice. Once to guide the consumer,', 'again to rebuild the record.')
      + twoList('WHO THIS IMPACTS', ['Real estate brokers, representatives and developers', 'Banks, credit unions and cooperatives', 'Life insurers, brokers and agents', 'Securities dealers', 'Money services businesses', 'Accountants and accounting firms', 'BC notaries and notary corporations', 'Dealers in precious metals and stones', 'Mortgage administrators, brokers and lenders', 'Title insurers and factoring businesses'])
      + bullets('THE SOLUTION', '4ormIQ is a set of AI tools that put client counselling at the centre and plug into a business\'s existing apps and compliance systems.', [
        'Before a recommendation, clients privately work through their goals, circumstances and risk profile, and compare short- and long-term outcomes.',
        'The client decides what to share. That brief gives the professional richer context for a better-informed recommendation.',
        'The whole suitability and decision process is recorded as it happens, as an auditable record.',
      ])
      + tiles('RESULTS OF COMPARABLE PLATFORMS', COMPARABLE, 'Published results from businesses using comparable technology. External evidence, not 4orm results.')
      + lockup();
  }
  return '';
}

function noteHtml(text: string) {
  return text.split(/\r?\n\s*\r?\n/).map((p) => `<p style="${F}font-size:15px;line-height:23px;color:${INK};margin:0 0 14px">${esc(p.trim()).replace(/\r?\n/g, '<br>')}</p>`).join('');
}

function docCards(docs: Array<{ name: string; url: string }>) {
  return docs.map((d) => {
    const ty = /\.pdf(\?|$)/i.test(d.url) ? 'PDF' : /docs\.google|drive\.google/i.test(d.url) ? 'DOC' : 'LINK';
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;border:1px solid ${LINE};border-radius:9px"><tr>
<td style="padding:10px 12px"><span style="${F}display:inline-block;background:#e8eefc;color:${BLUE};font-size:11px;font-weight:bold;padding:6px 7px;border-radius:5px">${ty}</span></td>
<td style="padding:10px 14px 10px 0">${ty === 'PDF'
  ? `<div style="${F}font-size:13.5px;font-weight:bold;color:${INK}">${esc(d.name)}</div><div style="${F}font-size:12px;color:${MUTED}">Attached to this email</div>`
  : `<a href="${esc(d.url)}" style="${F}font-size:13.5px;font-weight:bold;color:${INK};text-decoration:none">${esc(d.name)}</a><div style="${F}font-size:12px;color:${MUTED}">Open</div>`}</td></tr></table>`;
  }).join('');
}

/** Full HTML email: logo, Chad's note, signature, documents, then the forwardable brief. */
export function renderPackageEmail(design: Design, note: string, docs: Array<{ name: string; url: string }>) {
  const sig = `<div style="${F}font-size:14px;line-height:20px;color:${INK};margin-top:4px"><b>With Gratitude,</b><br><b>Chad R Johnston</b><br><span style="color:${MUTED};font-size:13px">Founder &amp; CEO, 4orm Finance<br>778-363-2423 &middot; chad@4ormfinance.com</span></div>`;
  const body = note.replace(/\n*\s*With Gratitude,[\s\S]*$/i, '').trim();
  const b = brief(design);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#eef0f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:10px">
<tr><td style="padding:28px 34px 30px">
<img src="${SITE}/assets/email/4orm-finance.png" alt="4orm Finance" height="40" style="height:40px;width:auto;display:block;border:0;margin:0 0 22px">
${noteHtml(body)}
${sig}
${docs.length ? `<div style="margin-top:20px">${docCards(docs)}</div>` : ''}
${b ? `<div style="${F}font-size:11px;letter-spacing:2px;font-weight:bold;color:#8a92a6;text-align:center;margin:28px 0 18px">FOR YOUR TEAM &middot; FORWARD AS IS</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px">${b}</table>
<div style="${F}font-size:11.5px;line-height:17px;color:#7d859a;margin:14px 2px 0">${esc(CAVEAT)}</div>` : ''}
</td></tr></table></td></tr></table></body></html>`;
}

/** Plain-text twin, for clients that do not show HTML and for the conversation log. */
export function packageText(note: string, docs: Array<{ name: string; url: string }>) {
  return note.trim() + (docs.length ? '\n\n' + docs.map((d) => `${d.name}: ${d.url}`).join('\n') : '');
}

export { CHALLENGE_SRC };
