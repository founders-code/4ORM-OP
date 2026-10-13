import { readFileSync } from 'fs';
import path from 'path';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

function hyphen(value: unknown, max: number) {
  return String(value || '').replace(/\s*\u00b7\s*/g, ' - ').trim().slice(0, max);
}

/** Load the Facebook shortlist once per owner. A missing file or a bad row does not wipe contacts. */
export async function seedFacebook(sql: Sql, ownerId: string) {
  try {
    const existing = await sql`SELECT id FROM contacts WHERE owner_id = ${ownerId} AND source = 'facebook' LIMIT 1`;
    if (existing.length) return;
    const raw = readFileSync(path.join(process.cwd(), 'data/facebook_investors_seed.json'), 'utf8');
    const rows = JSON.parse(raw) as Array<Record<string, unknown>>;
    for (const person of rows) {
      const name = hyphen(person.name, 120);
      if (!name) continue;
      const sourceId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
      try {
        const already = await sql`
          SELECT id FROM contacts WHERE owner_id = ${ownerId} AND source = 'facebook' AND source_id = ${sourceId} LIMIT 1
        `;
        if (already.length) continue;
        await sql`
          INSERT INTO contacts (
            owner_id, name, role, notes, source, source_id, type, tier, stage, category,
            fb_tier, fb_ask, fb_status, mutuals, what_they_do, fb_why
          )
          VALUES (
            ${ownerId}, ${name}, ${hyphen(person.whatTheyDo, 120)}, ${hyphen(person.why, 500)},
            'facebook', ${sourceId}, 'other', 'B', 'new', 'facebook',
            ${hyphen(person.tier, 80)}, ${hyphen(person.ask, 180)}, ${hyphen(person.status, 20) || 'not_sent'},
            ${hyphen(person.mutuals, 20)}, ${hyphen(person.whatTheyDo, 240)}, ${hyphen(person.why, 500)}
          )
        `;
      } catch (err) {
        fail('facebook_row', err);
      }
    }
  } catch (err) {
    fail('facebook_seed', err);
  }
}
