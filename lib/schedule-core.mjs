/* Scheduled send (B34): pure helpers shared by lib/schedule.ts and the tests.
   No I/O here. Times are America/Vancouver wall time, 24-hour. */

export const SCHEDULE_TZ = 'America/Vancouver';
export const SCHEDULE_STATUSES = ['queued', 'sending', 'sent', 'cancelled', 'failed'];
/** A row stuck in 'sending' longer than this is marked failed, never retried (it may already be in Gmail). */
export const STALE_SENDING_MS = 10 * 60 * 1000;
/** Earliest and latest a send may be scheduled. */
export const MIN_LEAD_MS = 60 * 1000;
export const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

/** Allowed status moves. Anything else is refused, so a sent row can never be sent again. */
const MOVES = {
  claim: { from: ['queued'], to: 'sending' },
  sent: { from: ['sending'], to: 'sent' },
  fail: { from: ['sending'], to: 'failed' },
  stale: { from: ['sending'], to: 'failed' },
  cancel: { from: ['queued', 'failed'], to: 'cancelled' },
  edit: { from: ['queued', 'failed'], to: 'queued' },
};

export function nextStatus(current, move) {
  const rule = MOVES[move];
  if (!rule) return null;
  return rule.from.includes(String(current)) ? rule.to : null;
}

function partsIn(ms, timeZone = SCHEDULE_TZ) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const bag = {};
  for (const p of fmt.formatToParts(new Date(ms))) bag[p.type] = p.value;
  return {
    ymd: `${bag.year}-${bag.month}-${bag.day}`,
    hm: `${bag.hour === '24' ? '00' : bag.hour}:${bag.minute}`,
    weekday: bag.weekday,
  };
}

/** Minutes east of UTC for the zone at that instant. */
function offsetMin(ms, timeZone = SCHEDULE_TZ) {
  const p = partsIn(ms, timeZone);
  const [y, m, d] = p.ymd.split('-').map(Number);
  const [hh, mm] = p.hm.split(':').map(Number);
  return Math.round((Date.UTC(y, m - 1, d, hh, mm) - Math.floor(ms / 60000) * 60000) / 60000);
}

/** 'YYYY-MM-DD' + 'HH:MM' (24-hour) in Vancouver -> epoch ms, or null when either part is invalid. */
export function vancouverToUtc(ymd, hm) {
  const dm = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = String(hm || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!dm || !tm) return null;
  const wall = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
  if (!Number.isFinite(wall)) return null;
  let guess = wall - offsetMin(wall) * 60000;
  guess = wall - offsetMin(guess) * 60000;
  const back = partsIn(guess);
  // A wall time that does not exist (spring-forward gap) is refused rather than silently shifted.
  if (back.ymd !== `${dm[1]}-${dm[2]}-${dm[3]}` || back.hm !== `${tm[1]}:${tm[2]}`) return null;
  return guess;
}

/** Vancouver wall-clock label, 24-hour: '2026-10-27 08:00'. */
export function vancouverLabel(ms) {
  if (!Number.isFinite(Number(ms))) return '';
  const p = partsIn(Number(ms));
  return `${p.ymd} ${p.hm}`;
}

/**
 * When to send. Accepts { sendAt: ISO or epoch } or { date: 'YYYY-MM-DD', time: 'HH:MM' } (Vancouver).
 * Returns { ok: true, at } or { ok: false, error }.
 */
export function readSendAt(input, now = Date.now()) {
  const body = input || {};
  let at = null;
  if (body.date || body.time) at = vancouverToUtc(body.date, body.time);
  else if (body.sendAt != null && body.sendAt !== '') {
    const n = typeof body.sendAt === 'number' ? body.sendAt : Date.parse(String(body.sendAt));
    at = Number.isFinite(n) ? n : null;
  }
  if (at == null) return { ok: false, error: 'Pick a date and a 24-hour time (HH:MM).' };
  if (at < now + MIN_LEAD_MS) return { ok: false, error: 'That time has already passed. Pick a later time.' };
  if (at > now + MAX_AHEAD_MS) return { ok: false, error: 'Schedule within the next year.' };
  return { ok: true, at };
}

