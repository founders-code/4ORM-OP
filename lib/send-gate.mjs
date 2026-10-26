// Spaces send gate: a real send goes out only after a test send of the SAME content reached Chad.
// "Same content" = subject template + body template + the listed recipients' emails (order-free).
import { createHash } from 'node:crypto';

export const TEST_SEND_TO = 'chad@4ormfinance.com';

function norm(v) {
  return String(v == null ? '' : v).replace(/\r\n/g, '\n');
}

/** Stable sha256 of what a send would deliver. */
export function spaceSendHash({ subject, body, recipients }) {
  const people = (Array.isArray(recipients) ? recipients : [])
    .map((r) => String((r && typeof r === 'object' ? r.email : r) || '').trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(people)].sort();
  const payload = JSON.stringify({ s: norm(subject), b: norm(body), r: unique });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Decide whether a real send may go out. `findTest(hash)` resolves true when a successful test send with
 * that hash is on record for this Space. Any lookup error refuses the send (fails closed).
 */
export async function gateRealSend(content, findTest) {
  const hash = spaceSendHash(content);
  let tested = false;
  try {
    tested = !!(await findTest(hash));
  } catch {
    tested = false;
  }
  return { ok: tested, hash };
}
