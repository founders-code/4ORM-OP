import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Email compose help (B37 tone chips, B38 "Tell me what to write" + Write). Returns a draft body only:
 * nothing is sent and Gmail is not touched. Owner-only, rate limited, and needs OPENAI_API_KEY.
 */
const TONES: Record<string, string> = {
  warm: 'Warm and friendly, still brief.',
  direct: 'Direct: lead with the ask, cut padding.',
  shorter: 'Shorter: keep every fact and the ask, cut the length by about half.',
  formal: 'More formal and polished, no slang.',
  /* Prompt 13 / design 27 — space email tones */
  voss: 'Chris Voss: tactical empathy. Name what they might be feeling, ask "how" and "what" questions, and make it easy to say no. Keep every fact and name.',
  ury: 'William Ury / Getting to Yes: start from shared interests, separate the person from the problem, offer options. Keep every fact and name.',
  cialdini: 'Robert Cialdini / Influence: give something first, lean on proof and authority, be specific about the small next step. Keep every fact and name.',
  plain: 'Plain: short and direct. No technique, just the point and the ask. Keep every fact and name.',
};

function clip(value: unknown, max: number) {
  return String(value ?? '').replace(/\r/g, '').trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Writing help is unavailable right now.' }, { status: 503 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const mode = String(body?.mode || '') === 'tone' ? 'tone' : 'write';
    const tone = String(body?.tone || '').toLowerCase();
    if (mode === 'tone' && !TONES[tone]) return NextResponse.json({ error: 'Pick a tone.' }, { status: 400 });
    const draft = clip(body?.text, 6000);
    const ask = clip(body?.ask, 600);
    if (mode === 'tone' && !draft) return NextResponse.json({ error: 'Write something first, then pick a tone.' }, { status: 400 });
    if (mode === 'write' && !ask) return NextResponse.json({ error: 'Tell me what to write.' }, { status: 400 });
    const key = process.env.OPENAI_API_KEY || '';
    if (!key) return NextResponse.json({ error: 'Writing help is not connected yet (no OpenAI key on the server).' }, { status: 503 });
    if (!(await takeRateLimit(session.sql, 'mail_write', ownerId, 20, 300))) {
      return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });
    }
    const toEmail = clip(body?.toEmail, 200).toLowerCase();
    const toName = clip(body?.toName, 120);
    const subject = clip(body?.subject, 300);
    let who = toName || toEmail;
    if (toEmail) {
      try {
        const rows = await session.sql`
          SELECT name, company, role, category FROM contacts
          WHERE owner_id = ${session.userId} AND deleted_at IS NULL AND lower(email) = ${toEmail}
          LIMIT 1
        `;
        const c = rows[0] as Record<string, unknown> | undefined;
        if (c) who = [c.name, c.role, c.company, c.category].map((x) => String(x || '').trim()).filter(Boolean).join(', ');
      } catch (err) {
        fail('mail_write_contact', err);
      }
    }
    const system = 'You write email bodies for Chad Johnston, founder of 4orm Finance (Canada). Plain text only, no subject line, no markdown, no em or en dashes (use hyphens), no exclamation marks, no invented facts, numbers or dates. Sign off as "Chad". Return only the email body.';
    const user = mode === 'tone'
      ? `Rewrite this email. Tone: ${TONES[tone]}\nRecipient: ${who || 'unknown'}\nSubject: ${subject || '(none)'}\n\nEmail:\n${draft}`
      : `Write the email. Instruction: ${ask}\nRecipient: ${who || 'unknown'}\nSubject: ${subject || '(none)'}${draft ? `\n\nCurrent draft to build on:\n${draft}` : ''}`;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 600,
          temperature: 0.4,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        fail('mail_write', `openai ${res.status}`);
        return NextResponse.json({ error: 'Writing help did not answer. Try again.' }, { status: 502 });
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = String(data.choices?.[0]?.message?.content || '').replace(/[–—]/g, '-').trim().slice(0, 6000);
      if (!text) return NextResponse.json({ error: 'Writing help came back empty. Try again.' }, { status: 502 });
      return NextResponse.json({ body: text });
    } catch (err) {
      fail('mail_write', err);
      return NextResponse.json({ error: 'Writing help did not answer. Try again.' }, { status: 504 });
    }
  } catch (err) {
    fail('mail_write', err);
    return NextResponse.json({ error: 'Writing help is unavailable right now.' }, { status: 500 });
  }
}
