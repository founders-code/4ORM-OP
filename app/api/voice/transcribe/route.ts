import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { outbound } from '@/lib/outbound';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const key = process.env.OPENAI_API_KEY || '';
    const form = await req.formData().catch(() => null);
    const file = form?.get('audio') || form?.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ transcript: '', error: 'No audio' }, { status: 400 });
    }
    if (!key) return NextResponse.json({ transcript: '', error: 'Transcription unavailable' }, { status: 503 });
    const body = new FormData();
    body.append('file', file, 'voice.webm');
    body.append('model', 'gpt-4o-transcribe');
    const res = await outbound('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body,
      signal: AbortSignal.timeout(45000),
    });
    const json = await res.json().catch(() => null) as { text?: string; error?: { message?: string; code?: string } } | null;
    if (!res.ok) {
      /* Say why instead of handing back an empty transcript: no credit, a bad key and a bad file each read differently. */
      const why = json?.error?.code === 'insufficient_quota' ? 'OpenAI has no credit on this account' : res.status === 401 ? 'The OpenAI key was not accepted' : String(json?.error?.message || 'OpenAI did not take the audio').slice(0, 200);
      fail('voice_transcribe_openai', new Error(`${res.status} ${why}`));
      return NextResponse.json({ transcript: '', error: why }, { status: 502 });
    }
    return NextResponse.json({ transcript: String(json?.text || '') });
  } catch (err) {
    fail('voice_transcribe', err);
    return NextResponse.json({ transcript: '', error: 'Transcription unavailable' }, { status: 500 });
  }
}
