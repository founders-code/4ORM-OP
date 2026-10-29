import { randomUUID } from 'crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { refreshCeo } from './ceo';
import { asJsonArray, recordChange, readMailCache, readPipelineCache, writeMailCache, writePipelineCache } from './changes';
import { env } from './env.mjs';
import {
  getContact,
  getOpportunity,
  listPipelines,
  localStageName,
  patchPipelines,
  shapePipelineStages,
  type GhlPipeline,
} from './ghl';
import { isUniqueViolation } from './db';
import { inferContactCategory } from './guard.mjs';
import {
  classifyGmailIds,
  gmailProfileHistoryId,
  inboxMail,
  linkedinMail,
  listGmailHistory,
  stopCalendarWatch,
  watchCalendar,
  watchGmail,
} from './google';
import { fail, note } from './log';
import { listMeetingActions } from './meeting-actions';
import { calendarHookToken, gmailPubsubTopic } from './secrets';
import { syncCalendar, syncGhl } from './sync';
import { ingestZoomRecording, filledZoomIds, syncZoomApi } from './zoom';
import { listZoomNotes } from './zoom-notes';
import { syncMyNotes } from './zoom-notes-user';

type Sql = NeonQueryFunction<false, false>;

async function watchRow(sql: Sql, ownerId: string, source: string) {
  const rows = await sql`
    SELECT channel_id, resource_id, token, expiration, history_id, extra
    FROM watch_channels WHERE owner_id = ${ownerId} AND source = ${source} LIMIT 1
  `.catch(() => []);
  return rows[0] as
    | { channel_id?: string; resource_id?: string; token?: string; expiration?: string; history_id?: string; extra?: unknown }
    | undefined;
}

async function saveWatch(
  sql: Sql,
  ownerId: string,
  source: string,
  fields: { channelId?: string; resourceId?: string; token?: string; expiration?: number; historyId?: string },
) {
  await sql`
    INSERT INTO watch_channels (owner_id, source, channel_id, resource_id, token, expiration, history_id)
    VALUES (
      ${ownerId}, ${source}, ${fields.channelId || ''}, ${fields.resourceId || ''}, ${fields.token || ''},
      ${fields.expiration ? new Date(fields.expiration).toISOString() : null}, ${fields.historyId || ''}
    )
    ON CONFLICT (owner_id, source) DO UPDATE SET
      channel_id = COALESCE(NULLIF(EXCLUDED.channel_id, ''), watch_channels.channel_id),
      resource_id = COALESCE(NULLIF(EXCLUDED.resource_id, ''), watch_channels.resource_id),
      token = COALESCE(NULLIF(EXCLUDED.token, ''), watch_channels.token),
      expiration = COALESCE(EXCLUDED.expiration, watch_channels.expiration),
      history_id = COALESCE(NULLIF(EXCLUDED.history_id, ''), watch_channels.history_id)
  `;
}

function mergeRows<T extends { id: string }>(prior: T[], incoming: T[], max: number) {
  const byId = new Map<string, T>();
  for (const row of prior) if (row?.id) byId.set(row.id, row);
  for (const row of incoming) if (row?.id) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => Number((b as { at?: number }).at || 0) - Number((a as { at?: number }).at || 0)).slice(0, max);
}

async function upsertMailItems(sql: Sql, ownerId: string, messages: Array<{ id: string; subject?: string; title?: string; email?: string; at?: number }>) {
  const titles: string[] = [];
  for (const message of messages) {
    const title = String(message.subject || message.title || '').slice(0, 180);
    if (!title || !message.id) continue;
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await sql`
        INSERT INTO items (owner_id, title, area, status, priority, source, source_id)
        VALUES (${ownerId}, ${title}, 'outreach', 'new', 'normal', 'gmail', ${message.id})
        ON CONFLICT (owner_id, source, source_id) WHERE source_id IS NOT NULL
        DO UPDATE SET title = EXCLUDED.title, updated_at = now()
        RETURNING (created_at = updated_at) AS inserted, title
      `;
    } catch (err) {
      // A live task with this subject already exists (items_owner_title_open_uq): skip, keep syncing.
      if (!isUniqueViolation(err)) throw err;
    }
    if (rows[0]?.inserted) titles.push(String(rows[0].title));
    const email = String(message.email || '').trim();
    const at = Number(message.at);
    if (email && Number.isFinite(at) && at > 0) {
      const iso = new Date(at).toISOString();
      await sql`
        UPDATE contacts SET last_touch = ${iso}::timestamptz
        WHERE owner_id = ${ownerId} AND lower(email) = lower(${email})
          AND (last_touch IS NULL OR last_touch < ${iso}::timestamptz)
      `;
    }
  }
  return titles;
}

