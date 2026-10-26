import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { softDeleteCategory } from '@/lib/link-cats';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;
const UNCAT = 'Uncategorized';

function clean(value: unknown) {
  return String(value || '').trim().slice(0, 80);
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => clean(item)).filter(Boolean) : [];
}

function asNest(value: unknown): Record<string, string[]> {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, kids]) => {
    const name = clean(key);
    if (name) out[name] = asList(kids).slice(0, 40);
  });
  return out;
}

function addAll(list: string[], more: string[]) {
  more.forEach((item) => {
    if (!list.includes(item)) list.push(item);
  });
  return list;
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false, error: 'Unavailable' });
    const sql = session.sql;
    const ownerId = session.userId;
    const query = new URL(req.url).searchParams;
    const sub = clean(query.get('sub'));
    const leaf = sub ? clean(query.get('leaf')) : '';
    const key = String(params.id || '').trim();
    let rows = ID.test(key)
      ? await sql`
          SELECT name, subs, nest FROM link_categories
          WHERE id = ${key} AND owner_id = ${ownerId}
          LIMIT 1
        `
      : await sql`
          SELECT name, subs, nest FROM link_categories
          WHERE owner_id = ${ownerId} AND name = ${clean(key)}
          LIMIT 1
        `;
    const fallback = clean(query.get('name')) || (ID.test(key) ? '' : clean(key));
    if (!rows[0] && fallback) {
      rows = await sql`
        SELECT name, subs, nest FROM link_categories
        WHERE owner_id = ${ownerId} AND name = ${fallback}
        LIMIT 1
      `;
    }
    const row = rows[0];
    const name = clean(row?.name) || fallback;
    if (!name || (!sub && name === UNCAT)) return NextResponse.json({ ok: false, error: 'Unavailable' });
    await sql`
      INSERT INTO link_categories (owner_id, name, subs)
      VALUES (${ownerId}, ${UNCAT}, '{}')
      ON CONFLICT (owner_id, name) DO NOTHING
    `;
    const nest = asNest(row?.nest);
    if (leaf) {
      nest[sub] = (nest[sub] || []).filter((item) => item !== leaf);
      await sql`
        UPDATE links SET category = ${UNCAT}, sub = '', leaf = ''
        WHERE owner_id = ${ownerId} AND category = ${name} AND sub = ${sub} AND leaf = ${leaf}
      `;
      if (row) {
        await sql`
          UPDATE link_categories SET nest = ${JSON.stringify(nest)}::jsonb
          WHERE owner_id = ${ownerId} AND name = ${name}
        `;
      }
    } else if (sub) {
      const kids = nest[sub] || [];
      delete nest[sub];
      const subs = addAll(asList(row?.subs).filter((item) => item !== sub), kids);
      await sql`
        UPDATE links SET sub = leaf, leaf = ''
        WHERE owner_id = ${ownerId} AND category = ${name} AND sub = ${sub} AND COALESCE(leaf, '') <> ''
      `;
      await sql`
        UPDATE links SET category = ${UNCAT}, sub = '', leaf = ''
        WHERE owner_id = ${ownerId} AND category = ${name} AND sub = ${sub}
      `;
      if (row) {
        await sql`
          UPDATE link_categories SET subs = ${subs}::text[], nest = ${JSON.stringify(nest)}::jsonb
          WHERE owner_id = ${ownerId} AND name = ${name}
        `;
      }
    } else {
      // Soft delete with an undo snapshot (POST /api/links {kind:'restore-category'} puts it back).
      const removed = await softDeleteCategory(sql, ownerId, name);
      if (!removed.ok) return NextResponse.json({ ok: false, error: removed.error }, { status: removed.status });
    }
    const fresh = await sql`
      SELECT id, name, subs, nest FROM link_categories
      WHERE owner_id = ${ownerId} AND COALESCE(to_jsonb(link_categories) ->> 'deleted_at', '') = ''
      ORDER BY name
    `;
    return NextResponse.json({
      ok: true,
      categories: fresh.map((item) => ({
        id: String(item.id || ''),
        name: String(item.name),
        subs: asList(item.subs),
        nest: asNest(item.nest),
      })),
    });
  } catch (err) {
    fail('links_category_delete', err);
    return NextResponse.json({ ok: false, error: 'Unavailable' });
  }
}
