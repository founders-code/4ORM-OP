import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'visual-diff');
const PASS = 0.5;
const ONLY = (process.env.VISUAL_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const PAGES = [
  { page: '01-dashboard', design: 'redesign/01-dashboard.html', live: 'control-room.html?view=room&fixture=mockup', ready: '#opsDash[data-port-ready]' },
  { page: '02-war-room', design: 'redesign/02-war-room.html', live: 'control-room.html?view=war&fixture=mockup', ready: '#warDesk[data-port-ready]' },
  { page: '03-notes', design: 'redesign/03-notes.html', live: 'control-room.html?view=notes&fixture=mockup', ready: '#notesDesk[data-port-ready]' },
  { page: '02b-war-room-steps', design: 'redesign/02b-war-room-steps.html', live: 'control-room.html?view=war&fixture=mockup&steps=1', ready: '#warDesk[data-port-ready]', wait: 400 },
  { page: '03b-notes-open', design: 'redesign/03b-notes-open.html', live: 'control-room.html?view=notes&fixture=mockup&open=1', ready: '#notesDesk[data-port-ready]', wait: 400 },
  { page: '04-pipeline', design: 'redesign/04-pipeline.html', live: 'control-room.html?view=contacts&fixture=mockup', ready: '#pipeDesk[data-port-ready]' },
  { page: '05-spaces', design: 'redesign/05-spaces.html', live: 'control-room.html?view=work&fixture=mockup', ready: '#spacesDesk[data-port-ready]' },
  { page: '06-documents', design: 'redesign/06-documents.html', live: 'control-room.html?view=docs&fixture=mockup', ready: '#docsDesk[data-port-ready]' },
  { page: '07-links', design: 'redesign/07-links.html', live: 'control-room.html?view=links&fixture=mockup', ready: '#linksDesk[data-port-ready]' },
  { page: '08-email', design: 'redesign/08-email.html', live: 'control-room.html?view=mail&fixture=mockup', ready: '#mailDesk[data-port-ready]' },
  { page: '08b-email-compose', design: 'redesign/08b-email-compose.html', live: 'control-room.html?view=mail&fixture=mockup&compose=1', ready: '#mailDesk[data-port-ready]', wait: 800 },
  { page: '09-playbook', design: 'redesign/09-playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 600 },
  { page: '10-calendar', design: 'redesign/10-calendar.html', live: 'control-room.html?view=calendar&fixture=mockup', ready: '#calDesk[data-port-ready]', wait: 800 },
  { page: '11-zoom', design: 'redesign/11-zoom.html', live: 'control-room.html?view=znotes&fixture=mockup', ready: '#zoomDesk[data-port-ready]', wait: 500 },
  { page: '12-completed', design: 'redesign/12-completed.html', live: 'control-room.html?view=done&fixture=mockup', ready: '#doneDesk[data-port-ready]', wait: 400 },
];
const INTER = '<link rel="preconnect" href="https://fonts.googleapis.com"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
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
      if (pathName === '/control-room' || pathName === '/war-room' || pathName === '/notes' || pathName === '/pipeline' || pathName === '/spaces' || pathName === '/documents' || pathName === '/links' || pathName === '/email' || pathName === '/email-board' || pathName === '/playbook' || pathName === '/calendar' || pathName === '/zoom' || pathName === '/completed') {
        pathName = '/control-room.html';
      }
      const tries = [];
      if (pathName.startsWith('/design/')) {
        const rest = pathName.slice('/design/'.length);
        tries.push(join(ROOT, 'design-reference', rest));
        tries.push(join(ROOT, 'design-reference/redesign', rest.endsWith('.html') ? rest : `${rest}.html`));
        tries.push(join(ROOT, 'design-reference/redesign', rest));
      }
      tries.push(join(ROOT, 'public', pathName));
      tries.push(join(ROOT, 'design-reference', pathName));
      tries.push(join(ROOT, 'design-reference/redesign', pathName.replace(/^\//, '')));
      let body = null;
      let used = '';
      for (const abs of tries) {
        try {
          body = readFileSync(abs);
          used = abs;
          break;
        } catch {
          /* next */
        }
      }
      if (!body) {
        res.writeHead(404);
        res.end('not found ' + pathName);
        return;
      }
      if (used.endsWith('.html') && pathName.startsWith('/design/')) {
        let html = body.toString('utf8');
        if (!html.includes('fonts.googleapis.com')) {
          html = html.replace(/<head>/i, `<head>${INTER}`);
        }
        body = Buffer.from(html);
      }
      res.writeHead(200, { 'content-type': MIME[extname(used)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolveServe({ server, port: server.address().port }));
  });
}

function pct(diff, total) {
  return total ? (100 * diff) / total : 0;
}

async function prepare(page) {
  await page.evaluate(() => {
    const clock = document.querySelector('.clock');
    if (clock) {
      clock.textContent = 'Mon, Oct 19 · 10:27 AM Pacific';
      clock.style.color = '#7a86a0';
    }
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
  });
  await page.evaluate(async () => {
    const faces = ['400 16px Inter', '500 16px Inter', '600 13.5px Inter', '700 14px Inter', '800 24px Inter', '900 30px Inter'];
    if (document.fonts && document.fonts.load) {
      await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => {})));
      await document.fonts.ready;
    }
  }).catch(() => {});
  await page.waitForTimeout(300);
}

async function overflowAt(page, url, width, height, ready, extraWait) {
  await page.setViewportSize({ width, height });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (ready) await page.waitForSelector(ready, { timeout: 12000, state: 'attached' }).catch(() => {});
  else await page.waitForSelector('.side .nav, .clock', { timeout: 8000 }).catch(() => {});
  await prepare(page);
  if (extraWait) await page.waitForTimeout(extraWait);
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

async function shot(page, url, ready, extraWait) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (url.includes('fixture=mockup')) {
    await page.waitForSelector(ready, { timeout: 12000, state: 'attached' });
  } else {
    await page.waitForSelector('.side .nav, .clock', { timeout: 8000 }).catch(() => {});
  }
  await prepare(page);
  if (extraWait) await page.waitForTimeout(extraWait);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const buf = await page.screenshot({ type: 'png', fullPage: false });
  return { buf, overflow };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { port, server } = await serve();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const rows = [];
  const overflow1280 = [];
  let failed = 0;
  try {
    for (const spec of PAGES.filter((p) => !ONLY.length || ONLY.includes(p.page))) {
      const page = await context.newPage();
      const designUrl = `http://127.0.0.1:${port}/design/${spec.page}`;
      const liveUrl = `http://127.0.0.1:${port}/${spec.live}`;
      const design = await shot(page, designUrl, spec.ready, spec.wait);
      const live = await shot(page, liveUrl, spec.ready, spec.wait);
      const live1280 = await overflowAt(page, liveUrl, 1280, 900, spec.ready, spec.wait);
      const design1280 = await overflowAt(page, designUrl, 1280, 900, null, spec.wait);
      await page.close();
      const mock = PNG.sync.read(design.buf);
      const livePng = PNG.sync.read(live.buf);
      const w = Math.min(mock.width, livePng.width);
      const h = Math.min(mock.height, livePng.height);
      const a = new PNG({ width: w, height: h });
      const b = new PNG({ width: w, height: h });
      PNG.bitblt(mock, a, 0, 0, w, h, 0, 0);
      PNG.bitblt(livePng, b, 0, 0, w, h, 0, 0);
      const diff = new PNG({ width: w, height: h });
      const n = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.2 });
      const total = w * h;
      const p = pct(n, total);
      const overflow = design.overflow || live.overflow;
      const ok = p < PASS && !overflow && !live1280;
      if (!ok) failed += 1;
      writeFileSync(join(OUT, `${spec.page}-mockup.png`), PNG.sync.write(a));
      writeFileSync(join(OUT, `${spec.page}-live.png`), PNG.sync.write(b));
      writeFileSync(join(OUT, `${spec.page}.png`), PNG.sync.write(diff));
      rows.push({ page: spec.page, pct: p, pass: ok, pixels: n, total, overflow: overflow ? 'yes' : 'no' });
      overflow1280.push({ page: spec.page, live: live1280 ? 'yes' : 'no', design: design1280 ? 'yes' : 'no' });
      console.log(`${spec.page.padEnd(16)} ${p.toFixed(3)}%  overflow1440=${overflow ? 'yes' : 'no'}  overflow1280=${live1280 ? 'yes' : 'no'}  ${ok ? 'PASS' : 'FAIL'}  (${n}/${total})`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  const table = ['page\t% diff\toverflow\tpass/fail'].concat(rows.map((r) => `${r.page}\t${r.pct.toFixed(3)}\t${r.overflow}\t${r.pass ? 'PASS' : 'FAIL'}`)).join('\n');
  const table1280 = ['page\tlive 1280 overflow\tdesign 1280 overflow'].concat(overflow1280.map((r) => `${r.page}\t${r.live}\t${r.design}`)).join('\n');
  writeFileSync(join(OUT, 'results.txt'), table + '\n\n' + table1280 + '\n');
  console.log('\n' + table);
  console.log('\n' + table1280);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