export async function cacheInbox(sql: Sql, ownerId: string, force = false) {
  const prior = await readMailCache(sql, ownerId);
  if (!force && prior && Date.now() - prior.fetchedAt < 4 * 60 * 1000) return { added: 0, linkedin: 0, usedCache: true };
  const [mail, linked] = await Promise.all([inboxMail(), linkedinMail()]);
  const messages = mail.messages || [];
  const linkedin = linked.items || [];
  const newMail = messages.filter((row) => !(prior?.messages || []).some((hit) => (hit as { id?: string }).id === row.id));
  const newLinked = linkedin.filter((row) => !(prior?.linkedin || []).some((hit) => (hit as { id?: string }).id === row.id));
  await writeMailCache(sql, ownerId, messages, linkedin);
  const titles = await upsertMailItems(sql, ownerId, newMail);
  if (newMail.length) await recordChange(sql, ownerId, 'mail', { added: newMail.length });
  if (newLinked.length) await recordChange(sql, ownerId, 'linkedin', { added: newLinked.length });
  const historyId = await gmailProfileHistoryId().catch(() => '');
  if (historyId) await saveWatch(sql, ownerId, 'gmail', { historyId });
  return { added: titles.length, linkedin: newLinked.length, usedCache: false, titles };
}

export async function applyGmailHistory(sql: Sql, ownerId: string) {
  const row = await watchRow(sql, ownerId, 'gmail');
  const start = String(row?.history_id || '');
  if (!start) {
    const full = await cacheInbox(sql, ownerId, true);
    return { added: full.added, linkedin: full.linkedin, mode: 'full' as const };
  }
  const history = await listGmailHistory(start);
  if (history.expired) {
    const full = await cacheInbox(sql, ownerId, true);
    return { added: full.added, linkedin: full.linkedin, mode: 'expired' as const };
  }
  if (history.historyId) await saveWatch(sql, ownerId, 'gmail', { historyId: history.historyId });
  if (!history.ids.length) return { added: 0, linkedin: 0, mode: 'history' as const };
  const classified = await classifyGmailIds(history.ids);
  const prior = (await readMailCache(sql, ownerId)) || { messages: [], linkedin: [] };
  const messages = mergeRows(prior.messages as Array<{ id: string }>, classified.messages, 40);
  const linkedin = mergeRows(prior.linkedin as Array<{ id: string }>, classified.linkedin, 12);
  await writeMailCache(sql, ownerId, messages, linkedin);
  const titles = await upsertMailItems(sql, ownerId, classified.messages);
  if (classified.messages.length) await recordChange(sql, ownerId, 'mail', { added: classified.messages.length, ids: classified.messages.map((row) => row.id) });
  if (classified.linkedin.length) await recordChange(sql, ownerId, 'linkedin', { added: classified.linkedin.length });
  return { added: titles.length || classified.messages.length, linkedin: classified.linkedin.length, mode: 'history' as const, titles };
}

export async function cachePipelines(sql: Sql, ownerId: string) {
  const all = await listPipelines();
  if (all.status === 'unavailable') return { ok: false, added: 0 };
  const stages = shapePipelineStages(all.pipelines);
  const prior = await readPipelineCache(sql, ownerId);
  await writePipelineCache(sql, ownerId, all.pipelines, stages);
  for (const stage of stages) {
    await sql`
      INSERT INTO pipeline_stages (owner_id, stage, count, detail, updated_at)
      VALUES (${ownerId}, ${stage.stage}, ${stage.count}, ${stage.detail}, now())
      ON CONFLICT (owner_id, stage)
      DO UPDATE SET count = EXCLUDED.count, detail = EXCLUDED.detail, updated_at = now()
    `;
  }
  const changed = JSON.stringify(prior?.pipelines || []) !== JSON.stringify(all.pipelines);
  if (changed) await recordChange(sql, ownerId, 'pipeline', { pipelines: all.pipelines.length });
  return { ok: true, added: changed ? 1 : 0, pipelines: all.pipelines };
}

