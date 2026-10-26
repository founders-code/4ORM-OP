import { chromium } from 'playwright';
import { signInAsTestUser } from './auth-state.mjs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await signInAsTestUser(page);
  const out = await page.evaluate(async () => {
    const r = await (window.authFetch || fetch)('/api/ops/dedupe', { credentials: 'same-origin' });
    const j = await r.json().catch(() => null);
    const items = await (window.authFetch || fetch)('/api/board', { credentials: 'same-origin' }).then((x) => x.json()).catch(() => null);
    const titles = ((items && (items.items || items.today || items.moves)) || []).map((x) => x.title || x.text || x.name).filter(Boolean);
    const all = JSON.stringify(items || {}).slice(0, 200);
    function hits(list) {
      const needles = ['kevin', 'chunk', 'zahar', 'daryl'];
      return (list || []).filter((t) => needles.some((n) => String(t).toLowerCase().includes(n)));
    }
    return {
      status: r.status,
      warItems: j && j.warItems,
      leftover: j && j.counts,
      indexes: j && j.indexes,
      titleHits: hits(titles),
      keys: items && Object.keys(items),
      sample: all
    };
  });
  console.log(JSON.stringify(out, null, 2));
  const apply = await page.evaluate(async () => {
    const r = await (window.authFetch || fetch)('/api/ops/dedupe', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  });
  console.log('APPLY', JSON.stringify(apply, null, 2));
  await page.goto('https://www.4ormop.com/war-room', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 25000, state: 'attached' }).catch(() => {});
  await page.waitForTimeout(1500);
  const war = await page.evaluate(() => {
    const root = document.getElementById('warDesk') && document.getElementById('warDesk').shadowRoot;
    const text = root ? (root.textContent || '') : '';
    const items = (window.STATE && window.STATE.items) || [];
    const acts = (window.STATE && window.STATE.meetingActions) || [];
    const want = ['kevin', 'chunk', 'zahar'];
    function count(list, get) {
      const map = {};
      list.forEach((x) => {
        const t = String(get(x) || '');
        want.forEach((w) => {
          if (t.toLowerCase().includes(w)) map[t] = (map[t] || 0) + 1;
        });
      });
      return map;
    }
    return {
      stateItemHits: count(items, (x) => x.title),
      stateActHits: count(acts, (x) => x.text),
      inDom: {
        kevin: (text.match(/kevin/ig) || []).length,
        chunk: (text.match(/chunk/ig) || []).length,
        zahar: (text.match(/zahar/ig) || []).length
      }
    };
  });
  console.log('WAR', JSON.stringify(war, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
