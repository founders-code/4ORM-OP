import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';
import { readSpace, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

function plain(text: string) {
  return text.replace(/[–—]/g, '-').replace(/^["'\s]+|["'\s]+$/g, '').trim();
}

/**
 * POST /api/spaces/:id/angle - 4orm Intelligence rewrites the Space's angle and suggests three opening hooks.
 * Reads only what is on the Space (name, notes, angle, people, file names). Nothing is saved here: the client
 * shows the rewrite and saves it through PATCH /api/spaces/:id {angle}, with Undo.
 * 503 when no OpenAI key is set, 429 when called more than 20 times in 10 minutes.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!spaceIdOk(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const key = process.env.OPENAI_API_KEY || '';
    if (!key) return NextResponse.json({ error: '4orm Intelligence is not connected (no OpenAI key set).' }, { status: 503 });
    const allowed = await takeRateLimit(session.sql, 'space_angle', session.userId, 20, 600).catch(() => true);
    if (!allowed) return NextResponse.json({ error: 'Too many rewrites. Try again in a few minutes.' }, { status: 429 });
    const view = await readSpace(session.sql, session.userId, params.id);
    if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const people = (view.recipients || []).map((p) => [p.name, p.role, p.company].filter(Boolean).join(', ')).filter(Boolean);
    const files = (view.docs || []).map((d) => d.name).filter(Boolean).slice(0, 12);
    const record = [
      `Space: ${view.name}`,
      view.angle ? `Current angle: ${view.angle}` : 'Current angle: (none yet)',
      view.description ? `Notes: ${view.description}` : '',
      people.length ? `People: ${people.join('; ')}` : '',
      files.length ? `Files in the bundle: ${files.join('; ')}` : '',
    ].filter(Boolean).join('\n').slice(0, 6000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 320,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You write for Chad Johnston, founder of 4orm Finance. Using only the record given, rewrite the angle for this send in two or three plain sentences: why this person, why now, what 4orm offers them. Then give three short opening hooks (one sentence each) for the intro email. No invented facts or numbers. Hyphens, not dashes. Reply as JSON: {"angle": string, "hooks": [string, string, string]}.',
          },
          { role: 'user', content: record },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      fail('space_angle', `openai ${res.status}`);
      return NextResponse.json({ error: '4orm Intelligence did not answer. Try again.' }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let parsed: { angle?: unknown; hooks?: unknown } = {};
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch {
      parsed = {};
    }
    const angle = plain(String(parsed.angle || '')).slice(0, 4000);
    const hooks = (Array.isArray(parsed.hooks) ? parsed.hooks : []).map((h) => plain(String(h || '')).slice(0, 240)).filter(Boolean).slice(0, 3);
    if (!angle) return NextResponse.json({ error: '4orm Intelligence did not answer. Try again.' }, { status: 502 });
    return NextResponse.json({ angle, hooks });
  } catch (err) {
    fail('space_angle', err);
    return NextResponse.json({ error: 'Could not rewrite the angle.' }, { status: 500 });
  }
}
