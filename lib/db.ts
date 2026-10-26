import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { CEILINGS, BUDGET_WINDOW_MS } from './guard.mjs';
import { fail } from './log';
import { rememberDatabaseUrl, savedDatabaseUrl } from './vault';

type Sql = NeonQueryFunction<false, false>;

let ready: Promise<Sql> | null = null;

/** Bump when migrate() gains a new step so cold starts skip the full IF NOT EXISTS pass. */
const SCHEMA_VERSION = '2026-10-26-notes-canvas-spaces-arrange';

export async function databaseUrl() {
  const envUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (envUrl) return envUrl;
  const saved = await savedDatabaseUrl();
  if (saved) rememberDatabaseUrl(saved);
  return saved;
}

async function migrate(sql: Sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS schema_meta (
      key text PRIMARY KEY,
      value text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
    const rows = await sql`SELECT value FROM schema_meta WHERE key = 'version' LIMIT 1`;
    if (String(rows[0]?.value || '') === SCHEMA_VERSION) return;
  } catch (err) {
    fail('db_schema_meta', err);
  }

  await sql`CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    title text NOT NULL,
    area text NOT NULL CHECK (area IN ('investors','outreach','legal','dev','send','follow_up','other')),
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','doing','waiting','done','dropped','open')),
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
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'`;
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS category text`;
  await sql`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'items'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE items DROP CONSTRAINT %I', r.conname);
      END LOOP;
      ALTER TABLE items ADD CONSTRAINT items_status_check CHECK (status IN ('new','doing','waiting','done','dropped','open'));
    END $$
  `;
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
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type text DEFAULT 'other'`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tier text DEFAULT 'B'`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS stage text DEFAULT 'new'`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_action text`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_date timestamptz`;
  await sql`UPDATE contacts SET type = 'other' WHERE type IS NULL`;
  await sql`UPDATE contacts SET tier = 'B' WHERE tier IS NULL`;
  await sql`UPDATE contacts SET stage = 'new' WHERE stage IS NULL OR stage = ''`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE contacts ADD CONSTRAINT contacts_type_check CHECK (type IN ('vc','business','grant_reg','other'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      ALTER TABLE contacts ADD CONSTRAINT contacts_tier_check CHECK (tier IN ('A','B','C'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
  await sql`CREATE TABLE IF NOT EXISTS owner_settings (
    owner_id text PRIMARY KEY,
    runway_weeks int
  )`;
  await sql`ALTER TABLE owner_settings ADD COLUMN IF NOT EXISTS zoom_seed_version text`;
  await sql`CREATE TABLE IF NOT EXISTS note_cats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    name text NOT NULL,
    parent_id uuid REFERENCES note_cats(id) ON DELETE CASCADE,
    depth int NOT NULL CHECK (depth BETWEEN 0 AND 2),
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    cat_id uuid REFERENCES note_cats(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text,
    color text NOT NULL DEFAULT 'yellow',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS zoom_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    note_id text NOT NULL,
    note_date date,
    title text NOT NULL,
    attendees jsonb NOT NULL DEFAULT '[]',
    summary jsonb NOT NULL DEFAULT '[]',
    stats jsonb NOT NULL DEFAULT '[]',
    sources jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, note_id)
  )`;
  await sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS solo boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS others jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS intel jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS improve jsonb NOT NULL DEFAULT '[]'::jsonb`;
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
  await sql`ALTER TABLE calendar_cache ADD COLUMN IF NOT EXISTS window_end timestamptz`;
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
  await sql`CREATE TABLE IF NOT EXISTS ceo_moves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    rank int NOT NULL CHECK (rank BETWEEN 1 AND 3),
    text text NOT NULL,
    principle text NOT NULL,
    why_now text,
    area text,
    suggested_due timestamptz,
    status text NOT NULL DEFAULT 'open',
    snooze_until timestamptz,
    source_key text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE ceo_moves ADD COLUMN IF NOT EXISTS source_key text`;
  await sql`ALTER TABLE ceo_moves ADD COLUMN IF NOT EXISTS how jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE ceo_moves ADD COLUMN IF NOT EXISTS source_line text`;
  await sql`CREATE TABLE IF NOT EXISTS inbox_hidden (
    owner_id text NOT NULL,
    email text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, email)
  )`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE ceo_moves ADD CONSTRAINT ceo_moves_status_check CHECK (status IN ('open','done','snoozed'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
  await sql`CREATE TABLE IF NOT EXISTS ceo_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    move_id uuid,
    context text,
    options text,
    evidence text,
    case_against text,
    decision text,
    owner text,
    review_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS ceo_lamps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    key text NOT NULL,
    state text NOT NULL,
    label text,
    detail text,
    computed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, key)
  )`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE ceo_lamps ADD CONSTRAINT ceo_lamps_state_check CHECK (state IN ('green','amber','red','unknown'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
  await sql`CREATE TABLE IF NOT EXISTS plugins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    info text,
    connected boolean NOT NULL DEFAULT false,
    status text,
    credential text,
    color text,
    ic text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, slug)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS ceo_weights (
    owner_id text NOT NULL,
    key text NOT NULL,
    boost int NOT NULL,
    PRIMARY KEY (owner_id, key)
  )`;
  await migrateWar(sql);
  try {
    await sql`
      INSERT INTO schema_meta (key, value) VALUES ('version', ${SCHEMA_VERSION})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, applied_at = now()
    `;
  } catch (err) {
    fail('db_schema_meta_write', err);
  }
}

/** New War Room tables. A failure here is logged and skipped so the rest of the desk still opens. */
async function migrateWar(sql: Sql) {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['db_inbox_cache', () => sql`CREATE TABLE IF NOT EXISTS inbox_cache (
      owner_id text PRIMARY KEY,
      messages jsonb NOT NULL DEFAULT '[]'::jsonb,
      linkedin jsonb NOT NULL DEFAULT '[]'::jsonb,
      fetched_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_pipeline_cache', () => sql`CREATE TABLE IF NOT EXISTS pipeline_cache (
      owner_id text PRIMARY KEY,
      pipelines jsonb NOT NULL DEFAULT '[]'::jsonb,
      stages jsonb NOT NULL DEFAULT '[]'::jsonb,
      fetched_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_change_log', () => sql`CREATE TABLE IF NOT EXISTS change_log (
      id bigserial PRIMARY KEY,
      owner_id text NOT NULL,
      kind text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_change_log_idx', () => sql`CREATE INDEX IF NOT EXISTS change_log_owner_id_idx ON change_log (owner_id, id DESC)`],
    ['db_watch_channels', () => sql`CREATE TABLE IF NOT EXISTS watch_channels (
      owner_id text NOT NULL,
      source text NOT NULL,
      channel_id text,
      resource_id text,
      token text,
      expiration timestamptz,
      history_id text,
      extra jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (owner_id, source)
    )`],
    ['db_waiting_on', () => sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS waiting_on text`],
    ['db_plan_of', () => sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS plan_of text`],
    ['db_news_categories', () => sql`ALTER TABLE owner_settings ADD COLUMN IF NOT EXISTS news_categories jsonb`],
    ['db_item_plans', () => sql`CREATE TABLE IF NOT EXISTS item_plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      item_id text NOT NULL,
      steps jsonb NOT NULL DEFAULT '[]',
      needs jsonb NOT NULL DEFAULT '[]',
      draft text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, item_id)
    )`],
    ['db_commitments', () => sql`CREATE TABLE IF NOT EXISTS commitments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      text text NOT NULL,
      source_note_id text NOT NULL DEFAULT '',
      made_on date,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, source_note_id, text)
    )`],
    ['db_commitments_check', () => sql`
      DO $$ BEGIN
        ALTER TABLE commitments ADD CONSTRAINT commitments_status_check CHECK (status IN ('open','done','decked'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `],
    ['db_resolved_waiting', () => sql`CREATE TABLE IF NOT EXISTS resolved_waiting (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      source_key text NOT NULL,
      resolved_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, source_key)
    )`],
    ['db_move_snooze', () => sql`CREATE TABLE IF NOT EXISTS move_snooze (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      move_key text NOT NULL,
      snoozed_on date NOT NULL,
      UNIQUE (owner_id, move_key, snoozed_on)
    )`],
    ['db_contact_category', () => sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category text`],
    ['db_contact_category_fill', () => sql`
      UPDATE contacts
      SET category = CASE
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(investor|capital|ventures|[^a-z]vc[^a-z]|^vc[^a-z]|[^a-z]vc$)' THEN 'vc'
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(law|llp|fasken|counsel)' THEN 'regulator'
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(century 21|remax|broker)' THEN 'business'
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(grant|sr&ed|alberta innovates)' THEN 'grant'
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ 'board' THEN 'board'
        WHEN type = 'vc' THEN 'vc'
        WHEN type = 'business' THEN 'business'
        WHEN type = 'grant_reg' THEN 'grant'
        ELSE 'other'
      END
      WHERE category IS NULL OR category = ''
    `],
    ['db_packages', () => sql`CREATE TABLE IF NOT EXISTS packages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL,
      kind text NOT NULL,
      drive_folder_id text,
      drive_folder_url text,
      email_subject text,
      email_body text,
      research text,
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_packages_kind', () => sql`
      DO $$ BEGIN
        ALTER TABLE packages ADD CONSTRAINT packages_kind_check CHECK (kind IN ('data_room','investor','partner','regulator'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `],
    ['db_packages_status', () => sql`
      DO $$ BEGIN
        ALTER TABLE packages ADD CONSTRAINT packages_status_check CHECK (status IN ('draft','ready','sent'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `],
    ['db_package_docs', () => sql`CREATE TABLE IF NOT EXISTS package_docs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      drive_file_id text,
      name text NOT NULL,
      url text,
      mime text
    )`],
    ['db_packages_space_type', () => sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS space_type text`],
    ['db_packages_subject_contact', () => sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS subject_contact_id text`],
    ['db_packages_subject_label', () => sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS subject_label text`],
    ['db_packages_pushed', () => sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS pushed_to_drive_at timestamptz`],
    ['db_package_docs_uploaded', () => sql`ALTER TABLE package_docs ADD COLUMN IF NOT EXISTS uploaded boolean NOT NULL DEFAULT false`],
    ['db_package_docs_thumb', () => sql`ALTER TABLE package_docs ADD COLUMN IF NOT EXISTS thumb_url text`],
    ['db_package_docs_folder', () => sql`ALTER TABLE package_docs ADD COLUMN IF NOT EXISTS folder_id uuid`],
    ['db_package_docs_uploaded_at', () => sql`ALTER TABLE package_docs ADD COLUMN IF NOT EXISTS uploaded_at timestamptz`],
    ['db_package_docs_body', () => sql`ALTER TABLE package_docs ADD COLUMN IF NOT EXISTS body_b64 text`],
    ['db_space_folders', () => sql`CREATE TABLE IF NOT EXISTS space_folders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      parent_id uuid,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_package_recipients', () => sql`CREATE TABLE IF NOT EXISTS package_recipients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      contact_id text,
      name text NOT NULL,
      email text,
      role text
    )`],
    ['db_contact_fb_tier', () => sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fb_tier text`],
    ['db_contact_fb_ask', () => sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fb_ask text`],
    ['db_contact_fb_status', () => sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fb_status text`],
    ['db_contact_mutuals', () => sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mutuals text`],
    ['db_contact_what', () => sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS what_they_do text`],
    ['db_contact_why', () => sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fb_why text`],
    ['db_packages_description', () => sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS description text`],
    ['db_packages_space_category', () => sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS space_category text`],
    ['db_sticky_notes', () => sql`CREATE TABLE IF NOT EXISTS sticky_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      body text NOT NULL DEFAULT '',
      color text NOT NULL DEFAULT 'yellow',
      x int NOT NULL DEFAULT 24,
      y int NOT NULL DEFAULT 24,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_sticky_w', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS w int NOT NULL DEFAULT 180`],
    ['db_sticky_h', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS h int NOT NULL DEFAULT 120`],
    ['db_sticky_meta', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb`],
    ['db_vc_inbox', () => sql`CREATE TABLE IF NOT EXISTS vc_inbox (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL,
      note text,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_staged_docs', () => sql`CREATE TABLE IF NOT EXISTS staged_docs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      category text NOT NULL,
      name text NOT NULL,
      url text,
      drive_file_id text,
      mime text,
      thumb_url text,
      body_b64 text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_staged_body', () => sql`ALTER TABLE staged_docs ADD COLUMN IF NOT EXISTS body_b64 text`],
    ['db_space_files', () => sql`CREATE TABLE IF NOT EXISTS space_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      space_id uuid NOT NULL,
      folder_id uuid,
      name text NOT NULL DEFAULT '',
      url text,
      mime text,
      kind text,
      body text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_space_recipients', () => sql`CREATE TABLE IF NOT EXISTS space_recipients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      space_id uuid NOT NULL,
      contact_id text,
      name text NOT NULL DEFAULT '',
      email text,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_contact_recat', () => sql`
      UPDATE contacts
      SET category = CASE
        WHEN source = 'facebook' THEN 'facebook'
        WHEN category = 'personal' THEN 'personal'
        WHEN category = 'regulatory' OR category = 'regulator' THEN category
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(angel|syndicate)' THEN 'angel'
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(investor|capital|ventures|fund|[^a-z]vc[^a-z]|^vc[^a-z]|[^a-z]vc$)' THEN 'vc'
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(fintrac|osfi|fcac|rpaa|regulator|securities|reca|competition bureau)' THEN 'regulatory'
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(law|llp|fasken|counsel)' THEN 'regulator'
        WHEN lower(coalesce(company, '') || ' ' || coalesce(role, '') || ' ' || coalesce(name, '')) ~ '(grant|sr&ed|alberta innovates|innovate|irap|nserc|ministry|government)' THEN 'grant'
        WHEN email IS NOT NULL AND email <> '' THEN 'business'
        WHEN type = 'vc' THEN 'vc'
        WHEN type = 'business' THEN 'business'
        WHEN type = 'grant_reg' THEN 'grant'
        ELSE 'business'
      END
      WHERE category IS NULL OR category = '' OR category = 'other'
    `],
    ['db_news_items', () => sql`CREATE TABLE IF NOT EXISTS news_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      category text NOT NULL,
      title text NOT NULL,
      summary text,
      url text,
      published_at timestamptz,
      is_top boolean NOT NULL DEFAULT false,
      swept_on date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_news_url', () => sql`CREATE UNIQUE INDEX IF NOT EXISTS news_owner_url_uq ON news_items (owner_id, url) WHERE url <> ''`],
    ['db_news_image', () => sql`ALTER TABLE news_items ADD COLUMN IF NOT EXISTS image_url text`],
    ['db_news_why', () => sql`ALTER TABLE news_items ADD COLUMN IF NOT EXISTS why_it_matters text`],
    ['db_news_source', () => sql`ALTER TABLE news_items ADD COLUMN IF NOT EXISTS source text`],
    ['db_news_impact', () => sql`ALTER TABLE news_items ADD COLUMN IF NOT EXISTS impact text`],
    ['db_news_hidden', () => sql`ALTER TABLE news_items ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`],
    ['db_news_hidden_reason', () => sql`ALTER TABLE news_items ADD COLUMN IF NOT EXISTS hidden_reason text`],
    ['db_news_images', () => sql`CREATE TABLE IF NOT EXISTS news_images (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      source_url text NOT NULL,
      mime text NOT NULL,
      data bytea NOT NULL,
      bytes integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, source_url)
    )`],
    ['db_doc_folders', () => sql`CREATE TABLE IF NOT EXISTS doc_folders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, name)
    )`],
    ['db_spaces', () => sql`CREATE TABLE IF NOT EXISTS spaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL DEFAULT 'Untitled space',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      drive_folder_id text,
      pushed_to_drive_at timestamptz
    )`],
    ['db_spaces_kind', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'data_room'`],
    ['db_spaces_notes', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS notes text`],
    ['db_spaces_category', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS category text`],
    ['db_spaces_drive_url', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS drive_folder_url text`],
    ['db_space_items', () => sql`CREATE TABLE IF NOT EXISTS space_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      space_id uuid NOT NULL,
      owner_id text NOT NULL,
      kind text NOT NULL DEFAULT 'file',
      name text NOT NULL DEFAULT '',
      url text,
      mime text,
      drive_file_id text,
      thumb_url text,
      body text,
      parent_id uuid,
      position int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_space_email', () => sql`CREATE TABLE IF NOT EXISTS space_email (
      space_id uuid PRIMARY KEY,
      owner_id text NOT NULL,
      subject text,
      body text
    )`],
    ['db_space_recipients_role', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS role text`],
    ['db_space_recipients_listed', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT true`],
    ['db_reach_out', () => sql`CREATE TABLE IF NOT EXISTS reach_out (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      contact_id text,
      name text NOT NULL DEFAULT '',
      company text,
      kind text NOT NULL DEFAULT 'corporate',
      next_action text,
      done boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_link_nest', () => sql`ALTER TABLE link_categories ADD COLUMN IF NOT EXISTS nest jsonb`],
    ['db_link_leaf', () => sql`ALTER TABLE links ADD COLUMN IF NOT EXISTS leaf text`],
    ['db_spaces_stage', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS stage text`],
    ['db_spaces_sent', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS sent_at timestamptz`],
    ['db_spaces_ghl', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS ghl_opportunity_id text`],
    ['db_spaces_angle', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS angle text`],
    ['db_space_recipients_send', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS send_status text`],
    ['db_email_columns', () => sql`CREATE TABLE IF NOT EXISTS email_columns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      key text NOT NULL,
      name text NOT NULL,
      position int NOT NULL DEFAULT 0,
      width int NOT NULL DEFAULT 280,
      collapsed boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, key)
    )`],
    ['db_email_boxes', () => sql`CREATE TABLE IF NOT EXISTS email_boxes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      key text NOT NULL,
      name text NOT NULL,
      org text NOT NULL DEFAULT '',
      color text NOT NULL DEFAULT '#2e6bf2',
      closed boolean NOT NULL DEFAULT false,
      position int NOT NULL DEFAULT 0,
      extra jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, key)
    )`],
    ['db_email_box_addresses', () => sql`CREATE TABLE IF NOT EXISTS email_box_addresses (
      owner_id text NOT NULL,
      box_key text NOT NULL,
      email text NOT NULL,
      PRIMARY KEY (owner_id, box_key, email)
    )`],
    ['db_email_box_tags', () => sql`CREATE TABLE IF NOT EXISTS email_box_tags (
      owner_id text NOT NULL,
      box_key text NOT NULL,
      tag text NOT NULL,
      PRIMARY KEY (owner_id, box_key, tag)
    )`],
    ['db_email_rules', () => sql`CREATE TABLE IF NOT EXISTS email_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      match_type text NOT NULL,
      match_value text NOT NULL,
      target_column text NOT NULL,
      sticky boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_email_file', () => sql`CREATE TABLE IF NOT EXISTS email_file (
      owner_id text NOT NULL,
      message_id text NOT NULL,
      column_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, message_id)
    )`],
    ['db_email_snooze', () => sql`CREATE TABLE IF NOT EXISTS email_snooze (
      owner_id text NOT NULL,
      message_id text NOT NULL,
      until timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, message_id)
    )`],
    ['db_mail_cache', () => sql`CREATE TABLE IF NOT EXISTS mail_cache (
      owner_id text PRIMARY KEY,
      payload jsonb NOT NULL,
      fetched_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_daily_snapshots', () => sql`CREATE TABLE IF NOT EXISTS daily_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      snap_date date NOT NULL,
      summary text NOT NULL DEFAULT '',
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, snap_date)
    )`],
    ['db_ceo_moves_updated', () => sql`ALTER TABLE ceo_moves ADD COLUMN IF NOT EXISTS updated_at timestamptz`],
    ['db_finance_code', () => sql`ALTER TABLE owner_settings ADD COLUMN IF NOT EXISTS finance_code text`],
    ['db_playbook_rhythms', () => sql`CREATE TABLE IF NOT EXISTS playbook_rhythms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL,
      color text NOT NULL DEFAULT '#1f5fff',
      route text NOT NULL DEFAULT 'war',
      schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
      target text,
      sort int NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, name)
    )`],
    ['db_playbook_rhythms_sub', () => sql`ALTER TABLE playbook_rhythms ADD COLUMN IF NOT EXISTS sub text`],
    ['db_playbook_rhythms_grp', () => sql`ALTER TABLE playbook_rhythms ADD COLUMN IF NOT EXISTS grp text`],
    ['db_playbook_log', () => sql`CREATE TABLE IF NOT EXISTS playbook_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      rhythm_id uuid NOT NULL,
      day date NOT NULL,
      status text NOT NULL DEFAULT 'done',
      value text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, rhythm_id, day)
    )`],
    ['db_notes_pinned', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false`],
    ['db_link_cat_pos', () => sql`ALTER TABLE link_categories ADD COLUMN IF NOT EXISTS position int NOT NULL DEFAULT 0`],
    ['db_deleted_at_notes', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_links', () => sql`ALTER TABLE links ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    // Links archived by the old client carry note '__archived__' and no deleted_at: turn them into real soft deletes.
    ['db_links_archived_sentinel', () => sql`UPDATE links SET deleted_at = coalesce(deleted_at, now()), note = '' WHERE note = '__archived__'`],
    ['db_deleted_at_contacts', () => sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_packages', () => sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_documents', () => sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_meeting', () => sql`ALTER TABLE meeting_actions ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_boxes', () => sql`ALTER TABLE email_boxes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_dedupe_log', () => sql`CREATE TABLE IF NOT EXISTS dedupe_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      table_name text NOT NULL,
      kept_id text NOT NULL,
      removed_id text NOT NULL,
      dup_key text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_bookings', () => sql`CREATE TABLE IF NOT EXISTS bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL,
      email text NOT NULL,
      topics text,
      notes text,
      start_at timestamptz NOT NULL,
      end_at timestamptz NOT NULL,
      tz text,
      zoom_url text,
      gcal_event_id text,
      status text NOT NULL DEFAULT 'booked',
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    // 2026-10-27: soft delete everywhere a user can delete. Additive, safe to run twice.
    ['db_deleted_at_items', () => sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_sticky', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_zoom_notes', () => sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_note_cats', () => sql`ALTER TABLE note_cats ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_spaces', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_space_items', () => sql`ALTER TABLE space_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_space_recipients', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_package_docs', () => sql`ALTER TABLE package_docs ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_package_recipients', () => sql`ALTER TABLE package_recipients ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_space_folders', () => sql`ALTER TABLE space_folders ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_email_rules', () => sql`ALTER TABLE email_rules ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_deleted_at_email_columns', () => sql`ALTER TABLE email_columns ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    // From-Zoom War Room cards can be moved between Today / Week / Later.
    ['db_meeting_board_column', () => sql`ALTER TABLE meeting_actions ADD COLUMN IF NOT EXISTS board_column text`],
    // Fixed-window rate limits (lib/rate-limit.ts). Keys are sha256 hashes, never raw IPs.
    ['db_rate_limits', () => sql`CREATE TABLE IF NOT EXISTS rate_limits (
      key_hash text NOT NULL,
      window_start timestamptz NOT NULL,
      hits int NOT NULL DEFAULT 0,
      PRIMARY KEY (key_hash, window_start)
    )`],
    // The dedupe sweep's items_owner_title_live_uq also covered done rows, so a new task could not reuse a
    // finished task's title. Replace it with an index over live rows only.
    ['db_items_title_live_uq_drop', () => sql`DROP INDEX IF EXISTS items_owner_title_live_uq`],
    ['db_items_title_open_uq', () => sql`CREATE UNIQUE INDEX IF NOT EXISTS items_owner_title_open_uq
      ON items (owner_id, lower(trim(title)))
      WHERE status IN ('new', 'doing', 'waiting', 'open') AND deleted_at IS NULL AND trim(title) <> ''`],
    // Round 2 (documents): soft delete for library files, sets of documents, and chunked Drive upload sessions.
    ['db_r2_staged_deleted', () => sql`ALTER TABLE staged_docs ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_r2_doc_sets', () => sql`CREATE TABLE IF NOT EXISTS doc_sets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL,
      doc_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      position int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    )`],
    ['db_r2_doc_uploads', () => sql`CREATE TABLE IF NOT EXISTS doc_uploads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      session_url text NOT NULL,
      name text NOT NULL,
      mime text,
      size bigint NOT NULL DEFAULT 0,
      category text,
      done boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    // Round 2 (links, spaces): soft-deleted link categories keep an undo snapshot; Space next steps are saved on the server.
    ['db_r2_link_cat_deleted', () => sql`ALTER TABLE link_categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_r2_link_cat_undo', () => sql`ALTER TABLE link_categories ADD COLUMN IF NOT EXISTS undo jsonb`],
    ['db_r2_spaces_steps', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS steps jsonb`],
    // Round 2 (War Room): W39 Today drag order, W25 undo for a dismissed move (snooze marker kept, marked cleared).
    ['db_r2_items_position', () => sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS position int`],
    ['db_r2_move_snooze_cleared', () => sql`ALTER TABLE move_snooze ADD COLUMN IF NOT EXISTS cleared_at timestamptz`],
    // Round 3 (backend): the last hard deletes become soft (undone / removed flags), plus the Spaces send gate.
    ['db_r3_doc_folders_deleted', () => sql`ALTER TABLE doc_folders ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_r3_playbook_log_deleted', () => sql`ALTER TABLE playbook_log ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_r3_inbox_hidden_deleted', () => sql`ALTER TABLE inbox_hidden ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_r3_box_tags_deleted', () => sql`ALTER TABLE email_box_tags ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_r3_box_addresses_deleted', () => sql`ALTER TABLE email_box_addresses ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_r3_space_test_sends', () => sql`CREATE TABLE IF NOT EXISTS space_test_sends (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      space_id uuid NOT NULL,
      content_hash text NOT NULL,
      sent_to text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_r3_space_test_sends_idx', () => sql`CREATE INDEX IF NOT EXISTS space_test_sends_lookup
      ON space_test_sends (owner_id, space_id, content_hash)`],
    ['db_note_clusters', () => sql`CREATE TABLE IF NOT EXISTS note_clusters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL DEFAULT 'New cluster',
      color text NOT NULL DEFAULT '#2e6bf2',
      x int NOT NULL DEFAULT 120,
      y int NOT NULL DEFAULT 120,
      w int NOT NULL DEFAULT 500,
      h int NOT NULL DEFAULT 300,
      position int NOT NULL DEFAULT 0,
      deleted_at timestamptz
    )`],
    ['db_notes_canvas_x', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS canvas_x int`],
    ['db_notes_canvas_y', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS canvas_y int`],
    ['db_notes_cluster_id', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS cluster_id uuid`],
    ['db_sticky_canvas_x', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS canvas_x int`],
    ['db_sticky_canvas_y', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS canvas_y int`],
    ['db_sticky_cluster_id', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS cluster_id uuid`],
    ['db_spaces_position', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS position int NOT NULL DEFAULT 0`],
    ['db_space_groups', () => sql`CREATE TABLE IF NOT EXISTS space_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL,
      position int NOT NULL DEFAULT 0,
      collapsed boolean NOT NULL DEFAULT false,
      deleted_at timestamptz
    )`],
    ['db_space_groups_name', () => sql`CREATE UNIQUE INDEX IF NOT EXISTS space_groups_owner_name
      ON space_groups (owner_id, lower(name)) WHERE deleted_at IS NULL`],
  ];
  for (const [code, run] of steps) {
    try {
      await run();
    } catch (err) {
      fail(code, err);
    }
  }
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
  } catch (err) {
    fail('db_init', err);
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

/** Postgres unique_violation (23505), optionally on one named index or constraint. */
export function isUniqueViolation(err: unknown, constraint?: string) {
  const e = err as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && (!constraint || e.constraint === constraint);
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
