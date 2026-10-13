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

export function openSlots(nowMs, busy) {
  const parts = laParts(nowMs);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const slots = [];
  for (let hour = 6; hour < 21; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === 20 && minute === 30) {
        /* last start is 8:30 PM so the block ends at 9:00 PM */
      }
      if (hour === 20 && minute > 30) continue;
      const start = laStamp(year, month, day, hour, minute);
      const end = start + 30 * 60 * 1000;
      const hit = (busy || []).some((row) => start < Number(row.end) && end > Number(row.start));
      const label = `${String(hour).padStart(2, '0')}:${minute === 0 ? '00' : '30'}`;
      slots.push({ start, end, label, free: !hit });
    }
  }
  return slots.filter((slot) => {
    const hour = Number(laParts(slot.start).hour);
    return hour < 21;
  });
}
