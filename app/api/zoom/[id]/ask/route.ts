import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { ensureZoomExtra } from '@/lib/zoom-notes';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

function sentences(text: string) {
  return String(text || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ answer: '' }, { status: session.sql ? 400 : 503 });
    await ensureZoomExtra(session.sql);
    const body = await req.json().catch(() => null) as { q?: string } | null;
    const q = String(body?.q || '').trim().slice(0, 240);
    if (!q) return NextResponse.json({ answer: '' });
    const rows = await session.sql`
      SELECT title, others, improve, intel, ai_summary, transcript, raw_notes
      FROM zoom_notes WHERE id = ${params.id} AND owner_id = ${session.userId} AND deleted_at IS NULL LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ answer: 'That meeting is not on the desk.' });
    const blob = [
      row.title,
      row.ai_summary,
      row.raw_notes,
      row.transcript,
      JSON.stringify(row.others || []),
      JSON.stringify(row.improve || []),
      JSON.stringify(row.intel || []),
    ].join('\n');
    const key = process.env.OPENAI_API_KEY || '';
    if (key) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 280,
            messages: [
              { role: 'system', content: 'Answer only from this meeting transcript and notes. If it is not in the record, say so. Hyphens, not dashes. Short.' },
              { role: 'user', content: `Question: ${q}\n\nRecord:\n${blob.slice(0, 8000)}` },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
          const answer = data.choices?.[0]?.message?.content || '';
          if (answer) return NextResponse.json({ answer });
        }
      } catch (err) {
        fail('zoom_ask', err);
      }
    }
    const terms = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const hit = sentences(blob).filter((s) => terms.some((t) => s.toLowerCase().includes(t))).slice(0, 3).join(' ');
    return NextResponse.json({ answer: hit || 'Nothing in this meeting\'s notes matches that. Open the transcript to check.' });
  } catch (err) {
    fail('zoom_ask', err);
    return NextResponse.json({ answer: '' }, { status: 500 });
  }
}
