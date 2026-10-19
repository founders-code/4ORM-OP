import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null) as { transcript?: string; rhythms?: Array<{ name?: string; color?: string }> } | null;
    const transcript = String(body?.transcript || '').trim();
    const rhythms = Array.isArray(body?.rhythms) ? body!.rhythms : [];
    if (!transcript) return NextResponse.json({ items: [] });
    const key = process.env.OPENAI_API_KEY || '';
    if (!key) {
      return NextResponse.json({ items: heuristic(transcript, rhythms) });
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: 'Return JSON {items:[{c,t,k,cls,r?,v?}]} for a voice log. cls g=play, b=task, a=note. Match rhythm names from the list. No markdown.' },
          { role: 'user', content: JSON.stringify({ transcript, rhythms: rhythms.map((r) => r.name) }) },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
    const raw = String(json?.choices?.[0]?.message?.content || '');
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as { items?: unknown[] };
    return NextResponse.json({ items: Array.isArray(parsed.items) ? parsed.items : heuristic(transcript, rhythms) });
  } catch (err) {
    fail('voice_parse', err);
    return NextResponse.json({ items: [] });
  }
}

function heuristic(transcript: string, rhythms: Array<{ name?: string; color?: string }>) {
  const low = transcript.toLowerCase();
  const items: Array<Record<string, unknown>> = [];
  rhythms.forEach((r, i) => {
    const name = String(r.name || '');
    if (!name) return;
    if (new RegExp(name.split(' ')[0], 'i').test(low) || (/clip/.test(name) && /clip|posted/.test(low)) || (/reach/.test(name) && /reach/.test(low))) {
      items.push({ c: `var(${r.color || '--blue'})`, t: name, k: 'play done', cls: 'g', r: i });
    }
  });
  if (/owe|send|deck/.test(low)) items.push({ c: 'var(--blue)', t: transcript.slice(0, 80), k: '+ Execution', cls: 'b' });
  return items.slice(0, 6);
}
