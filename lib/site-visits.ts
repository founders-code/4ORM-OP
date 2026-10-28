import type { Sql } from './db';
import { fail } from './log';

/* Visits reported by our own sites (the data room first). Each site posts page views to /api/hooks/visit
   with the shared beacon key. Signed-in data room visits name the person; the first visit of a session
   also writes a Signals event so Chad sees who just came in. */
/* Optional shared key: when SITE_BEACON_KEY is set here and on the reporting site, reports must carry it. */
export const BEACON_KEY = process.env.SITE_BEACON_KEY || '';

export async function ensureVisits(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS site_visits (
    id bigserial PRIMARY KEY,
    site text NOT NULL,
    path text NOT NULL DEFAULT '/',
    user_id text,
    email text,
    name text,
    visitor text,
    ref text,
    verified boolean NOT NULL DEFAULT false,
    ip text,
    at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS site_visits_site_at ON site_visits (site, at DESC)`;
}

export type Visit = { site: string; path: string; userId?: string; email?: string; name?: string; visitor?: string; ref?: string; verified?: boolean; ip?: string };

/** At most 120 reports a minute from one address (stops a flood when no shared key is set). */
export async function tooMany(sql: Sql, ip: string) {
  if (!ip) return false;
  await ensureVisits(sql);
  await sql`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS ip text`;
  const r = await sql`SELECT count(*)::int AS n FROM site_visits WHERE ip = ${ip} AND at > now() - interval '1 minute'`;
  return Number(r[0]?.n) >= 120;
}

export async function recordVisit(sql: Sql, v: Visit) {
  await ensureVisits(sql);
  const site = String(v.site || '').slice(0, 60) || 'unknown';
  const userId = v.userId ? String(v.userId).slice(0, 80) : null;
  /* New session = this person's first page in 30 minutes. That is the sign-in alert. */
  let fresh = false;
  if (userId) {
    const recent = await sql`SELECT 1 FROM site_visits WHERE site = ${site} AND user_id = ${userId} AND at > now() - interval '30 minutes' LIMIT 1`;
    fresh = !recent.length;
  }
  await sql`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS ip text`;
  await sql`INSERT INTO site_visits (site, path, user_id, email, name, visitor, ref, verified, ip)
    VALUES (${site}, ${String(v.path || '/').slice(0, 300)}, ${userId}, ${v.email ? String(v.email).slice(0, 200) : null},
      ${v.name ? String(v.name).slice(0, 120) : null}, ${v.visitor ? String(v.visitor).slice(0, 80) : null}, ${v.ref ? String(v.ref).slice(0, 300) : null},
      ${!!v.verified}, ${v.ip ? String(v.ip).slice(0, 60) : null})`;
  if (fresh) {
    const who = v.name || v.email || 'Someone';
    try {
      await sql`INSERT INTO ops_events (level, source, message) VALUES ('info', 'dataroom', ${`${who} signed in to the data room (${site})`.slice(0, 400)})`;
    } catch (err) {
      fail('visit_event', err);
    }
  }
  return { fresh };
}

function fmtDur(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Data room sessions (30-minute gap rule) for the last N days, newest first. */
export async function dataRoomSessions(sql: Sql, days = 14) {
  await ensureVisits(sql);
  const rows = (await sql`SELECT user_id, email, name, path, at FROM site_visits
    WHERE site = 'dataroom' AND user_id IS NOT NULL AND at > now() - (${days} || ' days')::interval ORDER BY user_id, at`) as Array<Record<string, unknown>>;
  const sessions: Array<{ who: string; email: string; start: number; end: number; pages: number }> = [];
  let cur: (typeof sessions)[0] | null = null;
  let curUser = '';
  for (const r of rows) {
    const t = new Date(String(r.at)).getTime();
    const u = String(r.user_id);
    if (!cur || u !== curUser || t - cur.end > 30 * 60000) {
      cur = { who: String(r.name || r.email || 'Visitor'), email: String(r.email || ''), start: t, end: t, pages: 0 };
      sessions.push(cur);
      curUser = u;
    }
    cur.end = t;
    cur.pages += 1;
  }
  sessions.sort((a, b) => b.start - a.start);
  const when = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
  return sessions.map((s) => ({ who: s.who, email: s.email, when: when(s.start), stayed: s.pages > 1 ? fmtDur(s.end - s.start) : 'one page', pages: s.pages, start: s.start, ms: s.end - s.start }));
}

export async function visitCounts(sql: Sql, days = 7) {
  await ensureVisits(sql);
  return (await sql`SELECT site, count(*)::int AS views, count(DISTINCT coalesce(user_id, visitor))::int AS people
    FROM site_visits WHERE at > now() - (${days} || ' days')::interval GROUP BY site ORDER BY site`) as Array<{ site: string; views: number; people: number }>;
}

/* Social: each one reads only when its keys are in Vercel. */
async function getJson(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<Record<string, unknown>>;
}

export async function socialCards() {
  const cards: Array<{ label: string; connected: boolean; value: string; note: string }> = [];
  const meta = process.env.META_ACCESS_TOKEN || '';
  const ig = process.env.INSTAGRAM_USER_ID || '';
  const fb = process.env.FACEBOOK_PAGE_ID || '';
  const li = process.env.LINKEDIN_ACCESS_TOKEN || '';
  const liOrg = process.env.LINKEDIN_ORG_ID || '';
  if (meta && ig) {
    try {
      const j = await getJson(`https://graph.facebook.com/v19.0/${encodeURIComponent(ig)}?fields=followers_count,media_count&access_token=${encodeURIComponent(meta)}`);
      cards.push({ label: 'INSTAGRAM', connected: true, value: `${Number(j.followers_count) || 0} followers`, note: `${Number(j.media_count) || 0} posts` });
    } catch (err) {
      fail('social_ig', err);
      cards.push({ label: 'INSTAGRAM', connected: false, value: '', note: 'Instagram did not answer. Check the Meta token.' });
    }
  } else cards.push({ label: 'INSTAGRAM', connected: false, value: '', note: 'Add META_ACCESS_TOKEN and INSTAGRAM_USER_ID in Vercel' });
  if (meta && fb) {
    try {
      const j = await getJson(`https://graph.facebook.com/v19.0/${encodeURIComponent(fb)}?fields=followers_count,fan_count&access_token=${encodeURIComponent(meta)}`);
      cards.push({ label: 'FACEBOOK', connected: true, value: `${Number(j.followers_count || j.fan_count) || 0} followers`, note: 'page' });
    } catch (err) {
      fail('social_fb', err);
      cards.push({ label: 'FACEBOOK', connected: false, value: '', note: 'Facebook did not answer. Check the Meta token.' });
    }
  } else cards.push({ label: 'FACEBOOK', connected: false, value: '', note: 'Add META_ACCESS_TOKEN and FACEBOOK_PAGE_ID in Vercel' });
  if (li && liOrg) {
    try {
      const j = await getJson(`https://api.linkedin.com/rest/networkSizes/urn:li:organization:${encodeURIComponent(liOrg)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`, {
        authorization: `Bearer ${li}`, 'LinkedIn-Version': '202409', 'X-Restli-Protocol-Version': '2.0.0',
      });
      cards.push({ label: 'LINKEDIN', connected: true, value: `${Number(j.firstDegreeSize) || 0} followers`, note: 'company page' });
    } catch (err) {
      fail('social_li', err);
      cards.push({ label: 'LINKEDIN', connected: false, value: '', note: 'LinkedIn did not answer. Check the token.' });
    }
  } else cards.push({ label: 'LINKEDIN', connected: false, value: '', note: 'Add LINKEDIN_ACCESS_TOKEN and LINKEDIN_ORG_ID in Vercel' });
  return cards;
}
