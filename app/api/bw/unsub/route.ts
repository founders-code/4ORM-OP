import { bwUnsubscribe } from '@/lib/bw';
import { getSql } from '@/lib/db';
import { fail } from '@/lib/log';

export const dynamic = 'force-dynamic';

/** Public unsubscribe link from Bruce's group email (CASL). Signed per contact; no session needed. */
function page(title: string, line: string) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#0d1526"><div style="max-width:520px;margin:12vh auto;background:#fff;border:1px solid #dfe4ee;border-radius:16px;padding:32px">
<img src="/assets/email/4orm-finance.png" width="140" alt="4orm Finance"><h1 style="font-size:26px;margin:22px 0 8px">${title}</h1><p style="font-size:17px;line-height:1.5;color:#3b4660">${line}</p></div></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function handle(req: Request) {
  try {
    const u = new URL(req.url);
    const c = String(u.searchParams.get('c') || '');
    const s = String(u.searchParams.get('s') || '');
    const sql = await getSql();
    if (!sql || !c) return page('Unsubscribe', 'This link is not complete. Reply to the email with "unsubscribe" and we will remove you.');
    const ok = await bwUnsubscribe(sql, c, s);
    return ok ? page('You are unsubscribed', 'You will not get group emails from Bruce Fair at 4orm Finance again.')
      : page('Unsubscribe', 'This link did not work. Reply to the email with "unsubscribe" and we will remove you.');
  } catch (err) {
    fail('bw_unsub', err);
    return page('Unsubscribe', 'Something went wrong. Reply to the email with "unsubscribe" and we will remove you.');
  }
}
export const GET = handle;
export const POST = handle;
