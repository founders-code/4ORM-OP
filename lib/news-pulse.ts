import type { Sql } from './db';
import { outbound } from './outbound';

const REGS = ['FINTRAC', 'OSFI', 'FSRA', 'BCFSA', 'CSA', 'AMF', 'FCAC', 'CIRO', 'Bank of Canada'];
const FIN_RULE = /fintrac|osfi|fsra|bcfsa|\bcsa\b|amf|fcac|ciro|bank of canada|securities commission|insurance regulator|mortgage broker|consumer.?finance|payments? act|pipeda|aml|kyc|suitability|know.?your.?client/i;
const MARKET_GAUGES = [
  { k: 'reg', t: 'Regulation heat', chip: 'Compliance', cats: ['Compliance', 'Payments / FINTRAC'] },
  { k: 'fraud', t: 'Fraud heat', chip: 'Fraud', cats: ['Fraud'] },
  { k: 'ai', t: 'AI and governance heat', chip: 'AI & governance', cats: ['AI & governance', 'AI & governance'] },
  { k: 'mtg', t: 'Mortgage market heat', chip: 'Mortgage / brokerage', cats: ['Mortgage / brokerage', 'Housing market'] },
];
const CONSUMER_GAUGES = [
  { k: 'fear', t: 'Consumer fear index', chip: 'Housing market', cats: ['Housing market'] },
  { k: 'unc', t: 'Uncertainty index', chip: 'Housing market', cats: ['Housing market', 'Competitors'] },
  { k: 'cmp', t: 'Complaints heat', chip: 'Compliance', cats: ['Compliance'] },
  { k: 'scam', t: 'Scam reports', chip: 'Fraud', cats: ['Fraud'] },
];
const FEAR_THEMES = [
  { n: 'Renewals and payments', re: /renew|payment shock|mortgage payment/i },
  { n: 'Scams and fraud', re: /scam|fraud|impersonat/i },
  { n: 'Jobs and income', re: /job|layoff|income|unemploy/i },
  { n: 'Trade and tariffs', re: /tariff|trade|duties/i },
  { n: 'Home prices', re: /home price|housing market|house price/i },
];
const VALET: { k: string; series: string; pct?: boolean }[] = [
  { k: 'Bank of Canada rate', series: 'V39079', pct: true },
  { k: '5-year Canada bond', series: 'BD.CDN.5YR.DQ.YLD', pct: true },
  { k: 'Prime rate', series: 'V80691335', pct: true },
  { k: 'CAD per USD', series: 'FXUSDCAD' },
];

type Item = {
  title?: string;
  url?: string;
  source?: string;
  category?: string;
  impact?: string;
  published_at?: string | Date;
  is_top?: boolean;
  why_it_matters?: string;
  summary?: string;
  image_url?: string;
};

const WEEK_MS = 7 * 24 * 3600 * 1000;
const PULSE_HOURS = [6, 10, 14, 18];

function rollingWindows(count: number, endAt: number) {
  const out: { start: number; end: number }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    out.push({ start: endAt - (i + 1) * WEEK_MS, end: endAt - i * WEEK_MS });
  }
  return out;
}

function vancouverParts(d: Date) {
  const hit: Record<string, string> = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Vancouver',
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
    hourCycle: 'h23',
  }).formatToParts(d).forEach((p) => { hit[p.type] = p.value; });
  return hit;
}

export function vancouverHour(d = new Date()) {
  return Number(vancouverParts(d).hour || '0');
}

export function isPulseHour(d = new Date()) {
  return PULSE_HOURS.includes(vancouverHour(d));
}

export function formatPulseClock(d = new Date()) {
  const p = vancouverParts(d);
  return `${p.hour || '00'}:${p.minute || '00'}`;
}

export function nextPulseAt(from = new Date()) {
  const start = from.getTime();
  for (let h = 1; h <= 48; h += 1) {
    const t = new Date(start + h * 3600 * 1000);
    t.setUTCMinutes(0, 0, 0);
    if (t.getTime() <= start) continue;
    if (PULSE_HOURS.includes(vancouverHour(t))) return t.toISOString();
  }
  return new Date(start + 6 * 3600 * 1000).toISOString();
}

