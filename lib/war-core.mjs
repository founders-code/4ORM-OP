/** Pure War Room helpers. No database, no model. */

export const NEWS_CATEGORIES = [
  'Compliance',
  'AI',
  'Counseling',
  'Fintech & regulation',
  'Mortgage',
  'Fraud & scams',
  'Grants',
  'Payments / FINTRAC',
  'Competitors (Drata/Vanta/Aveni)',
  'Design-partner targets (Century 21/Remax)',
  'Fundraising / VC',
];

const COMMIT_RE = /\b(I will|I'll|I\u2019ll|I\u2019m going to|I'm going to|I am going to)\b/i;

export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function daysUntil(iso, now = new Date()) {
  const target = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${todayKey(now)}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(today)) return null;
  return Math.round((target - today) / 86400000);
}

function cleanLine(value) {
  return String(value || '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractCommitments(notes) {
  const out = [];
  const seen = new Set();
  for (const note of notes || []) {
    const lines = []
      .concat(note.others || [])
      .concat(note.improve || [])
      .concat((note.intel || []).map((item) => (typeof item === 'string' ? item : item?.value || '')));
    for (const line of lines) {
      const text = cleanLine(line).slice(0, 240);
      if (!text || !COMMIT_RE.test(text)) continue;
      const sourceNoteId = String(note.id || '');
      const key = `${sourceNoteId}|${text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text,
        sourceNoteId,
        madeOn: String(note.date || '').slice(0, 10) || null,
      });
    }
  }
  return out;
}

export function zoneOf(move) {
  const principle = String(move?.principle || '');
  const facing = String(move?.facing || '');
  const area = String(move?.area || '');
  const blob = String(move?.text || '').toLowerCase();
  if (principle === 'P4' || facing === 'regulator' || /regulator|fcac|licen/.test(blob)) return 'regulator';
  if (principle === 'P2' || /broker|design-partner|century|remax/.test(blob) || (area === 'outreach' && principle !== 'P1')) return 'partner';
  return 'raise';
}

export function fallbackPlan(input) {
  const title = cleanLine(input?.title || 'This action').slice(0, 180) || 'This action';
  const given = (input?.steps || []).map((step) => cleanLine(step)).filter(Boolean).slice(0, 4);
  const steps = (given.length >= 2 ? given : [
    'Write the next action in one line.',
    'Name who it is for and the date.',
    'Do that step, then log what happened.',
  ]).map((text) => ({ text: text.slice(0, 180), done: false }));
  const needs = (input?.needs || []).map((item) => cleanLine(item)).filter(Boolean).slice(0, 8);
  const outreach = input?.area === 'outreach' || input?.area === 'send' || /call|email|note|outreach|broker/.test(title.toLowerCase());
  const draft = outreach
    ? `Hello,\n\nI am writing about ${title}.\n\nCould we take 20 minutes this week?\n\nChad`
    : '';
  return { steps, needs, draft };
}

export function asSteps(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw.map((step) => {
    if (step && typeof step === 'object') {
      return { text: cleanLine(step.text).slice(0, 180), done: !!step.done };
    }
    return { text: cleanLine(step).slice(0, 180), done: false };
  }).filter((step) => step.text).slice(0, 12);
}

export function asNeeds(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw.map((item) => cleanLine(typeof item === 'object' ? item.text || item.name : item)).filter(Boolean).slice(0, 12);
}
