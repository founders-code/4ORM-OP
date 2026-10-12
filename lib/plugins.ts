import type { NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env.mjs';
import { ghlConfigured } from './ghl';
import { googleConfigured } from './google';

type Sql = NeonQueryFunction<false, false>;

type Live = { connected: boolean; status: string; credential: string };

export const PLUGIN_CATALOG = [
  { slug: 'gmail', name: 'Gmail', info: 'Mail that becomes tasks', color: '#D6334E', ic: '@' },
  { slug: 'calendar', name: 'Google Calendar', info: 'Calendar tab, drag to reschedule', color: '#2E6BF2', ic: '#' },
  { slug: 'drive', name: 'Google Drive', info: 'Documents and Drive, one folder tree', color: '#0E8A5F', ic: 'D' },
  { slug: 'ghl', name: 'GoHighLevel', info: 'Pipeline, reminders, contacts', color: '#8A5200', ic: 'G' },
  { slug: 'brief', name: 'Morning brief', info: 'Weekday 6:00 America/Edmonton', color: '#1B7BB5', ic: '*' },
  { slug: 'anthropic', name: 'Anthropic', info: 'Model layer', color: '#C9785B', ic: 'A' },
  { slug: 'openai', name: 'OpenAI', info: 'Model layer', color: '#0E8A5F', ic: 'O' },
  { slug: 'third', name: 'Third model', info: 'Confirm which provider', color: '#8A5200', ic: '3' },
  { slug: 'perplexity', name: 'Perplexity', info: 'Search', color: '#1B7BB5', ic: 'P' },
  { slug: 'riverside', name: 'Riverside', info: 'Recording', color: '#D6334E', ic: 'R' },
  { slug: 'vercel', name: 'Vercel', info: 'Hosting', color: '#111111', ic: 'V' },
  { slug: 'cursor', name: 'Cursor', info: 'Editor', color: '#2E6BF2', ic: 'C' },
] as const;

const KEY_BY_SLUG: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  riverside: 'RIVERSIDE_API_KEY',
  vercel: 'VERCEL_TOKEN',
  cursor: 'CURSOR_API_KEY',
};

function present(on: boolean): Live {
  return { connected: on, status: on ? 'Connected' : 'Not connected', credential: on ? 'Present' : 'Not set' };
}

export function livePlugin(slug: string, sync?: Map<string, string>): Live {
  if (slug === 'gmail' || slug === 'calendar' || slug === 'drive') {
    const status = sync?.get(slug) || '';
    const connected = status === 'connected' || status === 'reached_empty';
    const word = status === 'connected' ? 'Connected' : status === 'reached_empty' ? 'Reached, nothing today' : status === 'stale' ? 'Stale' : 'Not connected';
    return { connected, status: word, credential: googleConfigured() ? 'Present' : 'Not set' };
  }
  if (slug === 'ghl') {
    const status = sync?.get('ghl') || '';
    const connected = status === 'connected' || status === 'reached_empty';
    const word = status === 'connected' ? 'Connected' : status === 'reached_empty' ? 'Reached, nothing today' : status === 'stale' ? 'Stale' : 'Not connected';
    return { connected, status: word, credential: ghlConfigured() ? 'Present' : 'Not set' };
  }
  if (slug === 'brief') {
    const status = sync?.get('brief') || '';
    const connected = status === 'connected';
    return { connected, status: connected ? 'Connected' : 'Scheduled', credential: 'Server' };
  }
  if (slug === 'third') {
    const on = !!(env('THIRD_MODEL_NAME') && env('THIRD_MODEL_KEY'));
    return { connected: on, status: on ? 'Connected' : 'Confirm provider', credential: on ? 'Present' : 'Not set' };
  }
  const key = KEY_BY_SLUG[slug];
  return present(!!(key && env(key)));
}

export function pluginCard(row: { id: string; slug: string; name: string; info: string; color: string; ic: string }, sync?: Map<string, string>) {
  const live = livePlugin(row.slug, sync);
  return {
    id: row.id,
    name: row.slug === 'third' && env('THIRD_MODEL_NAME') ? env('THIRD_MODEL_NAME') : row.name,
    info: row.info,
    connected: live.connected,
    status: live.status,
    credential: live.credential,
    color: row.color,
    ic: row.ic,
  };
}

export function idlePlugins() {
  return PLUGIN_CATALOG.map((row) => pluginCard({ ...row, id: row.slug }));
}

export async function listPlugins(sql: Sql, ownerId: string, sync?: Map<string, string>) {
  const existing = await sql`SELECT id FROM plugins WHERE owner_id = ${ownerId} LIMIT 1`;
  if (!existing.length) {
    for (const row of PLUGIN_CATALOG) {
      const live = livePlugin(row.slug, sync);
      await sql`
        INSERT INTO plugins (owner_id, slug, name, info, connected, status, credential, color, ic)
        VALUES (${ownerId}, ${row.slug}, ${row.name}, ${row.info}, ${live.connected}, ${live.status}, ${live.credential}, ${row.color}, ${row.ic})
      `;
    }
  }
  const rows = await sql`
    SELECT id, slug, name, info, color, ic
    FROM plugins
    WHERE owner_id = ${ownerId}
    ORDER BY created_at
  `;
  return (rows as Array<Record<string, unknown>>).map((row) => pluginCard({
    id: String(row.id),
    slug: String(row.slug || ''),
    name: String(row.name || ''),
    info: String(row.info || ''),
    color: String(row.color || '#2E6BF2'),
    ic: String(row.ic || ''),
  }, sync));
}
