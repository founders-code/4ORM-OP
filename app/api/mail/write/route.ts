import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';
import { outbound } from '@/lib/outbound';

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
    const rawMode = String(body?.mode || '');
    const thread = clip(body?.thread, 12000);
    const askIn = clip(body?.ask, 600);
    /* Draft with no instruction on an open email: read the email and write the reply. */
    const mode = rawMode === 'tone' ? 'tone' : (!askIn && thread) ? 'reply' : 'write';
    const tone = String(body?.tone || '').toLowerCase();
    if (mode === 'tone' && !TONES[tone]) return NextResponse.json({ error: 'Pick a tone.' }, { status: 400 });
    const draft = clip(body?.text, 6000);
    const ask = clip(body?.ask, 600);
    if (mode === 'tone' && !draft) return NextResponse.json({ error: 'Write something first, then pick a tone.' }, { status: 400 });
    if (mode === 'write' && !ask && !draft) return NextResponse.json({ error: 'Open an email or write a line, then press Draft it.' }, { status: 400 });
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    const key = process.env.OPENAI_API_KEY || '';
    if (!key && !anthropicKey) return NextResponse.json({ error: 'Writing help is not connected yet (no model key on the server).' }, { status: 503 });
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
      : mode === 'reply'
        ? `Write Chad's reply to the email below. Answer what they asked, keep it short (under 120 words), propose one clear next step, and do not promise anything the email does not support. If a fact you would need is missing, leave a [bracketed] placeholder instead of inventing it.\nRecipient: ${who || 'unknown'}\nSubject: ${subject || '(none)'}\n\nTheir email:\n${thread}${draft ? `\n\nChad has started this reply, build on it:\n${draft}` : ''}`
        : `Write the email. Instruction: ${ask || 'Finish this draft.'}\nRecipient: ${who || 'unknown'}\nSubject: ${subject || '(none)'}${draft ? `\n\nCurrent draft to build on:\n${draft}` : ''}${thread ? `\n\nThe email being answered:\n${thread}` : ''}`;
    try {
      let text = '';
      if (anthropicKey) {
        const res = await outbound('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: process.env.MAIL_MODEL || 'claude-sonnet-4-5', max_tokens: 700, system, messages: [{ role: 'user', content: user }] }),
          signal: AbortSignal.timeout(25000),
        });
        if (res.ok) {
          const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
          text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('\n');
        } else fail('mail_write', `anthropic ${res.status}`);
      }
      if (!text && key) {
        const res = await outbound('https://api.openai.com/v1/chat/completions', {
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
        text = String(data.choices?.[0]?.message?.content || '');
      }
      text = text.replace(/[–—]/g, '-').trim().slice(0, 6000);
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