function weekLabel(start: number, last: boolean) {
  if (last) return 'Now';
  const p = vancouverParts(new Date(start));
  return `${p.day || ''} ${p.month || ''}`.trim();
}

function weight(it: Item) {
  const blob = `${it.title || ''} ${it.source || ''} ${it.impact || ''}`;
  if (/penalty|fine|enforcement|own release|bulletin/i.test(blob) && /fintrac|osfi|fsra|bcfsa|csa|amf|fcac|ciro/i.test(blob)) return 3;
  if (it.impact === 'Regulatory') return 3;
  return 1;
}

function inCat(it: Item, cats: string[]) {
  const c = String(it.category || '');
  return cats.some((x) => c.toLowerCase() === x.toLowerCase() || c.toLowerCase().includes(x.toLowerCase().split(' / ')[0]));
}

function windowWeight(items: Item[], cats: string[], start: number, end: number) {
  return items.filter((it) => {
    const t = new Date(it.published_at || 0).getTime();
    return t >= start && t < end && inCat(it, cats);
  }).reduce((a, it) => a + weight(it), 0);
}

/* A normal week reads 50. Busier weeks climb on a soft curve (2x normal = 75, 3x = 88,
   4x = 94) so one heavy week no longer pins a gauge at 100. */
function scaled(n: number, median: number) {
  const ratio = Math.max(0, n / (median || 1));
  return Math.max(0, Math.min(99, Math.round(100 * (1 - Math.pow(2, -ratio)))));
}

