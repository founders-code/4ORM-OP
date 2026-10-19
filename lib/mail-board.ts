import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import { inferContactCategory } from './guard.mjs';
import type { BoardMail } from './google';

type Sql = NeonQueryFunction<false, false>;

export const DEFAULT_COLUMNS = [
  { key: 'needs_now', name: 'Needs now', width: 280 },
  { key: 'investors', name: 'Investors', width: 280 },
  { key: 'vcs', name: 'VCs', width: 280 },
  { key: 'prospects', name: 'Prospects', width: 280 },
  { key: 'design', name: 'Design partners', width: 280 },
  { key: 'team', name: 'Team', width: 280 },
  { key: 'quiet', name: 'Quiet', width: 260 },
];

const MATCH = new Set(['sender', 'domain', 'subject', 'list']);
const KEY_RE = /^[a-z0-9_]{2,40}$/;

export async function ensureMailBoard(sql: Sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS email_columns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      key text NOT NULL,
      name text NOT NULL,
      position int NOT NULL DEFAULT 0,
      width int NOT NULL DEFAULT 280,
      collapsed boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, key)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS email_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      match_type text NOT NULL,
      match_value text NOT NULL,
      target_column text NOT NULL,
      sticky boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS email_file (
      owner_id text NOT NULL,
      message_id text NOT NULL,
      column_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, message_id)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS email_snooze (
      owner_id text NOT NULL,
      message_id text NOT NULL,
      until timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, message_id)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS mail_cache (
      owner_id text PRIMARY KEY,
      payload jsonb NOT NULL,
      fetched_at timestamptz NOT NULL DEFAULT now()
    )`;
  } catch (err) {
    fail('mail_board_tables', err);
  }
}

export async function seedColumns(sql: Sql, ownerId: string) {
  for (let i = 0; i < DEFAULT_COLUMNS.length; i += 1) {
    const col = DEFAULT_COLUMNS[i];
    try {
      await sql`
        INSERT INTO email_columns (owner_id, key, name, position, width)
        VALUES (${ownerId}, ${col.key}, ${col.name}, ${i}, ${col.width})
        ON CONFLICT (owner_id, key) DO NOTHING
      `;
    } catch (err) {
      fail('mail_col_seed', err);
    }
  }
}

export async function listColumns(sql: Sql, ownerId: string) {
  await seedColumns(sql, ownerId);
  try {
    const rows = await sql`
      SELECT id, key, name, position, width, collapsed
      FROM email_columns
      WHERE owner_id = ${ownerId}
      ORDER BY position, created_at
    `;
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      key: String(row.key),
      name: String(row.name),
      position: Number(row.position) || 0,
      width: Math.max(200, Math.min(560, Number(row.width) || 280)),
      collapsed: !!row.collapsed,
    }));
  } catch (err) {
    fail('mail_cols', err);
    return DEFAULT_COLUMNS.map((col, i) => ({ id: col.key, key: col.key, name: col.name, position: i, width: col.width, collapsed: false }));
  }
}

export async function listRules(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`
      SELECT id, match_type, match_value, target_column, sticky, created_at
      FROM email_rules
      WHERE owner_id = ${ownerId}
      ORDER BY created_at
    `;
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      matchType: String(row.match_type),
      matchValue: String(row.match_value),
      target: String(row.target_column),
      sticky: row.sticky !== false,
    }));
  } catch (err) {
    fail('mail_rules', err);
    return [];
  }
}

type ContactHit = { email: string; name: string; category: string; company: string };

export async function listContactHits(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`
      SELECT name, email, category, type, company, role
      FROM contacts
      WHERE owner_id = ${ownerId}
    `;
    return (rows as Array<Record<string, unknown>>).map((row) => {
      const email = String(row.email || '').toLowerCase();
      const blob = [row.company, row.role, row.name, row.category, row.type].map((v) => String(v || '')).join(' ');
      const category = String(row.category || inferContactCategory(blob) || '');
      return { email, name: String(row.name || ''), category, company: String(row.company || '') };
    }).filter((row) => row.email || row.name);
  } catch (err) {
    fail('mail_contacts', err);
    return [] as ContactHit[];
  }
}

function columnOfContact(category: string) {
  if (/vc|venture/i.test(category)) return 'vcs';
  if (/angel|friend/i.test(category)) return 'investors';
  if (/design/i.test(category)) return 'design';
  if (/partner/i.test(category)) return 'prospects';
  if (/regulator|grant|board|advisor/i.test(category)) return 'prospects';
  if (/business/i.test(category)) return 'prospects';
  return '';
}

function ruleHit(rule: { matchType: string; matchValue: string }, mail: BoardMail) {
  const value = String(rule.matchValue || '').trim().toLowerCase();
  if (!value) return false;
  if (rule.matchType === 'sender') {
    const email = String(mail.email || '').toLowerCase();
    const from = String(mail.from || '').toLowerCase();
    if (email === value || from === value) return true;
    if (value.endsWith('@')) return email.startsWith(value) || from.includes(value);
    return email.includes(value) || from.includes(value);
  }
  if (rule.matchType === 'domain') {
    const host = mail.email.split('@')[1] || '';
    const want = value.replace(/^@/, '');
    return host === want || host.endsWith('.' + want);
  }
  if (rule.matchType === 'subject') return String(mail.subject || '').toLowerCase().includes(value);
  if (rule.matchType === 'list') return mail.bulk && value === 'bulk';
  return false;
}

function investorMail(mail: BoardMail) {
  const blob = `${mail.email || ''} ${mail.from || ''} ${mail.subject || ''} ${mail.snippet || ''}`.toLowerCase();
  return /bruce@|don@|bruce fair|\bcheque\b|\bfriends.?and.?family\b/.test(blob);
}

const SEED_INVESTOR_RULES = [
  { matchType: 'sender', matchValue: 'bruce@', target: 'investors' },
  { matchType: 'sender', matchValue: 'don@', target: 'investors' },
  { matchType: 'subject', matchValue: 'cheque', target: 'investors' },
];

export async function seedInvestorRules(sql: Sql, ownerId: string) {
  const existing = await listRules(sql, ownerId);
  for (const seed of SEED_INVESTOR_RULES) {
    const hit = existing.some((row) =>
      row.matchType === seed.matchType &&
      String(row.matchValue || '').toLowerCase() === seed.matchValue &&
      row.target === seed.target
    );
    if (hit) continue;
    await saveRule(sql, ownerId, { matchType: seed.matchType, matchValue: seed.matchValue, target: seed.target, sticky: true });
  }
}

const ACTION_RE = /\b(sign|signature|docusign|agreement|contract|invoice|action required|approve|approval|deadline|due by|wire|cheque|check|follow[- ]up|please|can you|need you)\b/i;

export function classifyMail(
  mail: BoardMail,
  rules: Array<{ matchType: string; matchValue: string; target: string; sticky: boolean }>,
  files: Record<string, string>,
  contacts: ContactHit[],
) {
  if (files[mail.id]) return files[mail.id];
  for (const rule of rules) {
    if (ruleHit(rule, mail) && KEY_RE.test(rule.target)) return rule.target;
  }
  if (mail.bulk) return 'quiet';
  if (mail.internal) return 'team';
  if (investorMail(mail)) return 'investors';
  const hit = contacts.find((c) => (c.email && c.email === mail.email) || (c.name && c.name.toLowerCase() === String(mail.from || '').toLowerCase()));
  if (hit) {
    const col = columnOfContact(hit.category);
    if (col) return col;
  }
  return mail.unread || ACTION_RE.test((mail.subject || '') + ' ' + (mail.snippet || '')) ? 'needs_now' : 'prospects';
}

export function needsNow(mail: BoardMail, column: string) {
  if (column === 'quiet' || mail.bulk) return false;
  if (mail.unread) return true;
  return ACTION_RE.test((mail.subject || '') + ' ' + (mail.snippet || ''));
}

export function tagsFor(mail: BoardMail, column: string, contacts: ContactHit[]) {
  const tags: string[] = [];
  if (needsNow(mail, column)) tags.push('Needs reply');
  const hit = contacts.find((c) => c.email && c.email === mail.email);
  if (hit && /vc/i.test(hit.category)) tags.push('VC');
  else if (hit && /angel|friend/i.test(hit.category)) tags.push('Investor');
  else if (hit && hit.category) tags.push(hit.category);
  if (mail.outbound) tags.push('Sent');
  return tags.slice(0, 3);
}

export async function listFiles(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`SELECT message_id, column_key FROM email_file WHERE owner_id = ${ownerId}`;
    const map: Record<string, string> = {};
    (rows as Array<{ message_id?: string; column_key?: string }>).forEach((row) => {
      if (row.message_id && row.column_key) map[String(row.message_id)] = String(row.column_key);
    });
    return map;
  } catch (err) {
    fail('mail_files', err);
    return {} as Record<string, string>;
  }
}

export async function fileMessage(sql: Sql, ownerId: string, messageId: string, column: string) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(messageId) || !KEY_RE.test(column)) return false;
  try {
    await sql`
      INSERT INTO email_file (owner_id, message_id, column_key)
      VALUES (${ownerId}, ${messageId}, ${column})
      ON CONFLICT (owner_id, message_id) DO UPDATE SET column_key = EXCLUDED.column_key
    `;
    return true;
  } catch (err) {
    fail('mail_file', err);
    return false;
  }
}

export async function saveRule(sql: Sql, ownerId: string, input: { matchType: string; matchValue: string; target: string; sticky?: boolean }) {
  const matchType = MATCH.has(input.matchType) ? input.matchType : '';
  const matchValue = String(input.matchValue || '').trim().toLowerCase().slice(0, 180);
  const target = KEY_RE.test(input.target) ? input.target : '';
  if (!matchType || !matchValue || !target) return null;
  try {
    const rows = await sql`
      INSERT INTO email_rules (owner_id, match_type, match_value, target_column, sticky)
      VALUES (${ownerId}, ${matchType}, ${matchValue}, ${target}, ${input.sticky !== false})
      RETURNING id, match_type, match_value, target_column, sticky
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return { id: String(row.id), matchType: String(row.match_type), matchValue: String(row.match_value), target: String(row.target_column), sticky: row.sticky !== false };
  } catch (err) {
    fail('mail_rule_save', err);
    return null;
  }
}

