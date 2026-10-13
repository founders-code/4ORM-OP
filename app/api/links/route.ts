import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

function cleanName(value: unknown) {
  return String(value || '').trim().slice(0, 80);
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const kind = String(body?.kind || '');
    if (kind === 'category') {
      const name = cleanName(body?.name);
      if (!name) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      await session.sql`
        INSERT INTO link_categories (owner_id, name, subs)
        VALUES (${session.userId}, ${name}, '{}')
        ON CONFLICT (owner_id, name) DO NOTHING
      `;
      return NextResponse.json({ name });
    }
    if (kind === 'delete-category') {
      const name = cleanName(body?.name);
      if (!name) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      await session.sql`
        UPDATE links
        SET category = 'Uncategorized', sub = ''
        WHERE owner_id = ${session.userId} AND category = ${name}
      `;
      await session.sql`
        INSERT INTO link_categories (owner_id, name, subs)
        VALUES (${session.userId}, 'Uncategorized', '{}')
        ON CONFLICT (owner_id, name) DO NOTHING
      `;
      await session.sql`
        DELETE FROM link_categories
        WHERE owner_id = ${session.userId} AND name = ${name} AND name <> 'Uncategorized'
      `;
      return NextResponse.json({ name, moved: 'Uncategorized' });
    }
    if (kind === 'subcategory') {
      const name = cleanName(body?.name);
      const sub = cleanName(body?.sub);
      if (!name || !sub) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      await session.sql`
        UPDATE link_categories
        SET subs = CASE WHEN ${sub} = ANY(subs) THEN subs ELSE array_append(subs, ${sub}) END
        WHERE owner_id = ${session.userId} AND name = ${name}
      `;
      return NextResponse.json({ name, sub });
    }
    const title = cleanName(body?.title);
    const category = cleanName(body?.category);
    const sub = cleanName(body?.sub);
    let url = String(body?.url || '').trim().slice(0, 500);
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
    if (!title) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    await session.sql`
      INSERT INTO links (owner_id, title, url, category, sub)
      VALUES (${session.userId}, ${title}, ${parsed.toString()}, ${category}, ${sub})
    `;
    return NextResponse.json({ title, url: parsed.toString(), cat: category, sub });
  } catch {
    fail('links_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
