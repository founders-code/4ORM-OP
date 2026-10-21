import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  { name: 'Dashboard', live: 'control-room.html?view=room&fixture=mockup', ready: '#opsDash[data-port-ready]', host: 'opsDash' },
  { name: 'War Room', live: 'control-room.html?view=war&fixture=mockup', ready: '#warDesk[data-port-ready]', host: 'warDesk' },
  { name: 'Notes', live: 'control-room.html?view=notes&fixture=mockup', ready: '#notesDesk[data-port-ready]', host: 'notesDesk' },
  { name: 'Links', live: 'control-room.html?view=links&fixture=mockup', ready: '#linksDesk[data-port-ready]', host: 'linksDesk' },
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
      if (pathName === '/control-room' || pathName === '/war-room' || pathName === '/notes' || pathName === '/links') pathName = '/control-room.html';
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
      await page.waitForTimeout(400);
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

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const focus = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="focus-toggle"]');
      const b = root.querySelector('.ring b');
      const before = b ? b.textContent : '';
      if (btn) btn.click();
      const after = b ? b.textContent : '';
      const go = root.querySelector('[data-action="focus-toggle"]');
      return { before, after, label: go ? go.textContent.trim() : '', running: !!(window.__deskFocus && window.__deskFocus.running) };
    });
    console.log('\nfocus-toggle DOM', focus);
    const clicks = [
      { page: 'War Room', control: 'Start 25-min focus', pass: !!(focus.running && /pause/i.test(focus.label)) },
    ];
    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=room&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#opsDash[data-port-ready]', { timeout: 15000, state: 'attached' });
    const people = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const all = root.querySelector('[data-action="inbox-mode"][data-mode="all"]');
      if (all) all.click();
      return all ? all.classList.contains('on') : false;
    });
    clicks.push({ page: 'Dashboard', control: 'All mail', pass: !!people });
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
