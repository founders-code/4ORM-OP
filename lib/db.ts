import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { CEILINGS, BUDGET_WINDOW_MS } from './guard.mjs';
import { rememberDatabaseUrl, savedDatabaseUrl } from './vault';

type Sql = NeonQueryFunction<false, false>;

let ready: Promise<Sql> | null = null;

export async function databaseUrl() {
  const envUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (envUrl) return envUrl;
  const saved = await savedDatabaseUrl();
  if (saved) rememberDatabaseUrl(saved);
  return saved;
}

async function migrate(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    title text NOT NULL,
    area text NOT NULL CHECK (area IN ('investors','outreach','legal','dev','send','follow_up','other')),
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','doing','waiting','done','dropped')),
    priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
    due timestamptz,
    snooze_until timestamptz,
    owner text,
    source text,
    source_id text,
    source_link text,
    notes text,
    tags text[],
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS items_owner_source_uq
    ON items (owner_id, source, source_id)
    WHERE source_id IS NOT NULL`;
  await sql`CREATE TABLE IF NOT EXISTS daily_brief (
    owner_id text NOT NULL,
    brief_date date NOT NULL,
    headline text,
    summary text,
    top_three jsonb,
    sources text[],
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, brief_date)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS link_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    name text NOT NULL,
    subs text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, name)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    category text,
    sub text,
    note text,
    tags text[],
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    name text NOT NULL,
    company text,
    role text,
    email text,
    phone text,
    area text,
    notes text,
    source text,
    source_id text,
    last_touch timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS contacts_owner_source_uq
    ON contacts (owner_id, source, source_id)
    WHERE source_id IS NOT NULL`;
  await sql`CREATE TABLE IF NOT EXISTS folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    parent_id uuid REFERENCES folders(id),
    name text NOT NULL,
    drive_file_id text,
    depth int NOT NULL CHECK (depth BETWEEN 1 AND 3),
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    folder_id uuid,
    name text NOT NULL,
    drive_file_id text,
    kind text,
    url text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS pipeline_stages (
    owner_id text NOT NULL,
    stage text NOT NULL,
    count int NOT NULL DEFAULT 0,
    detail text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, stage)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS sync_state (
    owner_id text NOT NULL,
    source text NOT NULL,
    status text NOT NULL,
    detail text,
    synced_at timestamptz,
    PRIMARY KEY (owner_id, source)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS drive_cache (
    owner_id text PRIMARY KEY,
    tree jsonb NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS calendar_cache (
    owner_id text PRIMARY KEY,
    events jsonb NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS room_owner (
    email text PRIMARY KEY,
    owner_id text NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS ingest_guard (
    owner_id text NOT NULL,
    window_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, window_key)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS vendor_budget (
    owner_id text NOT NULL,
    vendor text NOT NULL,
    window_start timestamptz NOT NULL,
    calls int NOT NULL DEFAULT 0,
    PRIMARY KEY (owner_id, vendor, window_start)
  )`;
}

export function resetSql() {
  ready = null;
}

export async function getSql(): Promise<Sql | null> {
  const url = await databaseUrl();
  if (!url) return null;
  if (!ready) {
    const sql = neon(url);
    ready = migrate(sql).then(() => sql);
  }
  try {
    return await ready;
  } catch {
    ready = null;
    return null;
  }
}

/** Reserves `weight` calls. Returns false when the window cannot hold them, and does not increment past the ceiling. */
export async function claimBudget(sql: Sql, ownerId: string, vendor: keyof typeof CEILINGS, weight = 1) {
  const ceiling = CEILINGS[vendor];
  if (weight < 1 || weight > ceiling) return false;
  const start = new Date(Math.floor(Date.now() / BUDGET_WINDOW_MS) * BUDGET_WINDOW_MS).toISOString();
  const rows = await sql`
    INSERT INTO vendor_budget (owner_id, vendor, window_start, calls)
    VALUES (${ownerId}, ${vendor}, ${start}, ${weight})
    ON CONFLICT (owner_id, vendor, window_start)
    DO UPDATE SET calls = vendor_budget.calls + ${weight}
    WHERE vendor_budget.calls + ${weight} <= ${ceiling}
    RETURNING calls
  `;
  return rows.length > 0;
}

export async function rememberOwner(sql: Sql, email: string, ownerId: string) {
  await sql`
    INSERT INTO room_owner (email, owner_id)
    VALUES (${email}, ${ownerId})
    ON CONFLICT (email) DO UPDATE SET owner_id = EXCLUDED.owner_id
  `;
}

export async function ownerForEmail(sql: Sql, email: string) {
  const rows = await sql`SELECT owner_id FROM room_owner WHERE email = ${email} LIMIT 1`;
  return (rows[0]?.owner_id as string | undefined) || null;
}
