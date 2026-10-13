/** Open 30-minute starts from 6:00 through 20:30 America/Los_Angeles. Busy ranges are grey. */

function laParts(ms) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const bag = {};
  for (const part of fmt.formatToParts(new Date(ms))) bag[part.type] = part.value;
  return bag;
}

function laStamp(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month - 1, day, hour + 7, minute, 0);
  const shown = laParts(guess);
  const shownMs = Date.UTC(Number(shown.year), Number(shown.month) - 1, Number(shown.day), Number(shown.hour), Number(shown.minute), 0);
  const want = Date.UTC(year, month - 1, day, hour, minute, 0);
  return guess + (want - shownMs);
}

function shiftDay(year, month, day, offset) {
  const next = new Date(Date.UTC(year, month - 1, day + offset));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export function openSlots(nowMs, busy, days = 14) {
  const parts = laParts(nowMs);
  const span = Math.min(Math.max(Number(days) || 14, 1), 14);
  const slots = [];
  for (let offset = 0; offset < span; offset += 1) {
    const date = shiftDay(Number(parts.year), Number(parts.month), Number(parts.day), offset);
    const day = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    for (let hour = 6; hour < 21; hour += 1) {
      for (const minute of [0, 30]) {
        if (hour === 20 && minute > 30) continue;
        const start = laStamp(date.year, date.month, date.day, hour, minute);
        const end = start + 30 * 60 * 1000;
        if (end <= nowMs) continue;
        const hit = (busy || []).some((row) => start < Number(row.end) && end > Number(row.start));
        const label = `${day} ${String(hour).padStart(2, '0')}:${minute === 0 ? '00' : '30'}`;
        slots.push({ start, end, label, day, free: !hit });
      }
    }
  }
  return slots;
}
