import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  { name: 'Pipeline', live: 'control-room.html?view=contacts&fixture=mockup', ready: '#pipeDesk[data-port-ready]', host: 'pipeDesk' },
  { name: 'Spaces', live: 'control-room.html?view=work&fixture=mockup', ready: '#spacesDesk[data-port-ready]', host: 'spacesDesk' },
  { name: 'Documents', live: 'control-room.html?view=docs&fixture=mockup', ready: '#docsDesk[data-port-ready]', host: 'docsDesk' },
  { name: 'Email', live: 'control-room.html?view=mail&fixture=mockup', ready: '#mailDesk[data-port-ready]', host: 'mailDesk' },
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
      if (pathName === '/control-room' || pathName === '/pipeline' || pathName === '/spaces' || pathName === '/documents' || pathName === '/email') pathName = '/control-room.html';
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
        const missing = [];
        root.querySelectorAll(window.__deskControlSel || 'button, a, input, [draggable="true"]').forEach(() => {});
        return Object.assign({ actions: listed.sort() }, inv);
      }, spec.host);
      const pass = inv.without === 0;
      rows.push({ page: spec.name, withAction: inv.withAction, without: inv.without, pass, actions: inv.actions });
      console.log(`${spec.name.padEnd(12)} with=${inv.withAction}  without=${inv.without}  ${pass ? 'PASS' : 'FAIL'}`);
      console.log('  actions: ' + (inv.actions || []).join(', '));
    }

    const clicks = [];
    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=contacts&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pipeDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const pipe = await page.evaluate(() => {
      const root = document.getElementById('pipeDesk').shadowRoot;
      const board = root.querySelector('[data-action="pipe-view"][data-view="board"]');
      if (board) board.click();
      const hasBoard = !!root.querySelector('.pipe-board');
      const dash = root.querySelector('[data-action="pipe-view"][data-view="dash"]');
      if (dash) dash.click();
      const hasFunnel = !!root.querySelector('.funnel');
      const follow = root.querySelector('[data-action="pipe-follow"]');
      return { hasBoard, hasFunnel, follow: !!(follow && follow.getAttribute('data-action') === 'pipe-follow') };
    });
    clicks.push({ page: 'Pipeline', control: 'Board tab', pass: !!pipe.hasBoard });
    clicks.push({ page: 'Pipeline', control: 'Dashboard tab', pass: !!pipe.hasFunnel });
    clicks.push({ page: 'Pipeline', control: 'Follow up', pass: !!pipe.follow });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=work&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#spacesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const spaces = await page.evaluate(() => {
      const root = document.getElementById('spacesDesk').shadowRoot;
      const open = root.querySelector('[data-action="space-open"]');
      const neu = root.querySelector('[data-action="spaces-new"]');
      const board = root.querySelector('[data-action="spaces-view"][data-view="board"]');
      if (board) board.click();
      const hasBoard = !!root.querySelector('.spaces-board, .pipe-board');
      return { open: !!open, neu: !!neu, hasBoard };
    });
    clicks.push({ page: 'Spaces', control: 'Open', pass: !!spaces.open });
    clicks.push({ page: 'Spaces', control: '+ New space', pass: !!spaces.neu });
    clicks.push({ page: 'Spaces', control: 'Board tab', pass: !!spaces.hasBoard });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=docs&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#docsDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const docs = await page.evaluate(() => {
      const root = document.getElementById('docsDesk').shadowRoot;
      const list = root.querySelector('[data-action="docs-view"][data-view="list"]');
      if (list) list.click();
      const listed = !!(root.querySelector('.files.list'));
      const grid = root.querySelector('[data-action="docs-view"][data-view="grid"]');
      if (grid) grid.click();
      const drop = root.querySelector('[data-action="space-drop"]');
      const drag = root.querySelector('[data-action="doc-drag"]');
      return { listed, drop: !!drop, drag: !!drag };
    });
    clicks.push({ page: 'Documents', control: 'List tab', pass: !!docs.listed });
    clicks.push({ page: 'Documents', control: 'File drag', pass: !!docs.drag });
    clicks.push({ page: 'Documents', control: 'Space drop', pass: !!docs.drop });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=mail&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mailDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const mail = await page.evaluate(() => {
      const root = document.getElementById('mailDesk').shadowRoot;
      const compose = root.querySelector('[data-action="mail-compose"]');
      if (compose) compose.click();
      const open = !!(root.querySelector('#compose.open'));
      const close = root.querySelector('[data-action="mail-compose-close"]');
      if (close) close.click();
      const card = root.querySelector('[data-action="mail-card"]');
      if (card) card.click();
      const reader = !!(root.querySelector('#reader.open'));
      const col = root.querySelector('[data-action="mail-col-drop"]');
      return { open, reader, col: !!col };
    });
    clicks.push({ page: 'Email', control: 'Compose', pass: !!mail.open });
    clicks.push({ page: 'Email', control: 'Open thread', pass: !!mail.reader });
    clicks.push({ page: 'Email', control: 'Column drop', pass: !!mail.col });

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
