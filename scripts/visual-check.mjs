import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'visual-diff');
const PASS = 0.5;
const PAGES = [
  { page: '01-dashboard', design: 'redesign/01-dashboard.html', live: 'control-room.html?view=room&fixture=mockup' },
  { page: '02-war-room', design: 'redesign/02-war-room.html', live: 'control-room.html?view=war&fixture=mockup' },
  { page: '03-notes', design: 'redesign/03-notes.html', live: 'control-room.html?view=notes&fixture=mockup' },
];

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
      if ((pathName === '/control-room.html' || pathName === '/control-room' || pathName === '/war-room' || pathName === '/notes') && url.searchParams.get('fixture') === 'mockup') {
        const view = url.searchParams.get('view') || (pathName === '/war-room' ? 'war' : pathName === '/notes' ? 'notes' : 'room');
        const file = { room: '01-dashboard.html', war: '02-war-room.html', notes: '03-notes.html' }[view] || '01-dashboard.html';
        res.writeHead(302, { Location: '/port-fixtures/' + file });
        res.end();
        return;
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
      res.writeHead(200, { 'content-type': MIME[extname(used)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolveServe({ server, port: server.address().port }));
  });
}

function pct(diff, total) {
  return total ? (100 * diff) / total : 0;
}

async function shot(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (url.includes('fixture=mockup')) {
    await page.waitForURL(/\/port-fixtures\//, { timeout: 8000 });
    await page.waitForLoadState('domcontentloaded');
  }
  await page.waitForSelector('.side .nav, .clock', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
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
  await page.waitForTimeout(200);
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
  let failed = 0;
  try {
    for (const spec of PAGES) {
      const page = await context.newPage();
      const designUrl = `http://127.0.0.1:${port}/design/${spec.page}`;
      const liveUrl = `http://127.0.0.1:${port}/${spec.live}`;
      await page.setViewportSize({ width: 1440, height: 900 });
      const design = await shot(page, designUrl);
      const live = await shot(page, liveUrl);
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
      const ok = p < PASS && !overflow;
      if (!ok) failed += 1;
      writeFileSync(join(OUT, `${spec.page}-mockup.png`), PNG.sync.write(a));
      writeFileSync(join(OUT, `${spec.page}-live.png`), PNG.sync.write(b));
      writeFileSync(join(OUT, `${spec.page}.png`), PNG.sync.write(diff));
      rows.push({ page: spec.page, pct: p, pass: ok, pixels: n, total, overflow: overflow ? 'yes' : 'no' });
      console.log(`${spec.page.padEnd(16)} ${p.toFixed(3)}%  overflow=${overflow ? 'yes' : 'no'}  ${ok ? 'PASS' : 'FAIL'}  (${n}/${total})`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  const table = ['page\t% diff\toverflow\tpass/fail'].concat(rows.map((r) => `${r.page}\t${r.pct.toFixed(3)}\t${r.overflow}\t${r.pass ? 'PASS' : 'FAIL'}`)).join('\n');
  writeFileSync(join(OUT, 'results.txt'), table + '\n');
  console.log('\n' + table);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
