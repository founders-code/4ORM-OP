import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

function cleanName(value: unknown) {
  return String(value || '').trim().slice(0, 80);
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
    const name = cleanName(key);
    if (!name) return;
    const list = Array.isArray(kids) ? kids.map((item) => cleanName(item)).filter(Boolean) : [];
    out[name] = list.slice(0, 40);
  });
  return out;
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const kind = String(body?.kind || '');
    const sql = session.sql;
    const ownerId = session.userId;
    if (kind === 'category') {
      const name = cleanName(body?.name) || 'New category';
      const inserted = await sql`
        INSERT INTO link_categories (owner_id, name, subs)
        VALUES (${ownerId}, ${name}, '{}')
        ON CONFLICT (owner_id, name) DO NOTHING
        RETURNING id
      `;
      const found = inserted[0]?.id
        ? inserted
        : await sql`SELECT id FROM link_categories WHERE owner_id = ${ownerId} AND name = ${name} LIMIT 1`;
      return NextResponse.json({ name, id: found[0]?.id || '' });
    }
    if (kind === 'delete-category') {
      const name = cleanName(body?.name);
      if (!name || name === 'Uncategorized') return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      await sql`
        UPDATE links
        SET category = 'Uncategorized', sub = '', leaf = ''
        WHERE owner_id = ${ownerId} AND category = ${name}
      `;
      await sql`
        INSERT INTO link_categories (owner_id, name, subs)
        VALUES (${ownerId}, 'Uncategorized', '{}')
        ON CONFLICT (owner_id, name) DO NOTHING
      `;
      await sql`
        DELETE FROM link_categories
        WHERE owner_id = ${ownerId} AND name = ${name} AND name <> 'Uncategorized'
      `;
      return NextResponse.json({ name, moved: 'Uncategorized' });
    }
    if (kind === 'subcategory') {
      const name = cleanName(body?.name);
      const sub = cleanName(body?.sub);
      if (!name || !sub) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      await sql`
        UPDATE link_categories
        SET subs = CASE WHEN ${sub} = ANY(subs) THEN subs ELSE array_append(subs, ${sub}) END
        WHERE owner_id = ${ownerId} AND name = ${name}
      `;
      return NextResponse.json({ name, sub });
    }
    if (kind === 'leaf' || kind === 'delete-sub' || kind === 'delete-leaf' || kind === 'rename') {
      const name = cleanName(body?.name);
      const sub = cleanName(body?.sub);
      const leaf = cleanName(body?.leaf);
      const next = cleanName(body?.next);
      if (!name) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      const rows = await sql`
        SELECT nest FROM link_categories WHERE owner_id = ${ownerId} AND name = ${name} LIMIT 1
      `;
      const nest = asNest(rows[0]?.nest);
      if (kind === 'leaf') {
        if (!sub || !leaf) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
        const kids = nest[sub] || [];
        if (!kids.includes(leaf)) kids.push(leaf);
        nest[sub] = kids.slice(0, 40);
      } else if (kind === 'delete-sub') {
        if (!sub) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
        delete nest[sub];
        await sql`
          UPDATE links SET category = 'Uncategorized', sub = '', leaf = ''
          WHERE owner_id = ${ownerId} AND category = ${name} AND sub = ${sub}
        `;
        await sql`
          INSERT INTO link_categories (owner_id, name, subs)
          VALUES (${ownerId}, 'Uncategorized', '{}')
          ON CONFLICT (owner_id, name) DO NOTHING
        `;
      } else if (kind === 'delete-leaf') {
        if (!sub || !leaf) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
        nest[sub] = (nest[sub] || []).filter((item) => item !== leaf);
        await sql`
          UPDATE links SET category = 'Uncategorized', sub = '', leaf = ''
          WHERE owner_id = ${ownerId} AND category = ${name} AND sub = ${sub} AND leaf = ${leaf}
        `;
        await sql`
          INSERT INTO link_categories (owner_id, name, subs)
          VALUES (${ownerId}, 'Uncategorized', '{}')
          ON CONFLICT (owner_id, name) DO NOTHING
        `;
      } else if (!sub) {
        if (!next || next === name) return NextResponse.json({ name });
        await sql`UPDATE link_categories SET name = ${next} WHERE owner_id = ${ownerId} AND name = ${name}`;
        await sql`UPDATE links SET category = ${next} WHERE owner_id = ${ownerId} AND category = ${name}`;
        return NextResponse.json({ name: next });
      } else if (!leaf) {
        if (!next || next === sub) return NextResponse.json({ name, sub });
        if (nest[sub]) {
          nest[next] = nest[sub];
          delete nest[sub];
        }
        await sql`UPDATE links SET sub = ${next} WHERE owner_id = ${ownerId} AND category = ${name} AND sub = ${sub}`;
      } else {
        if (!next || next === leaf) return NextResponse.json({ name, sub, leaf });
        nest[sub] = (nest[sub] || []).map((item) => (item === leaf ? next : item));
        await sql`
          UPDATE links SET leaf = ${next}
          WHERE owner_id = ${ownerId} AND category = ${name} AND sub = ${sub} AND leaf = ${leaf}
        `;
      }
      if (kind === 'delete-sub') {
        await sql`
          UPDATE link_categories
          SET subs = array_remove(subs, ${sub}), nest = ${JSON.stringify(nest)}::jsonb
          WHERE owner_id = ${ownerId} AND name = ${name}
        `;
      } else if (kind === 'rename' && sub && !leaf) {
        await sql`
          UPDATE link_categories
          SET subs = array_replace(subs, ${sub}, ${next}), nest = ${JSON.stringify(nest)}::jsonb
          WHERE owner_id = ${ownerId} AND name = ${name}
        `;
      } else {
        await sql`
          UPDATE link_categories
          SET nest = ${JSON.stringify(nest)}::jsonb
          WHERE owner_id = ${ownerId} AND name = ${name}
        `;
      }
      return NextResponse.json({ name, sub, leaf, next });
    }
    const title = cleanName(body?.title) || 'Untitled link';
    const category = cleanName(body?.category);
    const sub = cleanName(body?.sub);
    const leaf = cleanName(body?.leaf);
    let url = String(body?.url || '').trim().slice(0, 500);
    if (!url) url = 'https://4ormop.com';
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const inserted = await sql`
      INSERT INTO links (owner_id, title, url, category, sub, leaf)
      VALUES (${ownerId}, ${title}, ${parsed.toString()}, ${category}, ${sub}, ${leaf})
      RETURNING id
    `;
    return NextResponse.json({ id: inserted[0]?.id || '', title, url: parsed.toString(), cat: category, sub, leaf });
  } catch (err) {
    fail('links_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
