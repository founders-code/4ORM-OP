import type { Sql } from './db';

const REGS = ['FINTRAC', 'OSFI', 'FSRA', 'BCFSA', 'CSA', 'AMF', 'FCAC', 'CIRO', 'Bank of Canada'];
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
  { k: '5-year Canada bond', series: 'V39063', pct: true },
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

function weekStart(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - dow + 1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function weeksBack(n: number) {
  const now = weekStart(new Date());
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(d);
  }
  return out;
}

function weekLabel(d: Date) {
  if (d.getTime() === weekStart(new Date()).getTime()) return 'Now';
  return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
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

function heat(items: Item[], cats: string[], weeks: Date[]) {
  const buckets = weeks.map((w) => {
    const end = new Date(w);
    end.setUTCDate(end.getUTCDate() + 7);
    return items.filter((it) => {
      const t = new Date(it.published_at || 0).getTime();
      return t >= w.getTime() && t < end.getTime() && inCat(it, cats);
    }).reduce((a, it) => a + weight(it), 0);
  });
  const now = buckets[buckets.length - 1] || 0;
  const prior = buckets.slice(0, -1);
  const mean = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 1;
  const v = Math.max(0, Math.min(100, Math.round((now / (mean || 1)) * 50)));
  const last = buckets[buckets.length - 2] || 0;
  const lastV = Math.max(0, Math.min(100, Math.round((last / (mean || 1)) * 50)));
  const top = items.filter((it) => inCat(it, cats)).sort((a, b) => weight(b) - weight(a) || new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime())[0];
  const title = String(top?.title || '');
  const first = title.split(/[:—-]/)[0].trim().slice(0, 28) || 'News';
  return {
    v,
    d: v - lastV,
    w: buckets.map((n) => Math.round((n / (mean || 1)) * 50)),
    why: [first, title.slice(first.length).replace(/^[\s:—-]+/, '') || String(top?.summary || '').slice(0, 80)],
    story: top
      ? {
          chip: String(top.category || cats[0]),
          img: String(top.image_url || ''),
          imp: /threat/i.test(String(top.impact)) ? 'threat' : /opp/i.test(String(top.impact)) ? 'opp' : 'reg',
          h: title,
          dek: String(top.summary || ''),
          wim: String(top.why_it_matters || ''),
        }
      : { chip: cats[0], img: '', imp: 'reg', h: 'No story this week', dek: '', wim: '' },
  };
}

function regulatorOf(it: Item) {
  const blob = `${it.title || ''} ${it.source || ''} ${it.url || ''}`;
  return REGS.find((r) => new RegExp(r.replace(/ /g, '\\s+'), 'i').test(blob))
    || (/bankofcanada|bank of canada/i.test(blob) ? 'Bank of Canada' : '');
}

async function valetSeries(id: string) {
  const url = `https://www.bankofcanada.ca/valet/observations/${encodeURIComponent(id)}/json?recent=30`;
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
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
  const weeks = weeksBack(8);
  const since = new Date(weeks[0]);
  since.setUTCDate(since.getUTCDate() - 2);
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
  const gauges = specs.map((g) => Object.assign({ k: g.k, t: g.t, chip: g.chip }, heat(items, g.cats, weeks)));
  const thisWeek = items.filter((it) => {
    const t = new Date(it.published_at || 0).getTime();
    return t >= weeks[weeks.length - 1].getTime();
  });
  const worry = thisWeek.filter((it) => FEAR_THEMES.some((th) => th.re.test(`${it.title} ${it.summary}`)));
  const fear = FEAR_THEMES.map((th) => {
    const n = worry.filter((it) => th.re.test(`${it.title} ${it.summary}`)).length;
    return { n: th.n, p: worry.length ? Math.round((n / worry.length) * 100) : 0, tr: 'fl', why: n ? `${n} stor${n === 1 ? 'y' : 'ies'} this week` : 'no stories this week' };
  });
  if (fear.reduce((a, f) => a + f.p, 0) === 0) fear.forEach((f, i, arr) => { f.p = i === arr.length - 1 ? 0 : 0; });
  const regs = REGS.map((n) => {
    const c = weeks.map((w) => {
      const end = new Date(w);
      end.setUTCDate(end.getUTCDate() + 7);
      return items.filter((it) => {
        const t = new Date(it.published_at || 0).getTime();
        return regulatorOf(it) === n && t >= w.getTime() && t < end.getTime();
      }).length;
    });
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

  return {
    gauges: view === 'consumer' ? [] : gauges,
    consumer: view === 'consumer' ? gauges : [],
    fear,
    cmkt,
    weeks: weeks.map(weekLabel),
    regs,
    mkt,
  };
}