export async function readCache(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`SELECT payload, fetched_at FROM mail_cache WHERE owner_id = ${ownerId} LIMIT 1`;
    const row = rows[0] as { payload?: unknown; fetched_at?: string } | undefined;
    if (!row) return null;
    const age = Date.now() - new Date(String(row.fetched_at || 0)).getTime();
    if (age > 3 * 60 * 1000) return { stale: true, payload: row.payload };
    return { stale: false, payload: row.payload };
  } catch (err) {
    fail('mail_cache_read', err);
    return null;
  }
}

export async function writeCache(sql: Sql, ownerId: string, payload: unknown) {
  try {
    const raw = JSON.stringify(payload);
    await sql`
      INSERT INTO mail_cache (owner_id, payload, fetched_at)
      VALUES (${ownerId}, ${raw}::jsonb, now())
      ON CONFLICT (owner_id) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()
    `;
  } catch (err) {
    fail('mail_cache_write', err);
  }
}

export function assistFor(thread: { from: string; subject: string; text: string; snippet: string }, contact: ContactHit | null) {
  const who = contact
    ? [contact.name, contact.company, contact.category].filter(Boolean).join(' - ')
    : (thread.from.split('<')[0].trim() || 'This sender is not in Contacts yet.');
  const blob = String(thread.text || thread.snippet || '').replace(/\s+/g, ' ').trim();
  const asking = blob.slice(0, 180) || thread.subject;
  const first = contact?.name ? contact.name.split(/\s+/)[0] : '';
  const reply = first
    ? `${first} -\n\nThanks for this. I will come back with a clear next step today.\n\nChad`
    : `Thanks for this. I will come back with a clear next step today.\n\nChad`;
  return { who, asking, reply };
}
