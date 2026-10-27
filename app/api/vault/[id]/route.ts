import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { VAULT_COOKIE, vaultUnlocked } from '@/lib/finance';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function gate() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!vaultUnlocked(cookies().get(VAULT_COOKIE)?.value, session.userId)) {
    return { error: NextResponse.json({ locked: true }, { status: 403 }) };
  }
  return { session, ownerId };
}

function bodyOf(doc: Record<string, unknown>) {
  const jsonPath = String(doc.json_path || '');
  const drive = String(doc.drive_id || '');
  const src = String(doc.source_url || '');
  const note = String(doc.note || '');
  if (jsonPath) return { kind: 'json', path: jsonPath };
  if (drive) return { kind: 'drive', url: 'https://drive.google.com/file/d/' + encodeURIComponent(drive) + '/preview', drive };
  if (/\.pdf($|\?)/i.test(src) || /pdf/i.test(src)) return { kind: 'pdf', url: src };
  if (/\.md($|\?)/i.test(src)) return { kind: 'md', url: src };
  if (note) return { kind: 'md', text: note };
  return { kind: 'text', text: String(doc.name || '') };
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    if (!g.session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const key = decodeURIComponent(ctx.params.id || '');
    const rows = await g.session.sql`
      SELECT id, org, kind, doc_id, name, version, status, verified_at, owner, note, source_url, drive_id, json_path
      FROM vault_docs
      WHERE owner_id = ${g.ownerId} AND (id::text = ${key} OR doc_id = ${key})
      LIMIT 1
    `;
    const doc = rows[0] as Record<string, unknown> | undefined;
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const versions = await g.session.sql`
      SELECT id, version, file, uploaded_at, by_user, superseded_at
      FROM vault_versions WHERE doc_id = ${doc.id} ORDER BY uploaded_at DESC
    `.catch(() => []);
    const depends = await g.session.sql`
      SELECT d.doc_id, d.name FROM vault_links l
      JOIN vault_docs d ON d.id = l.depends_on
      WHERE l.doc_id = ${doc.id}
    `.catch(() => []);
    return NextResponse.json({
      doc,
      versions: versions || [],
      depends: depends || [],
      body: bodyOf(doc),
    });
  } catch (err) {
    fail('vault_doc_get', err);
    return NextResponse.json({ error: 'vault unavailable' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    if (!g.session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    const key = decodeURIComponent(ctx.params.id || '');
    const rows = await g.session.sql`
      SELECT id, version FROM vault_docs
      WHERE owner_id = ${g.ownerId} AND (id::text = ${key} OR doc_id = ${key})
      LIMIT 1
    `;
    const doc = rows[0] as { id?: string; version?: string } | undefined;
    if (!doc?.id) return NextResponse.json({ saved: false }, { status: 404 });
    const form = await req.formData().catch(() => null);
    const file = form && form.get('file');
    const label = form ? String(form.get('version') || '') : '';
    const nextVer = label || ('v' + new Date().toISOString().slice(0, 10));
    const fileName = file && typeof file === 'object' && 'name' in file ? String((file as File).name) : 'upload';
    await g.session.sql`
      INSERT INTO vault_versions (doc_id, version, file, by_user, superseded_at)
      VALUES (${doc.id}, ${doc.version || 'prior'}, ${fileName}, ${g.session.userId}, now())
    `;
    await g.session.sql`
      UPDATE vault_docs SET version = ${nextVer}, status = 'Current' WHERE id = ${doc.id} AND owner_id = ${g.ownerId}
    `;
    const versions = await g.session.sql`
      SELECT id, version, file, uploaded_at, by_user, superseded_at
      FROM vault_versions WHERE doc_id = ${doc.id} ORDER BY uploaded_at DESC
    `;
    return NextResponse.json({ saved: true, version: nextVer, versions });
  } catch (err) {
    fail('vault_version_post', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
