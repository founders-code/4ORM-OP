import { readFileSync } from 'fs';
import path from 'path';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;
type Named = { name?: string; url?: string };

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function load() {
  const raw = readFileSync(path.join(process.cwd(), 'data/ops_seed.json'), 'utf8');
  return JSON.parse(raw) as { regulators?: Named[]; vc_platforms?: Named[]; incumbents?: Named[]; vc_firms?: string[] };
}

async function has(sql: Sql, ownerId: string, source: string, sourceId: string) {
  const rows = await sql`
    SELECT id FROM items WHERE owner_id = ${ownerId} AND source = ${source} AND source_id = ${sourceId} LIMIT 1
  `;
  return rows.length > 0;
}

/** Regulators, VC platforms, incumbents, and Canadian firms. A bad row does not wipe the desk. */
export async function seedOps(sql: Sql, ownerId: string) {
  try {
    const data = load();
    const due = new Date(Date.now() + 2 * 86400000).toISOString();
    for (const body of data.regulators || []) {
      const name = String(body.name || '').trim().slice(0, 120);
      if (!name) continue;
      const sourceId = `reg-${slug(name)}`;
      try {
        const found = await sql`SELECT id FROM contacts WHERE owner_id = ${ownerId} AND source = 'ops_seed' AND source_id = ${sourceId} LIMIT 1`;
        if (!found.length) {
          await sql`
            INSERT INTO contacts (owner_id, name, company, source, source_id, type, tier, stage, category, notes)
            VALUES (${ownerId}, ${name}, ${name}, 'ops_seed', ${sourceId}, 'grant_reg', 'B', 'new', 'regulatory', ${'Reach out. Official site: ' + String(body.url || '').slice(0, 180)})
          `;
        }
        if (!(await has(sql, ownerId, 'ops_seed', sourceId))) {
          await sql`
            INSERT INTO items (owner_id, title, area, status, priority, due, source, source_id, category)
            VALUES (${ownerId}, ${'Reach out to ' + name}, 'outreach', 'new', 'normal', ${due}, 'ops_seed', ${sourceId}, 'Regulatory')
          `;
        }
      } catch (err) {
        fail('ops_seed_reg', err);
      }
    }
    for (const platform of data.vc_platforms || []) {
      const name = String(platform.name || '').trim().slice(0, 120);
      const url = String(platform.url || '').trim().slice(0, 300);
      if (!name || !url) continue;
      const sourceId = `plat-${slug(name)}`;
      try {
        if (!(await has(sql, ownerId, 'ops_seed', sourceId))) {
          await sql`
            INSERT INTO items (owner_id, title, area, status, priority, due, source, source_id, category)
            VALUES (${ownerId}, ${'Sign up for ' + name}, 'investors', 'new', 'normal', ${due}, 'ops_seed', ${sourceId}, 'Investors')
          `;
        }
        const link = await sql`SELECT id FROM links WHERE owner_id = ${ownerId} AND url = ${url} LIMIT 1`;
        if (!link.length) {
          await sql`
            INSERT INTO links (owner_id, title, url, category, sub)
            VALUES (${ownerId}, ${name}, ${url}, 'VC platforms', '')
          `;
        }
      } catch (err) {
        fail('ops_seed_plat', err);
      }
    }
    for (const firm of data.vc_firms || []) {
      const name = String(firm || '').trim().slice(0, 120);
      if (!name) continue;
      const sourceId = `vc-${slug(name)}`;
      try {
        const found = await sql`SELECT id FROM contacts WHERE owner_id = ${ownerId} AND source = 'ops_seed' AND source_id = ${sourceId} LIMIT 1`;
        if (found.length) continue;
        await sql`
          INSERT INTO contacts (owner_id, name, company, source, source_id, type, tier, stage, category, notes)
          VALUES (${ownerId}, ${name}, ${name}, 'ops_seed', ${sourceId}, 'vc', 'B', 'new', 'vc', 'Firm to reach. No conversation yet.')
        `;
      } catch (err) {
        fail('ops_seed_vc', err);
      }
    }
    const lines = (data.incumbents || []).map((row) => `${String(row.name || '').trim()} - ${String(row.url || '').trim()}`).filter(Boolean);
    if (lines.length) {
      try {
        const name = 'Top incumbents';
        const existing = await sql`SELECT id FROM staged_docs WHERE owner_id = ${ownerId} AND name = ${name} LIMIT 1`;
        if (!existing.length) {
          const body = Buffer.from(lines.join('\n'), 'utf8').toString('base64');
          await sql`
            INSERT INTO staged_docs (owner_id, category, name, mime, body_b64)
            VALUES (${ownerId}, 'Legal', ${name}, 'text/plain', ${body})
          `;
        }
      } catch (err) {
        fail('ops_seed_inc', err);
      }
    }
  } catch (err) {
    fail('ops_seed', err);
  }
}
