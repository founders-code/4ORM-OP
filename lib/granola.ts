import type { NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env.mjs';
import { lastSourceSync, markSource, saveRecordNote, vanDay } from './integrations-records';
import { fail } from './log';
import { riversideConfigured, syncRiverside } from './riverside';

type Sql = NeonQueryFunction<false, false>;

/**
 * Granola public API (docs.granola.ai): https://public-api.granola.ai/v1, Bearer key "grn_...".
 * Personal keys are created in the Granola desktop app (Settings, Connectors, API keys) on a Business or
 * Enterprise plan. Read-only. Only notes that already have an AI summary and transcript are returned.
 * Rate limit: 5 requests/second sustained, burst 25. There are no webhooks, so new notes are polled.
 */
const BASE = 'https://public-api.granola.ai/v1';
const LOOKBACK_DAYS = 30;
const MAX_NEW_PER_RUN = 15;

export function granolaConfigured() {
  return !!env('GRANOLA_API_KEY');
}

type GranolaUser = { name?: string | null; email?: string };
type GranolaNote = {
  id: string;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
  web_url?: string;
  owner?: GranolaUser;
  attendees?: GranolaUser[];
  calendar_event?: { event_title?: string | null; scheduled_start_time?: string | null; scheduled_end_time?: string | null; invitees?: Array<{ email?: string }> } | null;
  summary_text?: string;
  summary_markdown?: string | null;
  private_notes_text?: string | null;
  transcript?: Array<{ speaker?: { source?: string; attribution?: string; name?: string; diarization_label?: string }; text?: string }> | null;
};

class GranolaError extends Error {
  status: number;
  constructor(status: number) {
    super(`granola ${status}`);
    this.status = status;
  }
}

async function call(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${env('GRANOLA_API_KEY')}`, accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!res.ok) throw new GranolaError(res.status);
  return res.json();
}

function speakerOf(line: NonNullable<GranolaNote['transcript']>[number]) {
  const s = line.speaker || {};
  if (s.name) return s.name;
  if (s.attribution === 'me') return 'Chad';
  if (s.attribution === 'them') return 'Them';
  return s.diarization_label || (s.source === 'microphone' ? 'Chad' : 'Them');
}

function transcriptText(lines: GranolaNote['transcript']) {
  if (!Array.isArray(lines)) return '';
  return lines.map((l) => `${speakerOf(l)}: ${String(l.text || '').trim()}`).filter((l) => l.length > 3).join('\n');
}

async function fullNote(id: string): Promise<GranolaNote | null> {
  try {
    return (await call(`/notes/${encodeURIComponent(id)}?include=transcript`)) as GranolaNote;
  } catch (err) {
    // 413 TRANSCRIPT_TOO_LARGE: keep the note and summary without the transcript.
    if (err instanceof GranolaError && err.status === 413) return (await call(`/notes/${encodeURIComponent(id)}`)) as GranolaNote;
    if (err instanceof GranolaError && err.status === 404) return null;
    throw err;
  }
}

/** Pull recent Granola notes into Zoom notes (origin 'granola'). Returns counts; writes sync_state 'granola'. */
export async function syncGranola(sql: Sql, ownerId: string) {
  if (!granolaConfigured()) {
    await markSource(sql, ownerId, 'granola', 'not_connected', 'GRANOLA_API_KEY not set');
    return { ok: false as const, status: 'not_connected', added: 0, filled: 0, seen: 0 };
  }
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  let added = 0;
  let filled = 0;
  let seen = 0;
  try {
    const known = new Set(
      ((await sql`SELECT note_id FROM zoom_notes WHERE owner_id = ${ownerId} AND note_id LIKE 'granola-%'
        AND COALESCE(ai_summary, '') <> '' AND COALESCE(transcript, '') <> ''`) as Array<{ note_id: string }>).map((r) => r.note_id),
    );
    let cursor = '';
    let fetched = 0;
    for (let page = 0; page < 5; page += 1) {
      const q = new URLSearchParams({ created_after: since, page_size: '30' });
      if (cursor) q.set('cursor', cursor);
      const list = (await call(`/notes?${q}`)) as { notes?: GranolaNote[]; hasMore?: boolean; cursor?: string | null };
      for (const brief of list.notes || []) {
        seen += 1;
        const noteId = `granola-${brief.id}`;
        if (known.has(noteId) || fetched >= MAX_NEW_PER_RUN) continue;
        fetched += 1;
        const n = await fullNote(brief.id);
        if (!n) continue;
        const people = (n.attendees || [])
          .map((a) => String(a.name || a.email || '').trim())
          .filter((name) => name && !/chad/i.test(name) && name.toLowerCase() !== String(n.owner?.email || '').toLowerCase());
        const start = n.calendar_event?.scheduled_start_time || n.created_at || '';
        const end = n.calendar_event?.scheduled_end_time || '';
        const mins = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) : NaN;
        const result = await saveRecordNote(sql, ownerId, {
          noteId,
          origin: 'granola',
          date: vanDay(start),
          title: String(n.title || n.calendar_event?.event_title || 'Granola note'),
          attendees: people,
          summary: String(n.summary_markdown || n.summary_text || ''),
          rawNotes: String(n.private_notes_text || ''),
          transcript: transcriptText(n.transcript),
          recordingUrl: '',
          durationMin: Number.isFinite(mins) && mins > 0 ? mins : null,
          sources: [{ name: 'Granola', url: n.web_url && /^https:\/\//.test(n.web_url) ? n.web_url : null }],
        });
        if (result === 'added') added += 1;
        if (result === 'filled') filled += 1;
      }
      if (!list.hasMore || !list.cursor) break;
      cursor = String(list.cursor);
    }
    await markSource(sql, ownerId, 'granola', seen ? 'connected' : 'reached_empty', `${seen} notes in the last ${LOOKBACK_DAYS} days`);
    return { ok: true as const, status: 'connected', added, filled, seen };
  } catch (err) {
    const status = err instanceof GranolaError ? err.status : 0;
    fail('granola_sync', err);
    const detail = status === 401 ? 'Granola refused the key (401). Check GRANOLA_API_KEY.' : status === 429 ? 'Granola rate limit; try again in a minute.' : 'Granola did not answer.';
    await markSource(sql, ownerId, 'granola', 'unavailable', detail);
    return { ok: false as const, status: status === 401 ? 'bad_key' : 'unavailable', added, filled, seen, error: detail };
  }
}

/** Cron helper: Granola and Riverside at most every 30 minutes each. Never throws. */
export async function pollRecordSources(sql: Sql, ownerId: string) {
  const out: Record<string, number | string> = {};
  const due = async (source: string) => Date.now() - (await lastSourceSync(sql, ownerId, source)) > 30 * 60 * 1000;
  try {
    if (granolaConfigured() && (await due('granola'))) {
      const g = await syncGranola(sql, ownerId);
      out.granola = g.added;
    }
    if (riversideConfigured() && (await due('riverside'))) {
      const r = await syncRiverside(sql, ownerId);
      out.riverside = r.added;
    }
  } catch (err) {
    fail('record_poll', err);
  }
  return out;
}
