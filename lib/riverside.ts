import type { NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env.mjs';
import { markSource, saveRecordNote, vanDay } from './integrations-records';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

/**
 * Riverside Business API v3 (docs.riverside.fm): Bearer key, base https://platform.riverside.fm/api/v3.
 * The key is issued by Riverside customer success to select Business accounts only.
 * GET /recordings (newest first, 20 per page, start_date filter), and
 * GET /download/transcription/{recordingId}?type=txt once transcription.status is 'done'.
 * Rate limit: one request per second per unique request.
 */
const LOOKBACK_DAYS = 30;
const MAX_TRANSCRIPTS_PER_RUN = 8;

function base() {
  return (env('RIVERSIDE_API_BASE') || 'https://platform.riverside.fm').replace(/\/+$/, '');
}

export function riversideConfigured() {
  return !!env('RIVERSIDE_API_KEY');
}

class RiversideError extends Error {
  status: number;
  constructor(status: number) {
    super(`riverside ${status}`);
    this.status = status;
  }
}

async function call(path: string, asText = false) {
  const res = await fetch(`${base()}/api/v3${path}`, {
    headers: { authorization: `Bearer ${env('RIVERSIDE_API_KEY')}`, accept: asText ? 'text/plain' : 'application/json' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!res.ok) throw new RiversideError(res.status);
  return asText ? res.text() : res.json();
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Recording = {
  recording_id?: string;
  id?: string;
  name?: string;
  project_name?: string;
  studio_name?: string;
  status?: string;
  created_date?: string;
  tracks?: Array<{ type?: string; files?: Array<{ type?: string; download_url?: string }> }>;
  transcription?: { status?: string; files?: Array<{ type?: string; download_url?: string }> } | null;
};

/** Pull recent Riverside recordings into Zoom notes (origin 'riverside'). Writes sync_state 'riverside'. */
export async function syncRiverside(sql: Sql, ownerId: string) {
  if (!riversideConfigured()) {
    await markSource(sql, ownerId, 'riverside', 'not_connected', 'RIVERSIDE_API_KEY not set');
    return { ok: false as const, status: 'not_connected', added: 0, filled: 0, seen: 0 };
  }
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  let added = 0;
  let filled = 0;
  let seen = 0;
  let transcripts = 0;
  try {
    const have = new Map(
      ((await sql`SELECT note_id, COALESCE(transcript, '') <> '' AS has_tx FROM zoom_notes WHERE owner_id = ${ownerId} AND note_id LIKE 'riverside-%'`) as Array<{ note_id: string; has_tx: boolean }>)
        .map((r) => [r.note_id, r.has_tx]),
    );
    for (let page = 0; page < 3; page += 1) {
      if (page) await pause(1100);
      const json = (await call(`/recordings?start_date=${since}&page=${page}`)) as { data?: Recording[]; next_page_url?: string | null };
      for (const rec of json.data || []) {
        const rid = String(rec.recording_id || rec.id || '');
        if (!rid || !/^[\w-]{1,80}$/.test(rid)) continue;
        seen += 1;
        const noteId = `riverside-${rid}`;
        const hasTx = have.get(noteId);
        if (hasTx === true) continue;
        let transcript = '';
        if (rec.transcription?.status === 'done' && transcripts < MAX_TRANSCRIPTS_PER_RUN) {
          transcripts += 1;
          await pause(1100);
          try {
            transcript = String(await call(`/download/transcription/${encodeURIComponent(rid)}?type=txt`, true)).slice(0, 200000);
          } catch (err) {
            if (!(err instanceof RiversideError && err.status === 404)) throw err;
          }
        }
        if (hasTx === false && !transcript) continue;
        const where = [rec.studio_name, rec.project_name].filter(Boolean).join(' / ');
        const result = await saveRecordNote(sql, ownerId, {
          noteId,
          origin: 'riverside',
          date: vanDay(String(rec.created_date || '')),
          title: String(rec.name || 'Riverside recording'),
          attendees: [],
          summary: where ? `Riverside recording in ${where}.` : 'Riverside recording.',
          rawNotes: '',
          transcript,
          recordingUrl: '',
          durationMin: null,
          sources: [{ name: 'Riverside', url: 'https://riverside.fm/dashboard' }],
        });
        if (result === 'added') added += 1;
        if (result === 'filled') filled += 1;
      }
      if (!json.next_page_url) break;
    }
    await markSource(sql, ownerId, 'riverside', seen ? 'connected' : 'reached_empty', `${seen} recordings in the last ${LOOKBACK_DAYS} days`);
    return { ok: true as const, status: 'connected', added, filled, seen };
  } catch (err) {
    const status = err instanceof RiversideError ? err.status : 0;
    fail('riverside_sync', err);
    const detail = status === 401 ? 'Riverside refused the key (401). Check RIVERSIDE_API_KEY.' : status === 429 ? 'Riverside rate limit; try again in a minute.' : 'Riverside did not answer.';
    await markSource(sql, ownerId, 'riverside', 'unavailable', detail);
    return { ok: false as const, status: status === 401 ? 'bad_key' : 'unavailable', added, filled, seen, error: detail };
  }
}
