import { readFileSync } from 'fs';
import path from 'path';
import type { Sql } from './db';
import { fail } from './log';

type SeedRow = {
  org?: string;
  kind?: string;
  id?: string;
  n?: string;
  v?: string;
  st?: string;
  dt?: string;
  own?: string;
  note?: string;
};

function parseDt(s: string) {
  const t = Date.parse(String(s || ''));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function loadLocal(): SeedRow[] {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'data/vault_seed.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function asRows(raw: unknown): SeedRow[] {
  if (Array.isArray(raw)) return raw as SeedRow[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { documents?: unknown; docs?: unknown; register?: unknown; rows?: unknown };
    for (const key of ['documents', 'docs', 'register', 'rows'] as const) {
      if (Array.isArray(obj[key])) return obj[key] as SeedRow[];
    }
  }
  return [];
}


function norm(row: SeedRow): SeedRow | null {
  const id = String(row.id || (row as { doc_id?: string }).doc_id || '').trim().slice(0, 40);
  const name = String(row.n || (row as { name?: string; title?: string }).name || (row as { title?: string }).title || '').trim().slice(0, 200);
  if (!id || !name) return null;
  return {
    org: String(row.org || '4ormIQ').slice(0, 80),
    kind: String(row.kind || 'Registers').slice(0, 80),
    id,
    n: name,
    v: String(row.v || (row as { version?: string }).version || '').slice(0, 40),
    st: String(row.st || (row as { status?: string }).status || '').slice(0, 40),
    dt: String(row.dt || ''),
    own: String(row.own || (row as { owner?: string }).owner || '').slice(0, 80),
    note: String(row.note || '').slice(0, 400),
  };
}

/** Seed vault_docs from the 17f register plus 4ormIQ DR-001 if that endpoint answers. Never overwrites an existing doc_id. */
export async function seedVaultDocs(sql: Sql, ownerId: string) {
  try {
    /* 4ormIQ keeps its register private (nothing under its /api/_ path is published), so the Vault seeds from the local register only. */
    const remote: SeedRow[] = [];
    const seen = new Set<string>();
    const rows: SeedRow[] = [];
    for (const raw of [...remote, ...loadLocal()]) {
      const row = norm(raw);
      if (!row || !row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    let added = 0;
    for (const row of rows) {
      const found = await sql`
        SELECT id FROM vault_docs WHERE owner_id = ${ownerId} AND doc_id = ${row.id} LIMIT 1
      `;
      if (found.length) continue;
      const verified = parseDt(row.dt || '');
      await sql`
        INSERT INTO vault_docs (owner_id, org, kind, doc_id, name, version, status, verified_at, owner, note, json_path)
        VALUES (
          ${ownerId}, ${row.org || ''}, ${row.kind || ''}, ${row.id}, ${row.n || ''},
          ${row.v || ''}, ${row.st || ''}, ${verified}, ${row.own || ''}, ${row.note || ''},
          ${remote.length ? 'api/_dr001.json' : 'data/vault_seed.json'}
        )
      `;
      added += 1;
    }
    return { added, total: rows.length };
  } catch (err) {
    fail('vault_seed', err);
    return { added: 0, total: 0 };
  }
}
