import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

/* Safe vault audit log: when the vault was opened, locked or a wrong code was entered. No codes, no document names. */
let ready: Promise<void> | null = null;
export function ensureVaultAudit(sql: Sql) {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS vault_audit (
        id bigserial PRIMARY KEY,
        owner_id text NOT NULL,
        at timestamptz NOT NULL DEFAULT now(),
        what text NOT NULL DEFAULT ''
      )`;
      await sql`CREATE INDEX IF NOT EXISTS vault_audit_owner_at ON vault_audit (owner_id, at DESC)`;
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

export async function logVault(sql: Sql | null | undefined, ownerId: string, what: string) {
  if (!sql || !ownerId) return;
  try {
    await ensureVaultAudit(sql);
    await sql`INSERT INTO vault_audit (owner_id, what) VALUES (${ownerId}, ${what.slice(0, 120)})`;
  } catch (err) {
    fail('vault_audit', err);
  }
}
