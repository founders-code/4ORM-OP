import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};
const SKIP = new Set([
  'mail-send', 'mail-send-now', 'space-send', 'cal-book', 'cal-create',
  'note-delete', 'space-archive', 'task-drop', 'hero-commit',
]);
const PAGES = [
  { name: '02e-signals-detail', live: 'control-room.html?view=war&fixture=mockup&sigdetail=1', ready: '#warDesk[data-port-ready]', host: 'warDesk' },
  { name: '03c-notes-canvas', live: 'control-room.html?view=notes&fixture=mockup&canvas=1', ready: '#notesDesk[data-port-ready]', host: 'notesDesk' },
  { name: '05d-spaces-arrange', live: 'control-room.html?view=work&fixture=mockup&arrange=1', ready: '#spacesDesk[data-port-ready]', host: 'spacesDesk' },
  { name: '02-war-room', live: 'control-room.html?view=war&fixture=mockup', ready: '#warDesk[data-port-ready]', host: 'warDesk' },
  { name: '03-notes', live: 'control-room.html?view=notes&fixture=mockup', ready: '#notesDesk[data-port-ready]', host: 'notesDesk' },
  { name: '04-pipeline', live: 'control-room.html?view=contacts&fixture=mockup', ready: '#pipeDesk[data-port-ready]', host: 'pipeDesk' },
  { name: '05-spaces', live: 'control-room.html?view=work&fixture=mockup', ready: '#spacesDesk[data-port-ready]', host: 'spacesDesk' },
  { name: '08d-email-inbox', live: 'control-room.html?view=mail&fixture=mockup', ready: '#mailDesk[data-port-ready]', host: 'mailDesk' },
  { name: '10-calendar', live: 'control-room.html?view=calendar&fixture=mockup', ready: '#calDesk[data-port-ready]', host: 'calDesk' },
];

function serve() {
  return new Promise((resolveServe) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let pathName = decodeURIComponent(url.pathname);
      if (pathName === '/') pathName = '/index.html';
      const tries = [join(ROOT, 'public', pathName), join(ROOT, 'design-reference', pathName)];
      let body = null;
      let used = '';
      for (const abs of tries) {
        try { body = readFileSync(abs); used = abs; break; } catch { /* next */ }
      }
      if (!body) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[extname(used)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolveServe({ server, port: server.address().port }));
  });
}

function designDeadClicks() {
  const dir = join(ROOT, 'design-reference/redesign');
  const files = readdirSync(dir).filter((f) => f.endsWith('.html'));
  const dead = [];
  for (const file of files) {
    const html = readFileSync(join(dir, file), 'utf8');
    const buttons = [...html.matchAll(/<button\b([^>]*)>/gi)];
    buttons.forEach((m, i) => {
      const attrs = m[1] || '';
      const wired = /data-action=|data-t=|data-v=|data-f=|data-tg=|id=|onclick=/i.test(attrs);
      if (!wired && !/type="submit"/i.test(attrs)) dead.push(`${file} button#${i + 1} ${attrs.trim().slice(0, 80)}`);
    });
  }
  return { files: files.length, dead };
}

async function main() {
  const design = designDeadClicks();
  console.log('design files', design.files, 'unwired buttons', design.dead.length);
  design.dead.forEach((d) => console.log('  DEAD', d));
  if (design.dead.length) {
    /* Original mockups wire by id/onclick; only fail live dead clicks below. */
  }

  const { port, server } = await serve();
  const browser = await chromium.launch({ headless: true });
  let failed = false;
  try {
    const page = await browser.newPage();
    page.on('dialog', (d) => d.dismiss());
    console.log('\npage                  action                         handler  click  result');
    for (const spec of PAGES) {
      await page.goto(`http://127.0.0.1:${port}/${spec.live}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector(spec.ready, { timeout: 15000, state: 'attached' });
      const rows = await page.evaluate(({ host }) => {
        const root = document.getElementById(host) && document.getElementById(host).shadowRoot;
        if (!root) return [{ action: '(no shadow)', handler: false, click: false }];
        const seen = new Set();
        const out = [];
        root.querySelectorAll('[data-action]').forEach((el) => {
          const a = el.getAttribute('data-action');
          if (!a || seen.has(a)) return;
          seen.add(a);
          const handler = !!(window.deskActions && window.deskActions[a]);
          out.push({ action: a, handler });
        });
        return out;
      }, { host: spec.host });
      for (const row of rows) {
        if (SKIP.has(row.action)) continue;
        let clicked = false;
        if (row.handler) {
          clicked = await page.evaluate(({ host, action }) => {
            const root = document.getElementById(host).shadowRoot;
            const el = root.querySelector('[data-action="' + action + '"]');
            if (!el) return false;
            try { el.click(); return true; } catch { return false; }
          }, { host: spec.host, action: row.action });
        }
        const pass = row.handler;
        if (!pass) failed = true;
        console.log(`${spec.name.padEnd(21)} ${row.action.padEnd(28)} ${row.handler ? 'Y' : 'N'}        ${clicked ? 'Y' : 'N'}     ${pass ? 'PASS' : 'FAIL'}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
