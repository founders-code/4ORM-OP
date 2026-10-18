import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ROOT = path.join(process.cwd(), 'design-reference');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

export async function GET(_req: Request, ctx: { params: { path: string[] } }) {
  const session = await openBoard();
  if (!session) return NextResponse.redirect(new URL('/', _req.url));
  const parts = (ctx.params.path || []).map((p) => String(p || ''));
  if (!parts.length || parts.some((p) => p === '..' || p.includes('/') || p.includes('\\'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  let rel = parts.join('/');
  if (!path.extname(rel) && !rel.startsWith('assets/')) rel = `${rel}.html`;
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(path.resolve(ROOT))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const buf = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    return new NextResponse(new Uint8Array(buf), { headers: { 'content-type': TYPES[ext] || 'application/octet-stream' } });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
