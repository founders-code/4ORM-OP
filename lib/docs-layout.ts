import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

export type DocLayout = {
  docId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const SNAP = 12;
const MIN = 120;

function snap(n: number) {
  return Math.max(0, Math.round(Number(n) / SNAP) * SNAP);
}

function size(n: number, fallback: number) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.max(MIN, snap(v));
}

export async function listDocsLayout(sql: Sql, ownerId: string): Promise<DocLayout[]> {
  try {
    const rows = await sql`
      SELECT doc_id, x, y, w, h FROM docs_layout WHERE owner_id = ${ownerId}
    `;
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      docId: String(r.doc_id),
      x: snap(Number(r.x) || 0),
      y: snap(Number(r.y) || 0),
      w: size(Number(r.w), 168),
      h: size(Number(r.h), 210),
    }));
  } catch (err) {
    fail('docs_layout_list', err);
    return [];
  }
}

export async function saveDocsLayout(sql: Sql, ownerId: string, items: Array<Partial<DocLayout>>) {
  const out: DocLayout[] = [];
  for (const raw of (items || []).slice(0, 400)) {
    const docId = String(raw.docId || '').slice(0, 80);
    if (!docId) continue;
    const row: DocLayout = {
      docId,
      x: snap(Number(raw.x) || 0),
      y: snap(Number(raw.y) || 0),
      w: size(Number(raw.w), 168),
      h: size(Number(raw.h), 210),
    };
    try {
      await sql`
        INSERT INTO docs_layout (owner_id, doc_id, x, y, w, h, updated_at)
        VALUES (${ownerId}, ${row.docId}, ${row.x}, ${row.y}, ${row.w}, ${row.h}, now())
        ON CONFLICT (owner_id, doc_id) DO UPDATE SET
          x = EXCLUDED.x, y = EXCLUDED.y, w = EXCLUDED.w, h = EXCLUDED.h, updated_at = now()
      `;
      out.push(row);
    } catch (err) {
      fail('docs_layout_save', err);
    }
  }
  return out;
}
