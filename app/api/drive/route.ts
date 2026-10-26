import { NextResponse } from 'next/server';
import { claimBudget } from '@/lib/db';
import { withCreds } from '@/lib/creds';
import { driveWrite } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

type Node = {
  id?: string;
  name?: string;
  children?: Node[];
  folders?: Node[];
  files?: Array<{ id: string; name: string; url: string; kind: string }>;
  url?: string;
};

function depthOf(nodes: Node[] | undefined, id: string, depth: number): number | null {
  for (const node of nodes || []) {
    if (node.id === id) return depth;
    const nested = depthOf([...(node.folders || []), ...(node.children || [])], id, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function findNode(nodes: Node[] | undefined, id: string): Node | null {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const nested = findNode(node.folders, id) || findNode(node.children, id);
    if (nested) return nested;
  }
  return null;
}

function removeNode(nodes: Node[] | undefined, id: string): Node | null {
  if (!nodes) return null;
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) return nodes.splice(index, 1)[0] || null;
  for (const node of nodes) {
    const nested = removeNode(node.folders, id) || removeNode(node.children, id);
    if (nested) return nested;
  }
  return null;
}

function place(parent: Node, child: Node) {
  if (parent.folders) parent.folders.push(child);
  else {
    parent.children = parent.children || [];
    parent.children.push(child);
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false, error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const action = String(body?.action || '');
    if (action !== 'mkdir' && action !== 'mkfile' && action !== 'rename' && action !== 'move') {
      return NextResponse.json({ ok: false, error: 'Unavailable' }, { status: 400 });
    }
    const cached = await session.sql`SELECT tree FROM drive_cache WHERE owner_id = ${session.userId}`;
    let raw: unknown = cached[0]?.tree;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    const tree = (Array.isArray(raw) ? raw : []) as Node[];
    const parentId = String(body?.parentId || '');
    const id = String(body?.id || '');
    const name = String(body?.name || '').trim().slice(0, 180);
    if (action === 'mkdir' || action === 'mkfile') {
      const parentDepth = depthOf(tree, parentId, 1);
      if (!/^[\w-]{8,}$/.test(parentId) || (action === 'mkdir' && parentDepth && parentDepth >= 5)) {
        return NextResponse.json({ ok: false, error: 'Unavailable' }, { status: 400 });
      }
    }
    const weight = action === 'move' ? 2 : 1;
    if (!(await claimBudget(session.sql, session.userId, 'google_drive', weight))) {
      return NextResponse.json({ ok: false, error: 'Unavailable' }, { status: 429 });
    }
    const creds = await loadCredsFor(session.userId);
    const written = (await withCreds(creds, () => driveWrite(action, { name, parentId, id }))) as { id?: string; name?: string; webViewLink?: string } | null;
    if (!written) return NextResponse.json({ ok: false, error: 'Unavailable' }, { status: 502 });
    if (action === 'rename') {
      const node = findNode(tree, id);
      if (node) node.name = name;
    } else if ((action === 'mkdir' || action === 'mkfile') && written.id) {
      const parent = findNode(tree, parentId);
      if (parent && action === 'mkdir') {
        place(parent, { id: written.id, name: written.name || name, url: written.webViewLink || '', children: [], files: [] });
      } else if (parent) {
        parent.files = parent.files || [];
        parent.files.push({ id: written.id, name: written.name || name, url: written.webViewLink || '', kind: 'doc' });
      }
    } else if (action === 'move') {
      const moved = removeNode(tree, id);
      const dest = findNode(tree, parentId);
      if (moved && dest) place(dest, moved);
    }
    await session.sql`
      UPDATE drive_cache SET tree = ${JSON.stringify(tree)}::jsonb, fetched_at = now()
      WHERE owner_id = ${session.userId}
    `;
    return NextResponse.json({ ok: true, id: written.id || id, name: written.name || name, url: written.webViewLink || '' });
  } catch {
    fail('drive_failed');
    return NextResponse.json({ ok: false, error: 'Unavailable' }, { status: 500 });
  }
}
