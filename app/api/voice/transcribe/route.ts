import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

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
    if (!key) return NextResponse.json({ transcript: '', error: 'Transcription unavailable' });
    const body = new FormData();
    body.append('file', file, 'voice.webm');
    body.append('model', 'gpt-4o-transcribe');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body,
      signal: AbortSignal.timeout(45000),
    });
    const json = await res.json().catch(() => null) as { text?: string } | null;
    return NextResponse.json({ transcript: String(json?.text || '') });
  } catch (err) {
    fail('voice_transcribe', err);
    return NextResponse.json({ transcript: '', error: 'Transcription unavailable' });
  }
}
