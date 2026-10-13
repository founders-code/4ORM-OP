import { createHash, timingSafeEqual } from 'crypto';

/** Fixed-length compare. A missing expected secret never passes. */
export function tokenOk(presented, expected) {
  if (!expected || !presented) return false;
  const digest = (value) => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

export const AREAS = ['investors', 'outreach', 'legal', 'dev', 'send', 'follow_up', 'other'];
export const STATUSES = ['new', 'doing', 'waiting', 'done', 'dropped', 'open'];
export const PRIORITIES = ['urgent', 'high', 'normal', 'low'];

export function allowArea(value) {
  return AREAS.includes(value) ? value : null;
}
export function allowStatus(value) {
  return STATUSES.includes(value) ? value : null;
}
export function allowPriority(value) {
  return PRIORITIES.includes(value) ? value : null;
}

/** ISO string, epoch number, or null. Invalid values are rejected. */
export function parseDue(value) {
  if (value == null || value === '') return { ok: true, iso: null };
  const numeric = typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()));
  const date = numeric ? new Date(Number(value)) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return { ok: false, iso: null };
  return { ok: true, iso: date.toISOString() };
}

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function edmontonMidnight(year, month, day) {
  const probe = Date.UTC(year, month - 1, day, 18, 0, 0);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag = {};
  for (const part of fmt.formatToParts(new Date(probe))) bag[part.type] = part.value;
  const shown = Date.UTC(Number(bag.year), Number(bag.month) - 1, Number(bag.day), Number(bag.hour), Number(bag.minute), Number(bag.second));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - (shown - probe));
}

/** Sunday midnight in America/Edmonton through six weeks. */
export function visibleCalendarWindow(now = new Date()) {
  const parts = edmontonParts(now);
  const dow = WEEKDAY[String(parts.weekday).slice(0, 3)] ?? 0;
  const cursor = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  cursor.setUTCDate(cursor.getUTCDate() - dow);
  const start = edmontonMidnight(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
  const endDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 42));
  const end = edmontonMidnight(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate());
  return { start, end };
}

export const CONTACT_TYPES = ['vc', 'business', 'grant_reg', 'other'];
export const CONTACT_CATEGORIES = ['vc', 'angel', 'business', 'grant', 'regulator', 'board', 'facebook', 'personal', 'other'];

/** Tag a contact from the words already on the row. Stored category wins when it is set. */
export function inferContactCategory(blob) {
  const text = ` ${String(blob || '').toLowerCase()} `;
  if (/\bangel\b|\bsyndicate\b/.test(text)) return 'angel';
  if (/\binvestor\b|\bcapital\b|\bventures\b|\bvc\b|\bfund\b/.test(text)) return 'vc';
  if (/\blaw\b|\bllp\b|\bfasken\b|\bcounsel\b|\bfintrac\b|\brpaa\b|\bcompliance\b|\bregulator\b|\bsecurities\b|\bfcac\b|\bosc\b/.test(text)) return 'regulator';
  if (/century 21|remax|\bbroker/.test(text)) return 'business';
  if (/grant|sr&ed|alberta innovates|innovate|\birap\b|\bnserc\b|\bfoundation\b|\buniversity\b|\bministry\b|\bgovernment\b/.test(text)) return 'grant';
  if (/\bboard\b/.test(text)) return 'board';
  return 'other';
}
export const CONTACT_TIERS = ['A', 'B', 'C'];
export const CONTACT_STAGES = ['new', 'queued', 'contacted', 'replied', 'meeting', 'committed', 'lost'];
export const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink'];

export function allowContactType(value) {
  return CONTACT_TYPES.includes(value) ? value : null;
}
export function allowContactCategory(value) {
  return CONTACT_CATEGORIES.includes(value) ? value : null;
}
export function allowTier(value) {
  return CONTACT_TIERS.includes(value) ? value : null;
}
export function allowStage(value) {
  return CONTACT_STAGES.includes(value) ? value : null;
}
export function allowNoteColor(value) {
  return NOTE_COLORS.includes(value) ? value : null;
}

export const PACKAGE_KINDS = ['data_room', 'investor', 'partner', 'regulator'];
export const PACKAGE_STATUSES = ['draft', 'ready', 'sent'];

export function allowPackageKind(value) {
  return PACKAGE_KINDS.includes(value) ? value : null;
}
export function allowPackageStatus(value) {
  return PACKAGE_STATUSES.includes(value) ? value : null;
}

export const SPACE_TYPES = ['person', 'project'];

export function allowSpaceType(value) {
  return SPACE_TYPES.includes(value) ? value : null;
}

/** Documented vendor ceilings. Checked before any paid or quota call. */
export const CEILINGS = {
  google_calendar: 30,
  google_drive: 40,
  gmail: 10,
  gohighlevel: 40,
};

export const BUDGET_WINDOW_MS = 5 * 60 * 1000;

export function edmontonParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  return bag;
}

export function windowKey(date = new Date()) {
  const p = edmontonParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Weekday 06:00 America/Edmonton. Vercel cron fires the UTC hours that cover both MST and MDT. */
export function isBriefHour(date = new Date()) {
  const p = edmontonParts(date);
  const weekday = p.weekday;
  const workday = weekday !== 'Sat' && weekday !== 'Sun';
  return workday && p.hour === '06';
}
