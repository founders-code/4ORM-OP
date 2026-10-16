import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import { extractCommitments } from './war.mjs';
import { listZoomNotes } from './zoom-notes';

type Sql = NeonQueryFunction<false, false>;

const FOLLOW_RE = /\b(follow[- ]up|they asked|asked (me|us) to|please send|send (them|him|her)|next step|owed)\b/i;

export async function ensureMeetingActions(sql: Sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS meeting_actions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      source text NOT NULL DEFAULT 'zoom',
      meeting_id text NOT NULL,
      meeting_title text,
      meeting_date text,
      text text NOT NULL,
      kind text NOT NULL DEFAULT 'you_said',
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, meeting_id, text)
    )`;
  } catch (err) {
    fail('meeting_actions_table', err);
  }
}

function sourceOf(note: { sources?: Array<{ name?: string }> }) {
  const blob = (note.sources || []).map((row) => String(row.name || '')).join(' ').toLowerCase();
  return /granola/.test(blob) ? 'granola' : 'zoom';
}

function linesOf(note: { others?: string[]; improve?: string[]; intel?: unknown[] }) {
  const intel = (note.intel || []).map((item) => (typeof item === 'string' ? item : (item as { value?: string })?.value || ''));
  const raw: string[] = [...(note.others || []), ...(note.improve || []), ...intel];
  return raw
    .map((line) => String(line || '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 240))
    .filter(Boolean);
}

export function extractMeetingActions(notes: Array<Record<string, unknown>>) {
  const out: Array<{
    source: string;
    meetingId: string;
    meetingTitle: string;
    meetingDate: string;
    text: string;
    kind: 'you_said' | 'follow_up';
  }> = [];
  const seen = new Set<string>();
  const you = extractCommitments(notes);
  for (const row of you) {
    const text = String(row.text || '').slice(0, 240);
    if (!text) continue;
    const meetingId = String(row.sourceNoteId || '');
    const key = `${meetingId}|${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const note = notes.find((n) => String(n.id || n.noteId || '') === meetingId) || {};
    out.push({
      source: sourceOf(note as { sources?: Array<{ name?: string }> }),
      meetingId,
      meetingTitle: String((note as { title?: string }).title || ''),
      meetingDate: String(row.madeOn || (note as { date?: string }).date || '').slice(0, 10),
      text,
      kind: 'you_said',
    });
  }
  for (const note of notes || []) {
    const meetingId = String(note.id || note.noteId || '');
    for (const text of linesOf(note as { others?: string[]; improve?: string[]; intel?: unknown[] })) {
      if (!FOLLOW_RE.test(text) || /\b(i will|i'll|i\u2019ll|i am going to|i'm going to)\b/i.test(text)) continue;
      const key = `${meetingId}|${text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        source: sourceOf(note as { sources?: Array<{ name?: string }> }),
        meetingId,
        meetingTitle: String(note.title || ''),
        meetingDate: String(note.date || '').slice(0, 10),
        text,
        kind: 'follow_up',
      });
    }
  }
  return out;
}

function shape(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    source: String(row.source || 'zoom'),
    meetingId: String(row.meeting_id || ''),
    meetingTitle: String(row.meeting_title || ''),
    meetingDate: String(row.meeting_date || '').slice(0, 10),
    text: String(row.text || ''),
    kind: String(row.kind || 'you_said') === 'follow_up' ? 'follow_up' : 'you_said',
    status: String(row.status || 'open'),
  };
}

export async function listMeetingActions(sql: Sql, ownerId: string) {
  await ensureMeetingActions(sql);
  try {
    const notes = await listZoomNotes(sql, ownerId);
    const extracted = extractMeetingActions(notes as unknown as Array<Record<string, unknown>>);
    for (const row of extracted.slice(0, 80)) {
      await sql`
        INSERT INTO meeting_actions (owner_id, source, meeting_id, meeting_title, meeting_date, text, kind)
        VALUES (${ownerId}, ${row.source}, ${row.meetingId}, ${row.meetingTitle}, ${row.meetingDate}, ${row.text}, ${row.kind})
        ON CONFLICT (owner_id, meeting_id, text) DO NOTHING
      `;
    }
  } catch (err) {
    fail('meeting_actions_extract', err);
  }
  try {
    const rows = await sql`
      SELECT id, source, meeting_id, meeting_title, meeting_date, text, kind, status, created_at
      FROM meeting_actions
      WHERE owner_id = ${ownerId} AND status = 'open'
      ORDER BY meeting_date DESC, created_at DESC
      LIMIT 80
    `;
    return (rows as Array<Record<string, unknown>>).map(shape);
  } catch (err) {
    fail('meeting_actions_list', err);
    return [];
  }
}

export async function markMeetingAction(sql: Sql, ownerId: string, id: string, status: string) {
  const next = status === 'done' || status === 'tasked' ? status : 'open';
  try {
    await sql`
      UPDATE meeting_actions SET status = ${next}
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}
    `;
  } catch (err) {
    fail('meeting_actions_mark', err);
  }
  return listMeetingActions(sql, ownerId);
}
