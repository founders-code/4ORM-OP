import { getSql } from '@/lib/db';
import { fail } from '@/lib/log';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME = /^image\/(jpeg|png|webp|gif|avif)$/;

/** Same-origin stored link previews (Neon bytea / Blob mirror). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const missing = () => new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
  try {
    const id = String(params.id || '');
    if (!ID.test(id)) return missing();
    const sql = await getSql();
    if (!sql) return missing();
    const rows = await sql`SELECT mime, encode(data, 'base64') AS b64 FROM link_images WHERE id = ${id} LIMIT 1`;
    const mime = String(rows[0]?.mime || '');
    if (!rows[0] || !MIME.test(mime)) return missing();
    const bytes = Buffer.from(String(rows[0].b64 || ''), 'base64');
    return new Response(bytes, {
      headers: {
        'content-type': mime,
        'content-length': String(bytes.length),
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    fail('link_image_read', err);
    return missing();
  }
}