/** The menu presets, as Vancouver wall times. Each is in the future relative to now. */
export function schedulePresets(now = Date.now()) {
  const today = partsIn(now);
  const add = (ymd, n) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };
  const out = [];
  const push = (label, ymd, hm) => {
    const at = vancouverToUtc(ymd, hm);
    if (at != null && at >= now + MIN_LEAD_MS) out.push({ label, date: ymd, time: hm, at });
  };
  push('Later today, 16:00', today.ymd, '16:00');
  push('Tomorrow morning, 08:00', add(today.ymd, 1), '08:00');
  push('Tomorrow afternoon, 13:00', add(today.ymd, 1), '13:00');
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(today.weekday);
  const toMonday = dow < 0 ? 7 : 7 - dow;
  push('Monday morning, 08:00', add(today.ymd, toMonday), '08:00');
  return out;
}

const EMAIL = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

/** Comma list or array -> unique, valid, lower-case addresses (max 50). */
export function cleanAddresses(value) {
  const raw = Array.isArray(value) ? value.map((v) => String((v && v.email) || v || '')) : String(value || '').split(/[,;]/);
  const out = [];
  for (const bit of raw) {
    const m = bit.match(/<([^<>\s]+)>/);
    const email = (m ? m[1] : bit).trim().toLowerCase();
    if (EMAIL.test(email) && !out.includes(email)) out.push(email);
  }
  return out.slice(0, 50);
}

/** The stored message, validated. Returns { ok, message } or { ok: false, error }. */
export function readMessage(body) {
  const b = body || {};
  const to = cleanAddresses(b.to);
  if (!to.length) return { ok: false, error: 'Add a valid recipient.' };
  const cc = cleanAddresses(b.cc).filter((e) => !to.includes(e));
  const bcc = cleanAddresses(b.bcc).filter((e) => !to.includes(e) && !cc.includes(e));
  const subject = String(b.subject || '').replace(/[\r\n]/g, ' ').slice(0, 200);
  const text = String(b.text ?? b.body ?? '').slice(0, 20000);
  if (!subject.trim() && !text.trim()) return { ok: false, error: 'Write a subject or a message first.' };
  const threadId = /^[A-Za-z0-9_-]{6,64}$/.test(String(b.threadId || '')) ? String(b.threadId) : '';
  const messageId = /^<[^<>\s]{3,300}>$/.test(String(b.messageId || '')) ? String(b.messageId) : '';
  const attachments = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 25).map((a) => ({
    name: String((a && (a.name || a.title)) || 'File').slice(0, 200),
    url: /^https:\/\//i.test(String((a && a.url) || '')) ? String(a.url).slice(0, 1000) : '',
    driveFileId: /^[\w-]{8,}$/.test(String((a && a.driveFileId) || '')) ? String(a.driveFileId) : '',
  }));
  return {
    ok: true,
    message: {
      to,
      cc,
      bcc,
      subject,
      text,
      threadId,
      messageId,
      reply: !!(b.reply && threadId),
      attachments,
      nudge: !!b.nudge,
      log: !!b.log,
    },
  };
}

/**
 * Send what is due. Pure orchestration so it can be tested: `claim()` must atomically move due rows
 * queued -> sending and return them; `send(row)` returns { ok, drafted }; `finish(row, move, note)`
 * moves sending -> sent | failed only if the row is still 'sending'. A failed send is never retried
 * automatically: Chad re-queues it with Edit.
 */
export async function processDue({ claim, send, finish, max = 5 }) {
  const rows = await claim(max);
  const result = { sent: 0, failed: 0, ids: [] };
  for (const row of rows) {
    let outcome;
    try {
      outcome = await send(row);
    } catch (err) {
      outcome = { ok: false, error: String((err && err.message) || err || 'error') };
    }
    if (outcome && outcome.ok && !outcome.drafted) {
      await finish(row, 'sent', '');
      result.sent += 1;
      result.ids.push(row.id);
    } else {
      const note = outcome && outcome.drafted ? 'Gmail refused the send; it was saved as a Gmail draft instead.' : 'Gmail did not take the send.';
      await finish(row, 'fail', note);
      result.failed += 1;
    }
  }
  return result;
}
