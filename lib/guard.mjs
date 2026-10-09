import { createHash, timingSafeEqual } from 'crypto';

/** Fixed-length compare. A missing expected secret never passes. */
export function tokenOk(presented, expected) {
  if (!expected || !presented) return false;
  const digest = (value) => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

export const AREAS = ['investors', 'outreach', 'legal', 'dev', 'send', 'follow_up', 'other'];
export const STATUSES = ['new', 'doing', 'waiting', 'done', 'dropped'];
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
