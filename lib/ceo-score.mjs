/** Pure lamp and three-move scoring. No database, no model. */

export const PRINCIPLES = {
  P1: 'Cash first',
  P2: 'Sell it yourself',
  P3: 'One product one buyer',
  P4: 'Regulator first',
  P5: 'The record is the product',
  P6: 'Test cheap, kill-rule first',
  P7: 'Weekly review, red welcome',
  P8: 'Do what you said, on paper',
  P9: 'Decide fast with counsel',
  P10: 'Spend behind evidence',
  P11: 'Protect one investment',
  P12: 'Recruit and borrow credibility',
  P13: 'Operating rhythm',
};

/** Cash and the raise, then design partners, the record, and promises. Regulator last. */
const ORDER = ['P1', 'P2', 'P3', 'P5', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P6', 'P7', 'P4'];

export const DEFAULT_WEIGHTS = {
  P1: 40,
  P8: 35,
  P2: 30,
  P4: 5,
  P5: 20,
  P9: 20,
  P10: -30,
  counsel: 60,
};

export const SEED_FACTS = {
  cash: 100,
  burnMonthly: 90050,
  closeOn: '2026-10-30',
  closeLabel: '30 Oct',
  topShare: 70000 / 80000,
  moneyState: 'drafted',
  committedSpend: 90050,
};

const LAMP_LABELS = {
  L1: 'Runway vs raise close',
  L2: 'Concentration',
  L3: 'Money before paper',
  L4: 'Promises overdue',
  L5: 'Customer conversations',
  L6: 'Spend vs cash in',
  L7: 'Regulator and partner',
  L8: 'Team churn',
};

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function weight(weights, key) {
  return num(weights?.[key], DEFAULT_WEIGHTS[key]);
}

export function wordFor(state) {
  if (state === 'green') return 'ok';
  if (state === 'amber') return 'watch';
  if (state === 'red') return 'red';
  return 'unknown';
}

export function clipLine(text) {
  const clean = String(text || '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= 90) return clean;
  const cut = clean.slice(0, 90);
  const space = cut.lastIndexOf(' ');
  return (space > 40 ? cut.slice(0, space) : cut).replace(/[,\s]+$/, '');
}

export function ymd(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export function dayDiff(due, now) {
  const a = Date.parse(`${ymd(due)}T00:00:00Z`);
  const b = Date.parse(`${ymd(now)}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

function weekdayIndex(ms) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Edmonton',
    weekday: 'short',
  }).format(new Date(ms));
  const idx = WD.indexOf(name);
  return idx < 0 ? 0 : idx;
}

export function whenLabel(due, now) {
  if (due == null) return 'Friday this week';
  if (dayDiff(due, now) < 0) return 'today';
  const parts = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Edmonton',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).formatToParts(new Date(due))) {
    parts[part.type] = part.value;
  }
  return `${parts.weekday} ${parts.month} ${parts.day}`;
}

function fridayMs(now) {
  const delta = (5 - weekdayIndex(now) + 7) % 7;
  return Date.parse(`${ymd(now)}T18:00:00Z`) + delta * 86400000;
}

function dollars(n) {
  return `$${Math.round(Number(n)).toLocaleString('en-US')}`;
}

export function readProfileFacts(text) {
  const src = String(text || '');
  const grab = (re) => {
    const match = src.match(re);
    if (!match) return null;
    const n = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const cash = grab(/Cash in the bank today:\s*\$([0-9,]+)/);
  const burnMonthly = grab(/Monthly burn now[\s\S]{0,120}?\$([0-9,]+)/);
  const committed = grab(/In as of[^$\n]{0,40}\$([0-9,]+)/);
  const top = grab(/Don Hickling\s*\$([0-9,]+)/);
  let closeOn = null;
  let closeLabel = null;
  const close = src.match(/closing about\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (close) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const mm = months[close[2].slice(0, 3).toLowerCase()];
    if (mm) {
      closeOn = `${close[3]}-${mm}-${String(close[1]).padStart(2, '0')}`;
      closeLabel = `${Number(close[1])} ${close[2].slice(0, 3)}`;
    }
  }
  return {
    cash,
    burnMonthly,
    closeOn,
    closeLabel,
    topShare: committed && top ? top / committed : null,
    moneyState: /still to be papered/i.test(src) ? 'drafted' : null,
    committedSpend: burnMonthly,
  };
}

function monthsPastClose(cash, burn, closeOn, now) {
  if (cash == null || burn == null || burn <= 0 || !closeOn) return null;
  const runwayMs = (Number(cash) / Number(burn)) * 30.4375 * 86400000;
  const closeMs = Date.parse(`${closeOn}T18:00:00Z`);
  if (!Number.isFinite(closeMs)) return null;
  return (now.getTime() + runwayMs - closeMs) / (30.4375 * 86400000);
}

function lamp(key, state, detail) {
  return { key, state, word: wordFor(state), label: LAMP_LABELS[key], detail };
}

export function computeLamps(input) {
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const months = monthsPastClose(input.cash, input.burnMonthly, input.closeOn, now);
  let l1 = 'unknown';
  let l1Detail = 'Cash, burn, or the expected close is not on the desk.';
  if (months != null) {
    l1 = months >= 9 ? 'green' : months >= 6 ? 'amber' : 'red';
    l1Detail = `Cash is ${dollars(input.cash)}. Monthly burn is about ${dollars(input.burnMonthly)}. The close is ${input.closeLabel || input.closeOn}. That is ${l1 === 'green' ? '9 months or more' : l1 === 'amber' ? '6 to 9 months' : 'under 6 months'} of cash past the close.`;
  }

  const share = input.topShare == null ? null : Number(input.topShare);
  let l2 = 'unknown';
  let l2Detail = 'No raise ledger is on the desk, so concentration stays unknown.';
  if (share != null && Number.isFinite(share)) {
    const pct = Math.round(share * 100);
    l2 = share > 0.3 ? 'red' : share >= 0.2 ? 'amber' : 'green';
    l2Detail = `One investor holds ${pct}% of the money committed so far. The line is 30%.`;
  }

  const paper = input.moneyState;
  let l3 = 'unknown';
  let l3Detail = 'No raise paper is on the desk.';
  if (paper === 'signed') {
    l3 = 'green';
    l3Detail = 'Every dollar in or promised has a signed document.';
  } else if (paper === 'drafted') {
    l3 = 'amber';
    l3Detail = 'A subscription is still to be papered. A draft is not a signed document.';
  } else if (paper === 'unsigned') {
    l3 = 'red';
    l3Detail = 'Money has moved with no signed document.';
  }

  const overdue = input.overdue;
  let l4 = 'unknown';
  let l4Detail = 'Promises are not on the desk.';
  if (overdue && typeof overdue.count === 'number') {
    const late = overdue.oldest || 0;
    l4 = overdue.count === 0 ? 'green' : overdue.count >= 3 || late >= 7 ? 'red' : 'amber';
    l4Detail = overdue.count === 0
      ? 'No promise to an investor or customer is past its date.'
      : `${overdue.count} promise${overdue.count === 1 ? '' : 's'} past the date. The oldest is ${late} day${late === 1 ? '' : 's'} late.`;
  }

  const talks = input.conversations;
  let l5 = 'unknown';
  let l5Detail = 'No calendar or pipeline count is on the desk for this week.';
  if (talks != null && Number.isFinite(Number(talks))) {
    const n = Number(talks);
    l5 = n >= 5 ? 'green' : n >= 2 ? 'amber' : 'red';
    l5Detail = `${n} customer conversation${n === 1 ? '' : 's'} on the desk this week. The line is 5.`;
  }

  const cash = input.cash == null ? null : Number(input.cash);
  const spend = input.committedSpend == null ? null : Number(input.committedSpend);
  let l6 = 'unknown';
  let l6Detail = 'Cash or committed spend is not on the desk.';
  if (cash != null && spend != null) {
    l6 = spend > cash ? 'red' : cash > 0 && spend >= cash * 0.5 ? 'amber' : 'green';
    l6Detail = `Committed spend is about ${dollars(spend)} a month. Cash in the bank is ${dollars(cash)}.`;
  }

  const regs = input.regulator;
  let l7 = 'unknown';
  let l7Detail = 'Regulator and partner items are not on the desk.';
  if (Array.isArray(regs)) {
    const noOwner = regs.filter((row) => !String(row.owner || '').trim()).length;
    const noDate = regs.filter((row) => row.due == null).length;
    const late = regs.filter((row) => row.due != null && dayDiff(row.due, now) < 0).length;
    l7 = noOwner > 0 || noDate >= 2 || late > 0 ? 'red' : noDate === 1 ? 'amber' : 'green';
    l7Detail = !regs.length
      ? 'No open regulator or partner item.'
      : noOwner
        ? 'An open regulator or partner item has no owner.'
        : late
          ? 'A regulator or partner item is past its date.'
          : noDate
            ? `${noDate} regulator or partner item${noDate === 1 ? ' has' : 's have'} no date.`
            : 'Every open regulator and partner item has an owner and a date.';
  }

  const exits = input.exits;
  let l8 = 'unknown';
  let l8Detail = 'No exit count is on the desk. Unknown, not clear.';
  if (exits != null && Number.isFinite(Number(exits))) {
    const n = Number(exits);
    l8 = n >= 2 ? 'red' : n === 1 ? 'amber' : 'green';
    l8Detail = n === 0 ? 'No founder, advisor, or key exit in 12 months.' : `${n} founder, advisor, or key exit${n === 1 ? '' : 's'} in 12 months.`;
  }

  return [
    lamp('L1', l1, l1Detail),
    lamp('L2', l2, l2Detail),
    lamp('L3', l3, l3Detail),
    lamp('L4', l4, l4Detail),
    lamp('L5', l5, l5Detail),
    lamp('L6', l6, l6Detail),
    lamp('L7', l7, l7Detail),
    lamp('L8', l8, l8Detail),
  ];
}

function blobOf(item) {
  return `${item.title || ''} ${item.area || ''} ${item.category || ''}`.toLowerCase();
}

function orderOf(principle) {
  const idx = ORDER.indexOf(principle);
  return idx < 0 ? ORDER.length : idx;
}

export function baseRank(item, now) {
  const pri = { urgent: 100, high: 70, normal: 40, low: 15 };
  let score = pri[item.priority] || 40;
  if (item.due != null) {
    const d = dayDiff(item.due, now);
    if (d < 0) score += (-d) * 3 + 20;
    else if (d <= 3) score += 40 - d * 5;
  }
  if (item.status === 'doing') score += 20;
  if (item.status === 'waiting') score -= 60;
  return score;
}

function shortTitle(title) {
  return String(title || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function facingOf(item, blob) {
  if (/regulator|fcac|licen[cs]e/.test(blob)) return 'regulator';
  if (item.area === 'investors' || /investor|raise|round|friends/.test(blob)) return 'investor';
  if (item.area === 'outreach' || /customer|broker|design-partner/.test(blob)) return 'customer';
  if (item.area === 'legal' && /subscription|agreement|corp doc|paper/.test(blob)) return 'investor';
  if (item.area === 'legal') return 'regulator';
  return 'internal';
}

function scoreItem(item, weights, now) {
  const blob = blobOf(item);
  const hits = [];
  const regulator = /regulator|fcac|licen[cs]e/.test(blob);
  if (!regulator && (/cash|runway|raise|investor|capital|round|friends/.test(blob) || item.area === 'investors')) {
    hits.push(['P1', weight(weights, 'P1')]);
  }
  const late = item.due != null && dayDiff(item.due, now) < 0;
  if (late && ['investors', 'outreach', 'follow_up', 'send'].includes(item.area)) hits.push(['P8', weight(weights, 'P8')]);
  if (!regulator && (item.area === 'outreach' || /customer|broker|design-partner|century|remax/.test(blob))) {
    hits.push(['P2', weight(weights, 'P2')]);
  }
  if (regulator) hits.push(['P4', weight(weights, 'P4')]);
  if (/consent|approval|subscription|agreement|corp doc|money record/.test(blob)) hits.push(['P5', weight(weights, 'P5')]);
  if (item.due != null && dayDiff(item.due, now) < -7 && /decision|choose|counsel/.test(blob)) hits.push(['P9', weight(weights, 'P9')]);
  if (/spend|burn|invoice|vendor|\bmsa\b/.test(blob)) hits.push(['P10', weight(weights, 'P10')]);
  const soon = item.due != null && dayDiff(item.due, now) <= 7;
  const counsel = soon && /subscription|agreement|wire|filing|\bsafe\b/.test(blob);
  if (counsel) hits.push(['counsel', weight(weights, 'counsel')]);

  const positive = hits.filter(([key, value]) => key !== 'counsel' && key !== 'P10' && value > 0);
  positive.sort((a, b) => b[1] - a[1] || orderOf(a[0]) - orderOf(b[0]));
  let principle = positive[0]?.[0] || (hits.some(([key]) => key === 'P10') ? 'P10' : item.area === 'dev' ? 'P11' : 'P9');
  const counselBoost = counsel ? weight(weights, 'counsel') : 0;
  if (counsel && counselBoost >= (positive[0]?.[1] || 0)) principle = 'P9';
  const score = baseRank(item, now) + hits.reduce((sum, [, value]) => sum + value, 0);
  const who = String(item.owner || 'Chad').trim() || 'Chad';
  let title = shortTitle(item.title).replace(/^Sign up\b/i, 'Open').replace(/^Sign\b/i, 'Take');
  const when = whenLabel(item.due, now);
  const text = clipLine(counsel ? `Take ${title} to counsel by ${when}` : `${title}, ${who}, by ${when}`);
  const whyNow = counsel
    ? 'This commits money inside 7 days. Counsel sees it before anyone commits.'
    : late
      ? 'This promise is past its date.'
      : `Highest open item on ${principle}.`;
  return {
    item,
    score,
    principle,
    facing: facingOf(item, blob),
    counsel,
    text,
    whyNow,
    area: item.area || 'other',
    suggestedDue: item.due == null ? null : new Date(item.due).toISOString(),
    sourceKey: item.id ? `item:${item.id}` : `text:${text}`,
    synthetic: false,
  };
}

function matchesLamp(key, item, now) {
  const blob = blobOf(item);
  if (key === 'L1') {
    const title = String(item.title || '').toLowerCase();
    const hit = /close|runway|friends/.test(title) || (/\braise\b/.test(title) && item.area === 'investors');
    return hit && (item.due == null || dayDiff(item.due, now) <= 21);
  }
  if (key === 'L2') return /concentration|one check|one investor|diversif/.test(blob);
  if (key === 'L3') return /subscription|agreement|corp doc|unsigned/.test(blob);
  if (key === 'L4') return ['investors', 'outreach', 'follow_up', 'send'].includes(item.area) && item.due != null && dayDiff(item.due, now) < 0;
  if (key === 'L5') return item.area === 'outreach' && !/regulator|fcac|licen/.test(blob);
  if (key === 'L6') return /hold spend|pause spend|cut spend|cash cannot/.test(blob);
  if (key === 'L7') return /regulator|fcac|licen/.test(blob);
  if (key === 'L8') return /exit|churn|resign/.test(blob);
  return false;
}

function synthetic(lampRow, facts, now) {
  const friday = fridayMs(now);
  const lines = {
    L1: {
      principle: 'P1',
      area: 'investors',
      facing: 'investor',
      text: `Close friends-and-family to $250,000, Chad, by ${facts.closeLabel || '30 Oct'}`,
      whyNow: lampRow.detail,
    },
    L2: {
      principle: 'P1',
      area: 'investors',
      facing: 'investor',
      text: 'Widen the round past one check, Chad, by Friday this week',
      whyNow: lampRow.detail,
    },
    L3: {
      principle: 'P5',
      area: 'legal',
      facing: 'investor',
      text: 'Paper the money already in, with counsel, by Friday this week',
      whyNow: lampRow.detail,
    },
    L4: {
      principle: 'P8',
      area: 'investors',
      facing: 'investor',
      text: 'Clear the overdue promise, Chad, by today',
      whyNow: lampRow.detail,
    },
    L5: {
      principle: 'P2',
      area: 'outreach',
      facing: 'customer',
      text: 'Book five brokerage calls, Chad, by Friday this week',
      whyNow: lampRow.detail,
    },
    L6: {
      principle: 'P10',
      area: 'dev',
      facing: 'internal',
      text: 'Hold spend that cash cannot cover, Chad, by Friday this week',
      whyNow: lampRow.detail,
    },
    L7: {
      principle: 'P4',
      area: 'legal',
      facing: 'regulator',
      text: 'Name an owner on each regulator item, Chad, by Friday this week',
      whyNow: lampRow.detail,
    },
    L8: {
      principle: 'P12',
      area: 'other',
      facing: 'internal',
      text: 'Name the exits and who covers them, Chad, by Friday this week',
      whyNow: lampRow.detail,
    },
  };
  const row = lines[lampRow.key];
  if (!row) return null;
  return {
    item: { title: row.text, area: row.area, owner: 'Chad', due: lampRow.key === 'L1' ? null : friday, priority: 'urgent', status: 'open' },
    score: 200,
    principle: row.principle,
    facing: row.facing,
    counsel: false,
    text: clipLine(row.text),
    whyNow: row.whyNow,
    area: row.area,
    suggestedDue: lampRow.key === 'L4' ? new Date(now).toISOString() : new Date(friday).toISOString(),
    sourceKey: `lamp:${lampRow.key}`,
    synthetic: true,
  };
}

function compare(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  const order = orderOf(a.principle) - orderOf(b.principle);
  if (order) return order;
  if (a.synthetic !== b.synthetic) return a.synthetic ? 1 : -1;
  return String(a.text).localeCompare(String(b.text));
}

function trackOf(row) {
  const item = row.item || {};
  const blob = blobOf(item);
  if (row.facing === 'regulator' || row.principle === 'P4' || /regulator|fcac|licen/.test(blob)) return 'regulator';
  if (row.principle === 'P8') return 'promise';
  if (row.principle === 'P10' || /spend|burn|invoice/.test(blob)) return 'cash';
  if (row.principle === 'P2' || /broker|design-partner|century|remax/.test(blob)) return 'partner';
  if (row.principle === 'P1' || (item.area === 'investors' && /raise|round|friends|investor|capital/.test(blob))) return 'raise';
  return 'other';
}

function clipStep(text) {
  return clipLine(String(text || '').replace(/\bSign\b/g, 'Take').replace(/Atherton/g, 'counsel'));
}

function howFor(row) {
  const track = trackOf(row);
  const blob = blobOf(row.item || {});
  let steps;
  if (track === 'raise') {
    steps = [
      'Open the next private-network conversation with Kevin.',
      'Then open Zahar, BJ, and Daryl, one $25,000 chunk each.',
      'Write who, the chunk, the step, the next action, and the next date.',
    ];
  } else if (track === 'partner') {
    steps = [
      'Name the next brokerage on the design-partner list.',
      'Send the discovery note and ask for a call.',
      'Log the reply and the next date.',
    ];
  } else if (track === 'regulator') {
    steps = [
      'Name the body and the one question to ask.',
      'Send the reach-out note.',
      'Log the reply and move on.',
    ];
  } else if (track === 'promise') {
    steps = [
      'Name the promise and who is waiting.',
      'Do the next step today.',
      'Write the new date on the item.',
    ];
  } else if (track === 'cash' || row.principle === 'P10') {
    steps = [
      'List every bill cash cannot cover this month.',
      'Protect the product build and defer the rest.',
      'Pay the deferred lines only as cash from the round lands.',
    ];
  } else if (row.counsel || row.principle === 'P9' || /subscription|agreement|corp doc/.test(blob)) {
    steps = [
      'Send the subscription draft to counsel with the open questions.',
      'Take their edits. Leave the signature with counsel.',
      'Paper each payment only as counsel directs.',
    ];
  } else {
    steps = [
      'Name the next action in one line.',
      'Set the owner and the date.',
      'Do that step, then log what happened.',
    ];
  }
  return steps.map(clipStep).filter(Boolean).slice(0, 4);
}

function whyFor(row) {
  const track = trackOf(row);
  if (track === 'raise') return '$80,000 is in. $170,000 to go, in about seven $25,000 cheques.';
  if (track === 'cash' || row.principle === 'P10') return 'Cash cannot cover the burn. Protect the product build and defer the rest.';
  return String(row.whyNow || '').replace(/[\u2013\u2014]/g, '-');
}

function publish(row) {
  return {
    text: row.text,
    principle: row.principle,
    principleLabel: PRINCIPLES[row.principle] || row.principle,
    whyNow: whyFor(row),
    how: howFor(row),
    area: row.area,
    suggestedDue: row.suggestedDue,
    facing: row.facing,
    sourceKey: row.sourceKey,
    score: row.score,
  };
}

export function pickMoves(input) {
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const weights = { ...DEFAULT_WEIGHTS, ...(input.weights || {}) };
  const quiet = new Set([...(input.quietTexts || []), ...(input.quietKeys || [])].map((value) => String(value || '').trim()).filter(Boolean));
  const open = (input.items || []).filter((item) => item.status !== 'done' && item.status !== 'dropped');
  const scored = [];
  for (const item of open) {
    const row = scoreItem(item, weights, now);
    if (quiet.has(row.text) || quiet.has(row.sourceKey)) continue;
    scored.push(row);
  }
  for (const lampRow of input.lamps || []) {
    if (lampRow.state !== 'red') continue;
    if (quiet.has(`lamp:${lampRow.key}`)) continue;
    const matches = scored.filter((row) => !row.synthetic && matchesLamp(lampRow.key, row.item, now));
    if (matches.length) {
      matches.sort(compare);
      const best = matches[0];
      if (best.score < 200) best.score = 200;
      best.whyNow = lampRow.detail || best.whyNow;
    } else if (!scored.some((row) => row.sourceKey === `lamp:${lampRow.key}`)) {
      const row = synthetic(lampRow, input.facts || {}, now);
      if (row && !quiet.has(row.text) && !quiet.has(row.sourceKey)) scored.push(row);
    }
  }
  const pool = scored.slice().sort(compare);
  return pool.map((row, index) => ({ rank: index + 1, ...publish(row) }));
}
