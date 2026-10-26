import { NextResponse } from 'next/server';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { organizeText } from '@/lib/organize.mjs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function inbox(sql: NeonQueryFunction<false, false>, userId: string) {
  const found = await sql`
    SELECT id FROM note_cats
    WHERE owner_id = ${userId} AND parent_id IS NULL AND name = 'Inbox'
    LIMIT 1
  `;
  if (found[0]?.id) return String(found[0].id);
  const made = await sql`
    INSERT INTO note_cats (owner_id, name, parent_id, depth)
    VALUES (${userId}, 'Inbox', NULL, 0)
    RETURNING id
  `;
  return String(made[0].id);
}

function tidyKey(title: string, body: string) {
  return `${title}\n${body}`.toLowerCase().replace(/^\[archived\]\s*/, '').replace(/\s+/g, ' ').trim();
}

function inferKind(text: string) {
  if (/(^|\n)\s*(-\s*)?\[[ x]\]|\bto[- ]?do\b/i.test(text)) return 'todo';
  if (/\bdecided\b|\bdecision\b/i.test(text)) return 'decision';
  if (/\bidea\b/i.test(text)) return 'idea';
  return '';
}

/**
 * N3 Tidy up: archives empty notes and exact duplicates (the oldest copy stays), and tags untyped sticky notes
 * as To-do / Decision / Idea from their text. Everything is reversible: sticky notes get meta.archived, board
 * notes get the existing "[archived] " title prefix. Returns every change so the client can offer Undo.
 */
async function tidyNotes(sql: NeonQueryFunction<false, false>, userId: string) {
  const sticky = await sql`
    SELECT id, body, meta FROM sticky_notes
    WHERE owner_id = ${userId} AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1000
  ` as Array<{ id: string; body?: string; meta?: Record<string, unknown> | null }>;
  const board = await sql`
    SELECT id, title, body FROM notes
    WHERE owner_id = ${userId} AND deleted_at IS NULL AND title NOT LIKE '[archived]%'
    ORDER BY created_at ASC
    LIMIT 1000
  ` as Array<{ id: string; title?: string; body?: string }>;
  const seen = new Set<string>();
  const archived: Array<{ id: string; store: 'sticky' | 'board'; title: string; why: 'empty' | 'duplicate' }> = [];
  const typed: Array<{ id: string; kind: string }> = [];
  for (const row of sticky) {
    const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
    if (meta.archived) continue;
    const title = String(meta.title || '');
    const text = String(row.body || '');
    const key = tidyKey(title, text);
    const checks = Array.isArray(meta.checks) ? meta.checks.length : 0;
    if (!key && !checks) { archived.push({ id: String(row.id), store: 'sticky', title, why: 'empty' }); continue; }
    if (key && seen.has(key)) { archived.push({ id: String(row.id), store: 'sticky', title, why: 'duplicate' }); continue; }
    if (key) seen.add(key);
    if (!meta.kind) {
      const kind = inferKind(`${title}\n${text}`);
      if (kind) typed.push({ id: String(row.id), kind });
    }
  }
  for (const row of board) {
    const title = String(row.title || '');
    const key = tidyKey(title, String(row.body || ''));
    if (!key) { archived.push({ id: String(row.id), store: 'board', title, why: 'empty' }); continue; }
    if (seen.has(key)) { archived.push({ id: String(row.id), store: 'board', title, why: 'duplicate' }); continue; }
    seen.add(key);
  }
  const cap = 200;
  for (const hit of archived.slice(0, cap)) {
    if (hit.store === 'sticky') {
      await sql`
        UPDATE sticky_notes SET meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify({ archived: true })}::jsonb
        WHERE id = ${hit.id} AND owner_id = ${userId} AND deleted_at IS NULL
      `;
    } else {
      await sql`
        UPDATE notes SET title = ${`[archived] ${hit.title}`.slice(0, 180)}, updated_at = now()
        WHERE id = ${hit.id} AND owner_id = ${userId} AND deleted_at IS NULL
      `;
    }
  }
  for (const hit of typed.slice(0, cap)) {
    await sql`
      UPDATE sticky_notes SET meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify({ kind: hit.kind })}::jsonb
      WHERE id = ${hit.id} AND owner_id = ${userId} AND deleted_at IS NULL
    `;
  }
  return { ok: true, archived: archived.slice(0, cap), typed: typed.slice(0, cap) };
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    if (body?.action === 'tidy') return NextResponse.json(await tidyNotes(session.sql, session.userId));
    const organized = organizeText(String(body?.text || ''));
    if (!organized) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const catId = await inbox(session.sql, session.userId);
    const made = await session.sql`
      INSERT INTO notes (owner_id, cat_id, title, body, color)
      VALUES (${session.userId}, ${catId}, ${organized.title}, ${organized.body}, 'yellow')
      RETURNING id, cat_id, title, body, color, updated_at
    `;
    const row = made[0];
    return NextResponse.json({
      id: String(row.id),
      catId: row.cat_id ? String(row.cat_id) : null,
      title: String(row.title || ''),
      body: String(row.body || ''),
      color: String(row.color || 'yellow'),
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).getTime() : null,
    });
  } catch {
    fail('notes_organize_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