async function upsertGhlContact(sql: Sql, ownerId: string, contact: { id: string; name: string; company: string; role: string; email: string; phone: string }, stage = '') {
  const category = inferContactCategory(`${contact.company} ${contact.role} ${contact.name}`);
  await sql`
    INSERT INTO contacts (owner_id, name, company, role, email, phone, area, source, source_id, category, stage)
    VALUES (
      ${ownerId}, ${contact.name}, ${contact.company}, ${contact.role}, ${contact.email}, ${contact.phone},
      'investors', 'ghl', ${contact.id}, ${category === 'other' && (contact.company || contact.email) ? 'business' : category},
      ${stage || 'new'}
    )
    ON CONFLICT (owner_id, source, source_id) WHERE source_id IS NOT NULL
    DO UPDATE SET
      name = EXCLUDED.name,
      company = EXCLUDED.company,
      role = EXCLUDED.role,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      stage = CASE WHEN EXCLUDED.stage <> '' AND EXCLUDED.stage <> 'new' THEN EXCLUDED.stage ELSE contacts.stage END,
      last_touch = now(),
      category = CASE WHEN contacts.category IS NULL OR contacts.category = '' OR contacts.category = 'other' THEN EXCLUDED.category ELSE contacts.category END
  `;
  await recordChange(sql, ownerId, 'people', { id: contact.id });
}

export async function applyGhlEvent(sql: Sql, ownerId: string, body: Record<string, unknown>) {
  const type = String(body.type || body.event || '').toLowerCase();
  const contactId = String(body.contactId || body.contact_id || (body.contact as { id?: string } | undefined)?.id || (/contact/.test(type) ? body.id : '') || '');
  const oppId = String(body.opportunityId || body.opportunity_id || (/opportunit/.test(type) ? body.id : '') || '');
  let stageChanged = false;
  if (contactId) {
    const contact = await getContact(contactId);
    if (contact) await upsertGhlContact(sql, ownerId, contact, localStageName(String(body.pipelineStage || body.stage || '')));
  }
  if (oppId || /opportunit|stage/.test(type)) {
    const opp = oppId ? await getOpportunity(oppId) : null;
    if (opp) {
      const prior = await readPipelineCache(sql, ownerId);
      const pipelines = (prior?.pipelines || []) as GhlPipeline[];
      const stageName = String(body.pipelineStage || body.stageName || body.stage || '');
      if (pipelines.length) {
        const next = patchPipelines(pipelines, opp, stageName);
        const stages = shapePipelineStages(next);
        await writePipelineCache(sql, ownerId, next, stages);
        for (const stage of stages) {
          await sql`
            INSERT INTO pipeline_stages (owner_id, stage, count, detail, updated_at)
            VALUES (${ownerId}, ${stage.stage}, ${stage.count}, ${stage.detail}, now())
            ON CONFLICT (owner_id, stage)
            DO UPDATE SET count = EXCLUDED.count, detail = EXCLUDED.detail, updated_at = now()
          `;
        }
      } else {
        await cachePipelines(sql, ownerId);
      }
      await recordChange(sql, ownerId, 'pipeline', { id: opp.id, stage: stageName || opp.pipelineStageId });
      stageChanged = /stage/.test(type) || !!stageName;
      if (opp.contactId && !contactId) {
        const contact = await getContact(opp.contactId);
        if (contact) await upsertGhlContact(sql, ownerId, contact, localStageName(stageName));
      }
    } else {
      await cachePipelines(sql, ownerId);
      stageChanged = /stage/.test(type);
    }
  }
  if (/message/.test(type) && contactId) {
    const iso = new Date().toISOString();
    await sql`
      UPDATE contacts SET last_touch = ${iso}::timestamptz
      WHERE owner_id = ${ownerId} AND source = 'ghl' AND source_id = ${contactId}
    `;
    await recordChange(sql, ownerId, 'people', { id: contactId, message: true });
  }
  return { stageChanged, contactId, oppId };
}

