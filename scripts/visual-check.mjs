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
const PAGES = [
  { page: 'playbook', mockup: 'playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', host: 'v-playbook', css: '/port-css/playbook.css', fixture: '', wait: '.pad.due' },
  { page: 'calendar', mockup: 'calendar.html', live: 'calendar.html', host: '', css: '', fixture: '', from: 'design' },
  { page: 'news', mockup: 'news-redesign.html', live: 'news-redesign.html', host: '', css: '', fixture: '', from: 'design' },
  { page: 'zoom', mockup: 'zoom-redesign.html', live: 'zoom-redesign.html', host: '', css: '', fixture: '', from: 'design', wait: '.mc' },
  { page: 'space-detail', mockup: 'space-detail-redesign.html', live: 'space-detail-redesign.html', host: '', css: '', fixture: '', from: 'design' },
  { page: 'email-board', mockup: 'email-board.html', live: 'email-board.html', host: '', css: '', fixture: '', from: 'design' },
  { page: 'warroom-reorg', mockup: 'warroom-reorg.html', live: 'warroom-reorg.html', host: '', css: '', fixture: '', from: 'design' },
  { page: 'book', mockup: 'book.html', live: 'book.html', host: '', css: '', fixture: '', from: 'design' },
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

function serve(dir) {
  return new Promise((resolveServe) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let path = decodeURIComponent(url.pathname);
      if (path === '/') path = '/index.html';
      try {
        const body = readFileSync(join(dir, path));
        res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolveServe({ server, port: server.address().port }));
  });
}

function pct(diff, total) {
  return total ? (100 * diff) / total : 0;
}

async function paintLive(page, spec, appPort, designPort) {
  const origin = spec.from === 'design' ? designPort : appPort;
  await page.goto(`http://127.0.0.1:${origin}/${spec.live}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(200);
  if (spec.fixture) {
    const html = readFileSync(join(ROOT, 'public/port-fixtures', spec.fixture + '.html'), 'utf8');
    await page.evaluate(async ({ host, html, css }) => {
      document.documentElement.classList.add('fixture-mockup');
      const el = document.getElementById(host);
      if (!el) return;
      el.hidden = false;
      if (host === 'pkgDetail') {
        const grid = document.getElementById('pkgGrid');
        if (grid) grid.hidden = true;
        const top = document.getElementById('spaceTop');
        if (top) top.hidden = true;
      }
      if (window.attachPort && !el.shadowRoot) window.attachPort(host, css);
      if (window.paintMockupFixture) window.paintMockupFixture(host, html, css);
      const link = el.shadowRoot && el.shadowRoot.querySelector('link[rel="stylesheet"]');
      if (link && !link.sheet) await new Promise((resolve) => { link.addEventListener('load', resolve, { once: true }); setTimeout(resolve, 800); });
    }, { host: spec.host, html, css: spec.css });
    await page.waitForTimeout(400);
  } else {
    await page.waitForTimeout(400);
  }
  if (spec.wait) {
    try {
      await page.waitForFunction(({ host, wait }) => {
        const el = host ? document.getElementById(host) : document;
        const root = el && el.shadowRoot ? el.shadowRoot : el;
        return !!(root && root.querySelector && root.querySelector(wait));
      }, spec, { timeout: 5000 });
    } catch (e) {}
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
  });
  return page.screenshot({ type: 'png', fullPage: false });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const [{ port: designPort, server: designServer }, { port: appPort, server: appServer }] = await Promise.all([
    serve(join(ROOT, 'design-reference')),
    serve(join(ROOT, 'public')),
  ]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const rows = [];
  let failed = 0;
  try {
    for (const spec of PAGES) {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${designPort}/${spec.mockup}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.margin = '0';
      });
      const mockBuf = await page.screenshot({ type: 'png', fullPage: false });
      const liveBuf = await paintLive(page, spec, appPort, designPort);
      await page.close();
      const mock = PNG.sync.read(mockBuf);
      const live = PNG.sync.read(liveBuf);
      const w = Math.min(mock.width, live.width);
      const h = Math.min(mock.height, live.height);
      const a = new PNG({ width: w, height: h });
      const b = new PNG({ width: w, height: h });
      PNG.bitblt(mock, a, 0, 0, w, h, 0, 0);
      PNG.bitblt(live, b, 0, 0, w, h, 0, 0);
      const diff = new PNG({ width: w, height: h });
      const n = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.2 });
      const total = w * h;
      const p = pct(n, total);
      const ok = p < PASS;
      if (!ok) failed += 1;
      writeFileSync(join(OUT, `${spec.page}-mockup.png`), PNG.sync.write(a));
      writeFileSync(join(OUT, `${spec.page}-live.png`), PNG.sync.write(b));
      writeFileSync(join(OUT, `${spec.page}-diff.png`), PNG.sync.write(diff));
      rows.push({ page: spec.page, pct: p, pass: ok, pixels: n, total });
      console.log(`${spec.page.padEnd(16)} ${p.toFixed(3)}%  ${ok ? 'PASS' : 'FAIL'}  (${n}/${total})`);
    }
  } finally {
    await browser.close();
    designServer.close();
    appServer.close();
  }
  const table = ['page\t% diff\tpass/fail'].concat(rows.map((r) => `${r.page}\t${r.pct.toFixed(3)}\t${r.pass ? 'PASS' : 'FAIL'}`)).join('\n');
  writeFileSync(join(OUT, 'results.txt'), table + '\n');
  console.log('\n' + table);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
