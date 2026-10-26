import type { BoardSession } from './session';
import { fail } from './log';

type Sql = NonNullable<BoardSession['sql']>;

let ready: Promise<void> | null = null;

/** Additive, idempotent: vc_inbox rows are soft-deleted (deleted_at) instead of removed. */
export function ensureVcInbox(sql: Sql): Promise<void> {
  if (!ready) {
    ready = Promise.resolve(sql`ALTER TABLE vc_inbox ADD COLUMN IF NOT EXISTS deleted_at timestamptz`)
      .then(() => undefined)
      .catch((err) => {
        ready = null;
        fail('vc_inbox_migrate', err);
      });
  }
  return ready;
}