export async function applyCalendarNotify(sql: Sql, ownerId: string) {
  await syncCalendar(sql, ownerId, true);
  await recordChange(sql, ownerId, 'calendar', { at: Date.now() });
}

export async function applyZoomEvent(sql: Sql, ownerId: string, body: Record<string, unknown>) {
  const event = String(body.event || '').toLowerCase();
  const payload = (body.payload || body) as Record<string, unknown>;
  const object = (payload.object || payload) as Record<string, unknown>;
  const uuid = String(object.uuid || object.id || '');
  if (!uuid) return { added: false };
  if (!/recording|transcript/.test(event) && event && event !== 'endpoint.url_validation') {
    if (!/completed/.test(event)) return { added: false };
  }
  const files = Array.isArray(object.recording_files) ? object.recording_files : [];
  const result = await ingestZoomRecording(sql, ownerId, {
    uuid,
    topic: String(object.topic || ''),
    start_time: String(object.start_time || ''),
    recording_files: files as Array<{ file_type?: string; download_url?: string; status?: string }>,
  });
  if (result.added) {
    await recordChange(sql, ownerId, 'zoom', { uuid });
    await listMeetingActions(sql, ownerId).catch((err) => fail('zoom_actions', err));
  }
  return result;
}

export async function runIntel(sql: Sql, ownerId: string, reason: string) {
  try {
    await refreshCeo(sql, ownerId);
    note('intel', reason);
  } catch (err) {
    fail('intel', err);
  }
}

export async function ensureWatches(sql: Sql, ownerId: string, origin: string) {
  const topic = gmailPubsubTopic();
  if (topic) {
    const watched = await watchGmail(topic).catch((err) => {
      fail('gmail_watch', err);
      return null;
    });
    if (watched) {
      await saveWatch(sql, ownerId, 'gmail', { historyId: watched.historyId, expiration: watched.expiration });
      note('gmail_watch', `history=${watched.historyId} exp=${watched.expiration}`);
    }
  }
  const token = calendarHookToken();
  if (token && /^https:\/\//i.test(origin)) {
    const prior = await watchRow(sql, ownerId, 'calendar');
    const exp = prior?.expiration ? new Date(String(prior.expiration)).getTime() : 0;
    if (exp > Date.now() + 36 * 60 * 60 * 1000) return;
    if (prior?.channel_id && prior?.resource_id) {
      await stopCalendarWatch(String(prior.channel_id), String(prior.resource_id)).catch((err) => fail('cal_unwatch', err));
    }
    const channelId = randomUUID();
    const watched = await watchCalendar({
      address: `${origin}/api/hooks/calendar`,
      token,
      channelId,
    }).catch((err) => {
      fail('cal_watch', err);
      return null;
    });
    if (watched) {
      await saveWatch(sql, ownerId, 'calendar', {
        channelId: watched.channelId,
        resourceId: watched.resourceId,
        token,
        expiration: watched.expiration,
      });
      note('cal_watch', `id=${watched.channelId} exp=${watched.expiration}`);
    }
  }
}

