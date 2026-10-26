import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { signInAsTestUser } from './auth-state.mjs';

const ORIGIN = 'https://www.4ormop.com';
const WANT = [
  'open the next private-network conversation with kevin',
  'write who, the chunk',
  'then open zahar, bj, and daryl',
];

function slim(g) {
  return {
    table: g.table,
    title: g.keep || g.title || '',
    keepAt: g.keepAt,
    remove: g.remove,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await signInAsTestUser(page);
  const dry = await page.evaluate(async () => {
    const r = await (window.authFetch || fetch)('/api/ops/dedupe', { credentials: 'same-origin' });
    return { status: r.status, json: await r.json().catch(() => null) };
  });
  console.log('DRY_STATUS', dry.status);
  console.log('DRY_COUNTS', JSON.stringify((dry.json && dry.json.counts) || dry.json, null, 2));
  const first = ((dry.json && dry.json.first15) || []).map(slim);
  console.log('DRY_FIRST15', JSON.stringify(first, null, 2));
  writeFileSync('/tmp/dedupe-dry.json', JSON.stringify(dry.json, null, 2));

  const apply = await page.evaluate(async () => {
    const r = await (window.authFetch || fetch)('/api/ops/dedupe', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  });
  console.log('APPLY_STATUS', apply.status);
  console.log('APPLY', JSON.stringify(apply.json, null, 2));
  writeFileSync('/tmp/dedupe-apply.json', JSON.stringify(apply.json, null, 2));

  await page.goto(ORIGIN + '/war-room', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 25000, state: 'attached' }).catch(() => {});
  await page.waitForTimeout(1800);
  const war = await page.evaluate((want) => {
    const root = document.getElementById('warDesk') && document.getElementById('warDesk').shadowRoot;
    const texts = root ? [...root.querySelectorAll('.task, .card, [data-action="item-open"], .ttl, b')].map((el) => (el.textContent || '').trim()) : [];
    const items = (window.STATE && window.STATE.items) || [];
    const acts = (window.STATE && window.STATE.meetingActions) || [];
    function hits(list, get) {
      return want.map((w) => {
        const rows = list.filter((x) => String(get(x) || '').toLowerCase().indexOf(w) >= 0);
        return { needle: w, n: rows.length, titles: rows.map(get).slice(0, 8) };
      });
    }
    return {
      itemHits: hits(items, (x) => x.title),
      actHits: hits(acts, (x) => x.text),
      todayText: texts.filter((t) => want.some((w) => t.toLowerCase().indexOf(w) >= 0)).slice(0, 20),
    };
  }, WANT);
  console.log('WAR', JSON.stringify(war, null, 2));
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