function medianOf(nums: number[]) {
  const a = nums.slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function isFinancialReg(it: Item) {
  const blob = `${it.title || ''} ${it.source || ''} ${it.summary || ''} ${it.why_it_matters || ''} ${it.url || ''}`;
  return !!regulatorOf(it) || FIN_RULE.test(blob);
}

function heat(items: Item[], cats: string[], hist: { start: number; end: number }[], _nowMs: number, opts?: { financialOnly?: boolean }) {
  const topic = items.filter((it) => inCat(it, cats) && (!opts?.financialOnly || isFinancialReg(it)));
  const pool = opts?.financialOnly ? topic : items;
  const counts = hist.map((w) => windowWeight(pool, cats, w.start, w.end));
  let lead = 0;
  while (lead < counts.length && counts[lead] === 0) lead += 1;
  const afterLead = counts.slice(lead);
  const real = afterLead.filter((n) => n > 0);
  /* Building only while history is shorter than 4 weeks with data. Leading empty
     weeks no longer force building once four real weeks exist (prompt 13). */
  const building = real.length < 4;
  const med = medianOf(real) || 1;
  const nowCount = counts[counts.length - 1] || 0;
  const v = building ? null : scaled(nowCount, med);
  /* Delta vs the 5-week normal (median of the prior five weeks), not last week. */
  const prior5 = counts.slice(Math.max(0, counts.length - 6), -1).filter((n) => n > 0);
  const normalCount = medianOf(prior5.length ? prior5 : real) || med;
  const normalV = building ? null : scaled(normalCount, med);
  const bars = counts.map((n, i) => (i < lead ? 0 : (building ? Math.min(100, Math.round((n / (med || 1)) * 40)) : scaled(n, med))));
  const mtgRule = /mortgage|renewal|lender|broker|osfi\s*b-?20|bcfsa|\brates?\b|stress.?test/i;
  const ranked = topic.slice().sort((a, b) => weight(b) - weight(a) || new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
  const wantMtg = cats.some((c) => /mortgage|housing/i.test(c));
  /* Mortgage lead must name mortgages / renewals / lenders / brokers / B-20 / BCFSA / rates. */
  const top = wantMtg
    ? ranked.find((it) => mtgRule.test(`${it.title || ''} ${it.summary || ''} ${it.why_it_matters || ''}`))
    : ranked[0];
  const title = String(top?.title || '');
  return {
    v: v == null ? null : v,
    d: building || v == null || normalV == null ? 0 : v - normalV,
    building,
    buildingN: real.length,
    w: bars,
    why: title,
    story: top
      ? {
          chip: String(top.category || cats[0]),
          img: String(top.image_url || ''),
          imp: /threat/i.test(String(top.impact)) ? 'threat' : /opp/i.test(String(top.impact)) ? 'opp' : 'reg',
          h: title,
          dek: String(top.summary || ''),
          wim: String(top.why_it_matters || ''),
        }
      : {
          chip: cats[0],
          img: '',
          imp: 'reg',
          h: wantMtg ? 'No mortgage story this week' : 'No story this week',
          dek: '',
          wim: '',
        },
  };
}

function regulatorOf(it: Item) {
  const blob = `${it.title || ''} ${it.source || ''} ${it.url || ''}`;
  return REGS.find((r) => new RegExp(r.replace(/ /g, '\\s+'), 'i').test(blob))
    || (/bankofcanada|bank of canada/i.test(blob) ? 'Bank of Canada' : '');
}

async function valetSeries(id: string) {
  const url = `https://www.bankofcanada.ca/valet/observations/${encodeURIComponent(id)}/json?recent=30`;
  const res = await outbound(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) return { v: '-', d: '-', dir: 'fl', s: [] as number[] };
  const json = await res.json() as { observations?: Array<Record<string, { v?: string } | string>> };
  const nums = (json.observations || []).map((row) => {
    const cell = row[id];
    const raw = typeof cell === 'object' && cell ? cell.v : cell;
    return Number(raw);
  }).filter((n) => Number.isFinite(n));
  if (!nums.length) return { v: '-', d: '-', dir: 'fl', s: [] as number[] };
  const last = nums[nums.length - 1];
  const prev = nums[nums.length - 2] ?? last;
  const delta = last - prev;
  const dir = Math.abs(delta) < 1e-6 ? 'fl' : delta > 0 ? 'up' : 'dn';
  return {
    v: id.startsWith('FX') ? last.toFixed(3) : `${last.toFixed(2)}%`,
    d: `${delta >= 0 ? '+' : ''}${id.startsWith('FX') ? delta.toFixed(3) : delta.toFixed(2)}`,
    dir,
    s: nums.slice(-8),
  };
}

let valetCache: { at: number; mkt: { k: string; v: string; d: string; dir: string; s: number[] }[] } | null = null;

export async function buildPulse(sql: Sql, ownerId: string, view: 'market' | 'consumer') {
  const nowMs = Date.now();
  const hist = rollingWindows(8, nowMs);
  const since = new Date(nowMs - 10 * WEEK_MS);
  const rows = await sql`
    SELECT title, url, source, category, impact, published_at, is_top, why_it_matters, summary, image_url
    FROM news_items
    WHERE owner_id = ${ownerId} AND COALESCE(hidden, false) = false
      AND published_at >= ${since.toISOString()}
    ORDER BY published_at DESC NULLS LAST
    LIMIT 800
  `.catch(() => []) as Item[];
  const items = rows || [];
  const specs = view === 'consumer' ? CONSUMER_GAUGES : MARKET_GAUGES;
  const gauges = specs.map((g) => Object.assign(
    { k: g.k, t: g.t, chip: g.chip },
    heat(items, g.cats, hist, nowMs, g.k === 'reg' ? { financialOnly: true } : undefined),
  ));
  const thisWeek = items.filter((it) => {
    const t = new Date(it.published_at || 0).getTime();
    return t >= nowMs - WEEK_MS;
  });
  const worry = thisWeek.filter((it) => FEAR_THEMES.some((th) => th.re.test(`${it.title} ${it.summary}`)));
  const fear = FEAR_THEMES.map((th) => {
    const n = worry.filter((it) => th.re.test(`${it.title} ${it.summary}`)).length;
    return { n: th.n, p: worry.length ? Math.round((n / worry.length) * 100) : 0, tr: 'fl', why: n ? `${n} stor${n === 1 ? 'y' : 'ies'} this week` : 'no stories this week' };
  });
  if (fear.reduce((a, f) => a + f.p, 0) === 0) fear.forEach((f, i, arr) => { f.p = i === arr.length - 1 ? 0 : 0; });
  const regs = REGS.map((n) => {
    const c = hist.map((w) => items.filter((it) => {
      const t = new Date(it.published_at || 0).getTime();
      return regulatorOf(it) === n && t >= w.start && t < w.end;
    }).length);
    const lastIt = items.filter((it) => regulatorOf(it) === n)[0];
    return { n, c, last: lastIt ? String(lastIt.title || '').slice(0, 64) : 'quiet' };
  });
  let mkt = VALET.map((x) => ({ k: x.k, v: '-', d: '-', dir: 'fl', s: [] as number[] }));
  if (!valetCache || Date.now() - valetCache.at > 6 * 3600 * 1000) {
    try {
      mkt = await Promise.all(VALET.map(async (x) => Object.assign({ k: x.k }, await valetSeries(x.series))));
      valetCache = { at: Date.now(), mkt };
    } catch {
      mkt = valetCache?.mkt || mkt;
    }
  } else mkt = valetCache.mkt;

  await sql`CREATE TABLE IF NOT EXISTS ops_figures (
    owner_id text NOT NULL,
    key text NOT NULL,
    label text NOT NULL DEFAULT '',
    value text NOT NULL DEFAULT '',
    source text NOT NULL DEFAULT '',
    as_of date,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, key)
  )`.catch(() => {});
  const figs = await sql`SELECT key, value FROM ops_figures WHERE owner_id = ${ownerId}`.catch(() => []) as { key?: string; value?: string }[];
  const byKey: Record<string, string> = {};
  (figs || []).forEach((f) => { byKey[String(f.key || '')] = String(f.value || ''); });
  const cmkt = [
    { k: 'Consumer confidence (weekly)', key: 'nanos_weekly' },
    { k: 'Consumer confidence (monthly)', key: 'conference_board' },
    { k: 'Mortgages 90+ days late', key: 'equifax_90' },
    { k: 'Fraud losses reported, YTD', key: 'cafc_ytd' },
  ].map((x) => ({ k: x.k, v: byKey[x.key] || '-', d: '-', dir: 'fl', s: [] as number[] }));

  const updatedAt = new Date();
  return {
    gauges: view === 'consumer' ? [] : gauges,
    consumer: view === 'consumer' ? gauges : [],
    fear,
    cmkt,
    weeks: hist.map((w, i) => weekLabel(w.start, i === hist.length - 1)),
    regs,
    mkt,
    updated: formatPulseClock(updatedAt),
    updatedAt: updatedAt.toISOString(),
    nextAt: nextPulseAt(updatedAt),
  };
}

export async function loadPulse(sql: Sql, ownerId: string, view: 'market' | 'consumer') {
  const rows = await sql`
    SELECT payload, updated_at FROM news_pulse_cache
    WHERE owner_id = ${ownerId} AND view = ${view}
    LIMIT 1
  `.catch(() => []) as { payload?: unknown; updated_at?: string }[];
  const row = rows[0];
  if (!row || !row.payload || typeof row.payload !== 'object') return null;
  const updatedAt = row.updated_at ? new Date(row.updated_at) : new Date();
  return Object.assign({}, row.payload as Record<string, unknown>, {
    updated: formatPulseClock(updatedAt),
    updatedAt: updatedAt.toISOString(),
    nextAt: nextPulseAt(updatedAt),
  });
}

export async function savePulse(sql: Sql, ownerId: string, view: 'market' | 'consumer', payload: unknown) {
  await sql`
    INSERT INTO news_pulse_cache (owner_id, view, payload, updated_at)
    VALUES (${ownerId}, ${view}, ${payload as never}, now())
    ON CONFLICT (owner_id, view) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
  `.catch(() => {});
}