export async function safetySweep(sql: Sql, ownerId: string, origin = '') {
  /* Mail: read only what changed since the last history id (one or two calls). A full inbox read
     (about 45 calls) runs at most once an hour, or when there is no history to read from. */
  const cached = await readMailCache(sql, ownerId).catch(() => null);
  const stale = !cached || Date.now() - cached.fetchedAt > 60 * 60 * 1000;
  const mail = await (stale ? cacheInbox(sql, ownerId, true) : applyGmailHistory(sql, ownerId)).catch((err) => {
    fail('live_mail', err);
    return { added: 0, linkedin: 0, titles: [] as string[] };
  });
  await syncCalendar(sql, ownerId, true).catch((err) => fail('live_cal', err));
  /* GoHighLevel: the webhook carries changes as they happen; the sweep is a 30-minute safety net. */
  const ghlAt = await sql`SELECT synced_at FROM sync_state WHERE owner_id = ${ownerId} AND source = 'ghl'`.then((r) => (r[0]?.synced_at ? new Date(String(r[0].synced_at)).getTime() : 0)).catch(() => 0);
  const ghl = await (Date.now() - ghlAt > 30 * 60 * 1000 ? syncGhl(sql, ownerId, true) : Promise.resolve(undefined)).catch((err) => {
    fail('live_ghl', err);
    return undefined;
  });
  void ghl;
  const known = await filledZoomIds(sql, ownerId).catch(() => new Set<string>());
  const zoom = await syncZoomApi(sql, ownerId, known).catch((err) => {
    fail('live_zoom', err);
    return { added: 0, filled: 0 };
  });
  /* Zoom My Notes (transcripts and AI notes) every 30 minutes; new meetings land with recap and next steps. */
  const notesAt = await sql`SELECT synced_at FROM sync_state WHERE owner_id = ${ownerId} AND source = 'zoom_notes'`.then((r) => (r[0]?.synced_at ? new Date(String(r[0].synced_at)).getTime() : 0)).catch(() => 0);
  if (Date.now() - notesAt > 30 * 60 * 1000) {
    const fresh = await filledZoomIds(sql, ownerId).catch(() => new Set<string>());
    const mn = await syncMyNotes(sql, ownerId, fresh, 2).catch((err) => {
      fail('live_zoom_notes', err);
      return { added: 0 };
    });
    await sql`INSERT INTO sync_state (owner_id, source, status, synced_at) VALUES (${ownerId}, 'zoom_notes', 'ok', now()) ON CONFLICT (owner_id, source) DO UPDATE SET synced_at = now()`.catch(() => {});
    zoom.added = (zoom.added || 0) + (mn.added || 0);
  }
  if (zoom.added || zoom.filled) {
    await recordChange(sql, ownerId, 'zoom', { added: zoom.added, filled: zoom.filled });
    await listMeetingActions(sql, ownerId).catch((err) => fail('zoom_actions', err));
  }
  if (origin) await ensureWatches(sql, ownerId, origin).catch((err) => fail('live_watch', err));
  const newItems = (mail.added || 0) + (mail.linkedin || 0) + (zoom.added || 0);
  if (newItems > 0) await runIntel(sql, ownerId, `sweep mail=${mail.added} zoom=${zoom.added}`);
  note('cron_live', `mail=${mail.added} linkedin=${mail.linkedin || 0} zoom=${zoom.added || 0} origin=${origin ? 'yes' : 'no'}`);
  const { tape } = await import('./outbound');
  await tape('ok', 'cron', `mail=${mail.added} linkedin=${mail.linkedin || 0} zoom=${zoom.added || 0}`);
  return { mail: mail.added, linkedin: mail.linkedin || 0, zoom: zoom.added || 0 };
}

export async function changePayload(sql: Sql, ownerId: string, kinds: Array<'mail' | 'linkedin' | 'calendar' | 'pipeline' | 'zoom' | 'people'>) {
  const out: Record<string, unknown> = {};
  if (kinds.includes('mail') || kinds.includes('linkedin')) {
    const mail = await readMailCache(sql, ownerId);
    if (kinds.includes('mail')) out.mail = mail?.messages || [];
    if (kinds.includes('linkedin')) out.linkedin = mail?.linkedin || [];
  }
  if (kinds.includes('calendar')) {
    const rows = await sql`SELECT events FROM calendar_cache WHERE owner_id = ${ownerId} LIMIT 1`;
    out.calendar = asJsonArray(rows[0]?.events);
  }
  if (kinds.includes('pipeline')) {
    const pipe = await readPipelineCache(sql, ownerId);
    out.pipeline = pipe?.pipelines || [];
  }
  if (kinds.includes('zoom')) {
    out.zoom = await listZoomNotes(sql, ownerId).catch(() => []);
  }
  if (kinds.includes('people')) {
    const rows = await sql`
      SELECT id, name, company, role, email, phone, area, notes, type, tier, stage, next_action, next_date, last_touch, category
      FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY name LIMIT 400
    `;
    out.people = rows;
  }
  return out;
}

export function publicOrigin() {
  const host = env('VERCEL_PROJECT_PRODUCTION_URL') || env('VERCEL_URL');
  if (!host) return '';
  return host.startsWith('http') ? host : `https://${host}`;
}
