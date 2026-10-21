import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  { name: 'Playbook', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', host: 'playDesk' },
  { name: 'Calendar', live: 'control-room.html?view=calendar&fixture=mockup', ready: '#calDesk[data-port-ready]', host: 'calDesk' },
  { name: 'Zoom', live: 'control-room.html?view=znotes&fixture=mockup', ready: '#zoomDesk[data-port-ready]', host: 'zoomDesk' },
  { name: 'Completed', live: 'control-room.html?view=done&fixture=mockup', ready: '#doneDesk[data-port-ready]', host: 'doneDesk' },
];
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
      if (pathName === '/control-room' || pathName === '/playbook' || pathName === '/calendar' || pathName === '/zoom' || pathName === '/completed') pathName = '/control-room.html';
      const tries = [
        join(ROOT, 'public', pathName),
        join(ROOT, 'design-reference', pathName),
      ];
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

async function main() {
  const { port, server } = await serve();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const rows = [];
  try {
    for (const spec of PAGES) {
      await page.goto(`http://127.0.0.1:${port}/${spec.live}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector(spec.ready, { timeout: 15000, state: 'attached' });
      await page.waitForTimeout(500);
      const inv = await page.evaluate((hostId) => {
        const host = document.getElementById(hostId);
        const root = host && host.shadowRoot;
        if (!root) return { error: 'no shadow', withAction: 0, without: 0, total: 0, actions: [] };
        if (typeof window.stampDeskControls === 'function') window.stampDeskControls(root);
        const inv = typeof window.deskInventory === 'function' ? window.deskInventory(root) : { withAction: 0, without: -1 };
        const listed = [];
        root.querySelectorAll('[data-action]').forEach((el) => {
          const a = el.getAttribute('data-action');
          if (listed.indexOf(a) < 0) listed.push(a);
        });
        return Object.assign({ actions: listed.sort() }, inv);
      }, spec.host);
      const pass = inv.without === 0;
      rows.push({ page: spec.name, withAction: inv.withAction, without: inv.without, pass, actions: inv.actions });
      console.log(`${spec.name.padEnd(12)} with=${inv.withAction}  without=${inv.without}  ${pass ? 'PASS' : 'FAIL'}`);
      console.log('  actions: ' + (inv.actions || []).join(', '));
    }

    const clicks = [];
    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=playbook&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#playDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const play = await page.evaluate(() => {
      const root = document.getElementById('playDesk').shadowRoot;
      const pad = root.querySelector('[data-action="play-pad"]');
      if (pad) pad.click();
      const pop = !!(root.querySelector('#pop.show, .pop.show'));
      const add = root.querySelector('[data-action="play-add"]');
      const rec = root.querySelector('[data-action="play-voice-rec"]');
      const run = root.querySelector('[data-action="play-run"]');
      return { pop, add: !!add, rec: !!rec, run: !!run };
    });
    clicks.push({ page: 'Playbook', control: 'Pad popover', pass: !!play.pop });
    clicks.push({ page: 'Playbook', control: '+ Add a rhythm', pass: !!play.add });
    clicks.push({ page: 'Playbook', control: 'Voice record', pass: !!play.rec });
    clicks.push({ page: 'Playbook', control: "Run today's plays", pass: !!play.run });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=calendar&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#calDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const cal = await page.evaluate(() => {
      const root = document.getElementById('calDesk').shadowRoot;
      const day = root.querySelector('[data-action="cal-view"][data-v="day"]');
      if (day) day.click();
      const dayOn = !!(root.querySelector('[data-action="cal-view"][data-v="day"].on'));
      const week = root.querySelector('[data-action="cal-view"][data-v="week"]');
      if (week) week.click();
      const ev = root.querySelector('[data-action="cal-event"]');
      const nl = root.querySelector('[data-action="cal-nl"]');
      const nav = root.querySelector('[data-action="cal-nav"]');
      return { dayOn, ev: !!ev, nl: !!nl, nav: !!nav };
    });
    clicks.push({ page: 'Calendar', control: 'Day view', pass: !!cal.dayOn });
    clicks.push({ page: 'Calendar', control: 'Event block', pass: !!cal.ev });
    clicks.push({ page: 'Calendar', control: 'Natural language', pass: !!cal.nl });
    clicks.push({ page: 'Calendar', control: 'Prev/Today/Next', pass: !!cal.nav });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=znotes&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#zoomDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const zoom = await page.evaluate(() => {
      const root = document.getElementById('zoomDesk').shadowRoot;
      const open = root.querySelector('[data-action="zoom-open"]');
      if (open) open.click();
      const drawer = !!(root.querySelector('#drawer.open, .drawer.open'));
      const add = root.querySelector('[data-action="zoom-add"]');
      const refresh = root.querySelector('[data-action="zoom-refresh"]');
      const edit = root.querySelector('[data-action="zoom-edit"]');
      return { drawer, add: !!add, refresh: !!refresh, edit: !!edit };
    });
    clicks.push({ page: 'Zoom', control: 'Open meeting', pass: !!zoom.drawer });
    clicks.push({ page: 'Zoom', control: '+ Add note', pass: !!zoom.add });
    clicks.push({ page: 'Zoom', control: 'Refresh', pass: !!zoom.refresh });
    clicks.push({ page: 'Zoom', control: 'Edit', pass: !!zoom.edit });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=done&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#doneDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const done = await page.evaluate(() => {
      const root = document.getElementById('doneDesk').shadowRoot;
      const day = root.querySelector('[data-action="done-day"]:not(.on)');
      if (day) day.click();
      const on = !!(day && day.classList.contains('on'));
      const snap = root.querySelector('[data-action="done-snap"]');
      const search = root.querySelector('[data-action="done-search"]');
      const pdf = root.querySelector('[data-action="done-export"]');
      return { on, snap: !!snap, search: !!search, pdf: !!pdf };
    });
    clicks.push({ page: 'Completed', control: 'Day click', pass: !!done.on });
    clicks.push({ page: 'Completed', control: 'Snapshot now', pass: !!done.snap });
    clicks.push({ page: 'Completed', control: 'Search days', pass: !!done.search });
    clicks.push({ page: 'Completed', control: 'Export PDF', pass: !!done.pdf });

    console.log('\nclick-check (fixture DOM)');
    clicks.forEach((c) => console.log(`${c.page.padEnd(12)} ${c.control.padEnd(28)} ${c.pass ? 'PASS' : 'FAIL'}`));
    console.log('\npage errors', errors.length, errors.slice(0, 8));
    const failed = rows.some((r) => !r.pass) || clicks.some((c) => !c.pass);
    if (failed) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
