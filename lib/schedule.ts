import type { NeonQueryFunction } from '@neondatabase/serverless';
import { withCreds } from './creds';
import { gmailSend } from './google';
import { fail, note } from './log';
import { STALE_SENDING_MS, processDue, vancouverLabel } from './schedule-core.mjs';
import { loadCredsFor } from './vault';

type Sql = NeonQueryFunction<false, false>;

export type ScheduledRow = {
  id: string;
  owner_id: string;
  creds_user: string;
  status: string;
  send_at: string;
  to_addrs: string[];
  cc_addrs: string[];
  bcc_addrs: string[];
  subject: string;
  body: string;
  attachments: unknown;
  thread_id: string;
  message_id: string;
  reply: boolean;
  nudge: boolean;
  log_pipeline: boolean;
  attempts: number;
  last_error: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Additive and idempotent. Soft delete only (deleted_at). */
export async function ensureScheduledMail(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS scheduled_mail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    creds_user text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    send_at timestamptz NOT NULL,
    to_addrs jsonb NOT NULL DEFAULT '[]'::jsonb,
    cc_addrs jsonb NOT NULL DEFAULT '[]'::jsonb,
    bcc_addrs jsonb NOT NULL DEFAULT '[]'::jsonb,
    subject text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
    thread_id text NOT NULL DEFAULT '',
    message_id text NOT NULL DEFAULT '',
    reply boolean NOT NULL DEFAULT false,
    nudge boolean NOT NULL DEFAULT false,
    log_pipeline boolean NOT NULL DEFAULT false,
    attempts int NOT NULL DEFAULT 0,
    last_error text NOT NULL DEFAULT '',
    claimed_at timestamptz,
    sent_at timestamptz,
    cancelled_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS scheduled_mail_due ON scheduled_mail (status, send_at) WHERE deleted_at IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS scheduled_mail_owner ON scheduled_mail (owner_id, created_at DESC)`;
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function shapeScheduled(row: Record<string, unknown>) {
  const at = Date.parse(String(row.send_at || ''));
  return {
    id: String(row.id),
    status: String(row.status || ''),
    sendAt: Number.isFinite(at) ? new Date(at).toISOString() : '',
    sendAtLabel: Number.isFinite(at) ? vancouverLabel(at) : '',
    to: list(row.to_addrs),
    cc: list(row.cc_addrs),
    bcc: list(row.bcc_addrs),
    subject: String(row.subject || ''),
    text: String(row.body || ''),
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    threadId: String(row.thread_id || ''),
    messageId: String(row.message_id || ''),
    reply: row.reply === true,
    nudge: row.nudge === true,
    log: row.log_pipeline === true,
    error: String(row.last_error || ''),
    sentAt: row.sent_at ? new Date(String(row.sent_at)).toISOString() : '',
    late: String(row.status) === 'queued' && Number.isFinite(at) && at < Date.now() - 10 * 60 * 1000,
  };
}

export type ScheduledMessage = {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  threadId: string;
  messageId: string;
  reply: boolean;
  attachments: Array<{ name: string; url: string; driveFileId: string }>;
  nudge: boolean;
  log: boolean;
};

export async function createScheduled(sql: Sql, ownerId: string, credsUser: string, msg: ScheduledMessage, at: number) {
  const rows = await sql`
    INSERT INTO scheduled_mail (owner_id, creds_user, status, send_at, to_addrs, cc_addrs, bcc_addrs, subject, body,
      attachments, thread_id, message_id, reply, nudge, log_pipeline)
    VALUES (${ownerId}, ${credsUser}, 'queued', ${new Date(at).toISOString()}::timestamptz,
      ${JSON.stringify(msg.to)}::jsonb, ${JSON.stringify(msg.cc)}::jsonb, ${JSON.stringify(msg.bcc)}::jsonb,
      ${msg.subject}, ${msg.text}, ${JSON.stringify(msg.attachments)}::jsonb, ${msg.threadId}, ${msg.messageId},
      ${msg.reply}, ${msg.nudge}, ${msg.log})
    RETURNING *
  `;
  return rows[0] ? shapeScheduled(rows[0] as Record<string, unknown>) : null;
}

/** Queued and recent (14 days) rows for the Scheduled list. */
export async function listScheduled(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT * FROM scheduled_mail
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      AND (status IN ('queued', 'sending', 'failed') OR updated_at > now() - interval '14 days')
    ORDER BY CASE WHEN status IN ('queued', 'sending') THEN 0 WHEN status = 'failed' THEN 1 ELSE 2 END, send_at ASC
    LIMIT 100
  `;
  return (rows as Array<Record<string, unknown>>).map(shapeScheduled);
}

/**
 * Edit a queued (or failed) row. The WHERE clause is the guard: a row that is already sending or sent is not
 * touched, so the caller gets null and answers 409. Editing a failed row puts it back in the queue.
 */
export async function editScheduled(sql: Sql, ownerId: string, id: string, msg: ScheduledMessage, at: number) {
  const rows = await sql`
    UPDATE scheduled_mail SET
      status = 'queued', send_at = ${new Date(at).toISOString()}::timestamptz,
      to_addrs = ${JSON.stringify(msg.to)}::jsonb, cc_addrs = ${JSON.stringify(msg.cc)}::jsonb,
      bcc_addrs = ${JSON.stringify(msg.bcc)}::jsonb, subject = ${msg.subject}, body = ${msg.text},
      attachments = ${JSON.stringify(msg.attachments)}::jsonb, thread_id = ${msg.threadId}, message_id = ${msg.messageId},
      reply = ${msg.reply}, nudge = ${msg.nudge}, log_pipeline = ${msg.log}, last_error = '', updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL AND status IN ('queued', 'failed')
    RETURNING *
  `;
  return rows[0] ? shapeScheduled(rows[0] as Record<string, unknown>) : null;
}

/** Only the time changes. Same guard as edit. */
export async function rescheduleScheduled(sql: Sql, ownerId: string, id: string, at: number) {
  const rows = await sql`
    UPDATE scheduled_mail SET status = 'queued', send_at = ${new Date(at).toISOString()}::timestamptz, last_error = '', updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL AND status IN ('queued', 'failed')
    RETURNING *
  `;
  return rows[0] ? shapeScheduled(rows[0] as Record<string, unknown>) : null;
}

export async function cancelScheduled(sql: Sql, ownerId: string, id: string) {
  const rows = await sql`
    UPDATE scheduled_mail SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL AND status IN ('queued', 'failed')
    RETURNING *
  `;
  return rows[0] ? shapeScheduled(rows[0] as Record<string, unknown>) : null;
}

/** Hide a finished row from the list (soft delete). Queued or sending rows must be cancelled first. */
export async function hideScheduled(sql: Sql, ownerId: string, id: string) {
  const rows = await sql`
    UPDATE scheduled_mail SET deleted_at = now(), updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL AND status IN ('sent', 'cancelled', 'failed')
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getScheduled(sql: Sql, ownerId: string, id: string) {
  const rows = await sql`SELECT * FROM scheduled_mail WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
  return rows[0] ? shapeScheduled(rows[0] as Record<string, unknown>) : null;
}

/**
 * Atomic claim: one UPDATE moves due rows queued -> sending. FOR UPDATE SKIP LOCKED means two overlapping
 * cron runs can never claim the same row, and the status check means a sent row is never picked again.
 */
async function claimDue(sql: Sql, ownerId: string, max: number) {
  const rows = await sql`
    UPDATE scheduled_mail SET status = 'sending', claimed_at = now(), attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM scheduled_mail
      WHERE status = 'queued' AND owner_id = ${ownerId} AND deleted_at IS NULL AND send_at <= now()
      ORDER BY send_at ASC
      LIMIT ${max}
      FOR UPDATE SKIP LOCKED
    ) AND status = 'queued'
    RETURNING *
  `;
  return rows as Array<Record<string, unknown>>;
}

async function finishRow(sql: Sql, id: string, move: 'sent' | 'fail', why: string) {
  if (move === 'sent') {
    await sql`UPDATE scheduled_mail SET status = 'sent', sent_at = now(), last_error = '', updated_at = now() WHERE id = ${id}::uuid AND status = 'sending'`;
  } else {
    await sql`UPDATE scheduled_mail SET status = 'failed', last_error = ${why.slice(0, 300)}, updated_at = now() WHERE id = ${id}::uuid AND status = 'sending'`;
  }
}

/** A run that died mid-send leaves 'sending'. It may already be in Gmail, so it is marked failed and never resent. */
async function failStale(sql: Sql) {
  const cutoff = new Date(Date.now() - STALE_SENDING_MS).toISOString();
  await sql`
    UPDATE scheduled_mail SET status = 'failed',
      last_error = 'The send was interrupted. Check Gmail Sent before re-queueing it.', updated_at = now()
    WHERE status = 'sending' AND claimed_at < ${cutoff}::timestamptz
  `;
}

/** Called by the 5-minute cron (/api/cron/live) for the room owner only. Sends exactly the rows Chad scheduled. */
export async function sendDueMail(sql: Sql, ownerId: string) {
  try {
    await ensureScheduledMail(sql);
    await failStale(sql);
    const result = await processDue({
      max: 5,
      claim: (max: number) => claimDue(sql, ownerId, max),
      send: async (row: Record<string, unknown>) => {
        const to = list(row.to_addrs);
        if (!to.length) return { ok: false };
        const creds = await loadCredsFor(String(row.creds_user || ownerId));
        return withCreds(creds, () => gmailSend({
          to: to[0],
          cc: to.slice(1).concat(list(row.cc_addrs)),
          bcc: list(row.bcc_addrs),
          subject: String(row.subject || ''),
          text: String(row.body || ''),
          threadId: String(row.thread_id || ''),
          messageId: String(row.message_id || ''),
          reply: row.reply === true,
        }));
      },
      finish: (row: Record<string, unknown>, move: 'sent' | 'fail', why: string) => finishRow(sql, String(row.id), move, why),
    });
    if (result.sent || result.failed) {
      note('scheduled_mail', `sent=${result.sent} failed=${result.failed}`);
      const { tape } = await import('./outbound');
      await tape(result.failed ? 'warn' : 'ok', 'send', `scheduled mail sent=${result.sent} failed=${result.failed}`);
    }
    return { sent: result.sent, failed: result.failed, sentIds: result.ids as string[] };
  } catch (err) {
    fail('scheduled_mail', err);
    return { sent: 0, failed: 0, sentIds: [] as string[] };
  }
}
