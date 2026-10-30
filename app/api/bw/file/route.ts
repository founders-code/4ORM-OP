import { bwReadFile } from '@/lib/bw';
import { getSql } from '@/lib/db';
import { fail } from '@/lib/log';

export const dynamic = 'force-dynamic';

/** A document from one of Bruce's Spaces, opened from a link in his email. Signed per file; no session needed. */
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const sql = await getSql();
    const f = sql ? await bwReadFile(sql, String(u.searchParams.get('f') || ''), String(u.searchParams.get('s') || '')) : null;
    if (!f) return new Response('This document is no longer available.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const inline = /^(application\/pdf|image\/)/.test(f.mime);
    return new Response(new Uint8Array(f.buf), {
      headers: {
        'content-type': f.mime,
        'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${f.name.replace(/[^\w.\- ]+/g, '_')}"`,
        'cache-control': 'private, max-age=300',
        'x-robots-tag': 'noindex',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    fail('bw_file', err);
    return new Response('Could not open this document.', { status: 500 });
  }
}
