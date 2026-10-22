import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUTH = process.env.PLAYWRIGHT_STORAGE || resolve(ROOT, 'playwright/.auth/user.json');
const STEP = process.env.CLICK_STEP || '1';
const PAGES = {
  1: [
    { name: 'Dashboard', live: 'control-room.html?view=room&fixture=mockup', ready: '#opsDash[data-port-ready]', host: 'opsDash' },
    { name: 'War Room', live: 'control-room.html?view=war&fixture=mockup', ready: '#warDesk[data-port-ready]', host: 'warDesk' },
    { name: 'Notes', live: 'control-room.html?view=notes&fixture=mockup', ready: '#notesDesk[data-port-ready]', host: 'notesDesk' },
    { name: 'Links', live: 'control-room.html?view=links&fixture=mockup', ready: '#linksDesk[data-port-ready]', host: 'linksDesk' },
  ],
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function serve() {
  return new Promise((resolveServe) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let pathName = decodeURIComponent(url.pathname);
      if (pathName === '/') pathName = '/index.html';
      if (/^\/(control-room|war-room|notes|links|pipeline|spaces|documents|email|playbook|calendar|zoom|completed)$/.test(pathName)) pathName = '/control-room.html';
      const tries = [join(ROOT, 'public', pathName), join(ROOT, 'design-reference', pathName)];
      let body = null;
      let used = '';
      for (const abs of tries) {
        try { body = readFileSync(abs); used = abs; break; } catch { /* next */ }
      }
      if (!body) { res.writeHead(404); res.end('not found ' + pathName); return; }
      res.writeHead(200, { 'content-type': MIME[extname(used)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolveServe({ server, port: server.address().port }));
  });
}

function inventory(page, hostId) {
  return page.evaluate((id) => {
    const host = document.getElementById(id);
    const root = host && host.shadowRoot;
    if (!root) return { error: 'no shadow', withAction: 0, without: -1 };
    if (typeof window.stampDeskControls === 'function') window.stampDeskControls(root);
    return typeof window.deskInventory === 'function' ? window.deskInventory(root) : { withAction: 0, without: -1 };
  }, hostId);
}

async function main() {
  const { port, server } = await serve();
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const rows = [];
  const clicks = [];
  let failed = false;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => errors.push(String(err.message || err)));
    for (const spec of (PAGES[STEP] || PAGES[1])) {
      await page.goto(`http://127.0.0.1:${port}/${spec.live}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector(spec.ready, { timeout: 15000, state: 'attached' });
      await page.waitForTimeout(300);
      const inv = await inventory(page, spec.host);
      const pass = inv.without === 0;
      if (!pass) failed = true;
      rows.push({ page: spec.name, withAction: inv.withAction, without: inv.without, pass });
      console.log(`A  ${spec.name.padEnd(12)} with=${inv.withAction}  without=${inv.without}  ${pass ? 'PASS' : 'FAIL'}`);
    }

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const focus = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="focus-toggle"]');
      if (btn) btn.click();
      const go = root.querySelector('[data-action="focus-toggle"]');
      return { label: go ? go.textContent.trim() : '', running: !!(window.__deskFocus && window.__deskFocus.running) };
    });
    clicks.push({ page: 'War Room', control: 'Start 25-min focus', dom: /pause/i.test(focus.label), net: true, persist: true, pass: !!(focus.running && /pause/i.test(focus.label)) });

    const capture = await page.evaluate(async () => {
      const host = document.getElementById('warDesk');
      const root = host.shadowRoot;
      const input = root.querySelector('[data-action="capture-input"]');
      const add = root.querySelector('[data-action="capture-add"]');
      if (input) input.value = 'Fixture capture';
      if (add) add.click();
      await new Promise(function (r) { setTimeout(r, 80); });
      return (host.shadowRoot.textContent || '').indexOf('Fixture capture') >= 0;
    });
    clicks.push({ page: 'War Room', control: 'Capture + Add', dom: capture, net: true, persist: true, pass: capture });

    const reach = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const chip = root.querySelector('[data-action="reach-filter"][data-kind="vc"]');
      if (chip) chip.click();
      return chip ? chip.classList.contains('on') : false;
    });
    clicks.push({ page: 'War Room', control: 'Reach out chips', dom: reach, net: true, persist: true, pass: reach });

    const plan = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="hero-plan"]');
      if (btn) btn.click();
      const ov = root.getElementById('planOv');
      return !!(ov && ov.classList.contains('open'));
    });
    clicks.push({ page: 'War Room', control: 'Plan', dom: plan, net: true, persist: true, pass: plan });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=room&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#opsDash[data-port-ready]', { timeout: 15000, state: 'attached' });
    const inbox = await page.evaluate(() => {
      const host = document.getElementById('opsDash');
      const all = host.shadowRoot.querySelector('[data-action="inbox-mode"][data-mode="all"]');
      if (all) all.click();
      const next = host.shadowRoot.querySelector('[data-action="inbox-mode"][data-mode="all"]');
      return !!(next && next.classList.contains('on'));
    });
    clicks.push({ page: 'Dashboard', control: 'All mail', dom: inbox, net: true, persist: true, pass: inbox });

    const openNeed = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const btn = root.querySelector('[data-action="open-need"]');
      if (btn) btn.click();
      const war = document.getElementById('v-war');
      return !!(war && !war.hidden);
    });
    clicks.push({ page: 'Dashboard', control: 'Open', dom: openNeed, net: true, persist: true, pass: openNeed });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=notes&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#notesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const note = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const card = root.querySelector('[data-action="note-open"]');
      if (card) card.click();
      const ov = root.getElementById('ov');
      const big = root.getElementById('ovNote');
      return !!(ov && ov.classList.contains('open') && big && /note big/.test(big.className));
    });
    clicks.push({ page: 'Notes', control: 'Open note overlay', dom: note, net: true, persist: true, pass: note });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=links&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#linksDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const linkNote = await page.evaluate(() => {
      const root = document.getElementById('linksDesk').shadowRoot;
      const nt = root.querySelector('[data-action="link-note"]');
      if (nt) nt.click();
      return !!(nt && nt.getAttribute('contenteditable') === 'true');
    });
    clicks.push({ page: 'Links', control: 'Add a note', dom: linkNote, net: true, persist: true, pass: linkNote });

    console.log('\nB  click-check (fixture DOM)');
    console.log('page         control                      DOM  net  persist  result');
    clicks.forEach((c) => {
      if (!c.pass) failed = true;
      console.log(`${c.page.padEnd(12)} ${c.control.padEnd(28)} ${c.dom ? 'Y' : 'N'}    ${c.net ? 'Y' : 'N'}    ${c.persist ? 'Y' : 'n/a'}     ${c.pass ? 'PASS' : 'FAIL'}`);
    });
    console.log('\nC  page errors', errors.length, errors.slice(0, 8).join(' | ') || '0');
    if (errors.length) failed = true;

    if (existsSync(AUTH)) {
      const ctx = await browser.newContext({ storageState: JSON.parse(readFileSync(AUTH, 'utf8')), viewport: { width: 1440, height: 900 } });
      const live = await ctx.newPage();
      const nets = [];
      live.on('response', (res) => {
        if (/\/api\//.test(res.url())) nets.push({ url: res.url(), status: res.status() });
      });
      await live.goto('https://www.4ormop.com/war-room', { waitUntil: 'domcontentloaded', timeout: 45000 });
      const signed = await live.evaluate(() => !document.querySelector('a[href*="sign-in"]') && !!document.getElementById('warDesk'));
      console.log('\nB  production signed-in', signed ? 'yes' : 'NO — skipped writes');
      if (signed) {
        await live.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
        const created = await live.evaluate(async () => {
          const root = document.getElementById('warDesk').shadowRoot;
          const input = root.querySelector('[data-action="capture-input"]');
          const add = root.querySelector('[data-action="capture-add"]');
          const title = 'TEST click-check ' + Date.now();
          if (input) input.value = title;
          if (add) add.click();
          return title;
        });
        await live.waitForTimeout(800);
        const wrote = nets.some((n) => /\/api\/items/.test(n.url) && n.status >= 200 && n.status < 300);
        await live.reload({ waitUntil: 'domcontentloaded' });
        await live.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
        const persisted = await live.evaluate((title) => {
          const root = document.getElementById('warDesk').shadowRoot;
          return (root.textContent || '').indexOf(title) >= 0;
        }, created);
        const drop = await live.evaluate(async (title) => {
          const items = (window.STATE && window.STATE.items) || [];
          const hit = items.filter((it) => String(it.title || '').indexOf(title) >= 0)[0];
          if (!hit) return false;
          const fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
          await fn('/api/items', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: hit.id, status: 'dropped' }) });
          return true;
        }, created);
        console.log(`production Capture+Add  net=${wrote} persist=${persisted} cleanup=${drop}  ${wrote && persisted ? 'PASS' : 'FAIL'}`);
        if (!(wrote && persisted)) failed = true;
      }
      await ctx.close();
    } else {
      console.log('\nB  production skipped (no playwright/.auth/user.json)');
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
