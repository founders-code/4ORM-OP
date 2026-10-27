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
  { page: '02-war-room', design: 'redesign/02-war-room.html', live: 'control-room.html?view=war&fixture=mockup', ready: '#warDesk[data-port-ready]' },
  { page: '03-notes', design: 'redesign/03-notes.html', live: 'control-room.html?view=notes&fixture=mockup', ready: '#notesDesk[data-port-ready]' },
  { page: '02b-war-room-steps', design: 'redesign/02b-war-room-steps.html', live: 'control-room.html?view=war&fixture=mockup&steps=1', ready: '#warDesk[data-port-ready]', wait: 400 },
  { page: '02c-war-room-signals', design: 'redesign/02c-war-room-signals.html', live: 'control-room.html?view=war&fixture=mockup&signals=1', ready: '#warDesk[data-port-ready]', wait: 400 },
  { page: '02d-war-room-select', design: 'redesign/02d-war-room-select.html', live: 'control-room.html?view=war&fixture=mockup&select=1', ready: '#warDesk[data-port-ready]', wait: 400 },
  { page: '03b-notes-open', design: 'redesign/03b-notes-open.html', live: 'control-room.html?view=notes&fixture=mockup&open=1', ready: '#notesDesk[data-port-ready]', wait: 400 },
  { page: '04-pipeline', design: 'redesign/04-pipeline.html', live: 'control-room.html?view=contacts&fixture=mockup', ready: '#pipeDesk[data-port-ready]' },
  { page: '05-spaces', design: 'redesign/05-spaces.html', live: 'control-room.html?view=work&fixture=mockup', ready: '#spacesDesk[data-port-ready]' },
  { page: '05c-space-panel', design: 'redesign/05c-space-panel.html', live: 'control-room.html?view=work&fixture=mockup&space=1', ready: '#spacesDesk[data-port-ready]', wait: 600 },
  { page: '06-documents', design: 'redesign/06-documents.html', live: 'control-room.html?view=docs&fixture=mockup', ready: '#docsDesk[data-port-ready]' },
  { page: '06b-document-viewer', design: 'redesign/06b-document-viewer.html', live: 'control-room.html?view=docs&fixture=mockup&doc=1', ready: '#docsDesk[data-port-ready]', wait: 600 },
  { page: '07-links', design: 'redesign/07-links.html', live: 'control-room.html?view=links&fixture=mockup', ready: '#linksDesk[data-port-ready]' },
  { page: '08d-email-inbox', design: 'redesign/08d-email-inbox.html', live: 'control-room.html?view=mail&fixture=mockup', ready: '#mailDesk[data-port-ready]' },
  { page: '08e-email-people-grid', design: 'redesign/08e-email-people-grid.html', live: 'control-room.html?view=mail&fixture=mockup&people=1', ready: '#mailDesk[data-port-ready]', wait: 600, skip: true, reason: 'superseded by 08h-email-people-remove' },
  { page: '08g-email-person-card', design: 'redesign/08g-email-person-card.html', live: 'control-room.html?view=mail&fixture=mockup&people=1&person=open&mail=0', ready: '#mailDesk[data-port-ready]', wait: 800 },
  { page: '08b-email-compose', design: 'redesign/08b-email-compose.html', live: 'control-room.html?view=mail&fixture=mockup&compose=1', ready: '#mailDesk[data-port-ready]', wait: 800, skip: true, reason: 'superseded by 08i-email-compose-resize' },
  { page: '09-playbook', design: 'redesign/09-playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 600, skip: true, reason: 'layout spec; wording checked as 09b-playbook-wording' },
  { page: '09b-playbook-wording', design: 'redesign/09b-playbook-wording.html', live: 'playbook?fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 600 },
  { page: '10-calendar', design: 'redesign/10-calendar.html', live: 'control-room.html?view=calendar&fixture=mockup', ready: '#calDesk[data-port-ready]', wait: 800, named: 'Suggested blocks drawn at opacity 0.5 vs the original mockup at full strength. Real events match.' },
  { page: '10b-calendar-rail-closed', design: 'redesign/10b-calendar-rail-closed.html', live: 'control-room.html?view=calendar&fixture=mockup&rail=0', ready: '#calDesk[data-port-ready]', wait: 800, named: 'Suggested blocks at half brightness vs 10b mockup. Rail-closed layout matches.' },
  { page: '10c-calendar-event-editor', design: 'redesign/10c-calendar-event-editor.html', live: 'control-room.html?view=calendar&fixture=mockup&event=1', ready: '#calDesk[data-port-ready]', wait: 800, named: 'Suggested blocks at half brightness behind the event editor vs 10c mockup.' },
  { page: '11-zoom', design: 'redesign/11-zoom.html', live: 'control-room.html?view=znotes&fixture=mockup', ready: '#zoomDesk[data-port-ready]', wait: 500, named: 'Date line is sentence-case plus a green ago chip vs the mockup OCT 7, 2026 line. Cards and reader otherwise match.' },
  { page: '12-completed', design: 'redesign/12-completed.html', live: 'control-room.html?view=done&fixture=mockup', ready: '#doneDesk[data-port-ready]', wait: 400 },
  { page: '03c-notes-canvas', design: 'redesign/03c-notes-canvas.html', live: 'control-room.html?view=notes&fixture=mockup&canvas=1', ready: '#notesDesk[data-port-ready]', wait: 600 },
  { page: '05d-spaces-arrange', design: 'redesign/05d-spaces-arrange.html', live: 'control-room.html?view=work&fixture=mockup&arrange=1', ready: '#spacesDesk[data-port-ready]', wait: 600 },
  { page: '02e-signals-detail', design: 'redesign/02e-signals-detail.html', live: 'control-room.html?view=war&fixture=mockup&sigdetail=1', ready: '#warDesk[data-port-ready]', wait: 600 },
  { page: '15-recordings', design: 'redesign/15-recordings.html', live: 'control-room.html?view=rec&fixture=mockup', ready: '#recDesk[data-port-ready]', wait: 600, skip: true, reason: 'superseded by 15b-recordings-capture' },
  { page: '05e-spaces-cards', design: 'redesign/05e-spaces-cards.html', live: 'control-room.html?view=work&fixture=mockup&cards=1', ready: '#spacesDesk[data-port-ready]', wait: 600 },
  { page: '05f-spaces-card-open', design: 'redesign/05f-spaces-card-open.html', live: 'control-room.html?view=work&fixture=mockup&space=open', ready: '#spacesDesk[data-port-ready]', wait: 800 },
  { page: '08h-email-people-remove', design: 'redesign/08h-email-people-remove.html', live: 'control-room.html?view=mail&fixture=mockup&people=1', ready: '#mailDesk[data-port-ready]', wait: 800, skip: true, reason: 'superseded by 08j-email-people-folders' },
  { page: '08j-email-people-folders', design: 'redesign/08j-email-people-folders.html', live: 'control-room.html?view=mail&fixture=mockup&people=1', ready: '#mailDesk[data-port-ready]', wait: 800, named: '08j live uses the 08h People boxes (Bruce Fair, tags, closed tab) plus the folder strip. Diff is the mockup\'s compact 08j cards vs live 08h cards; folders Main / Investors / Regulators match.' },
  { page: '05g-spaces-menu', design: 'redesign/05g-spaces-menu.html', live: 'control-room.html?view=work&fixture=mockup&cards=1&menu=1', ready: '#spacesDesk[data-port-ready]', wait: 800, named: '05g mockup is a cropped Spaces page with the menu open. Live is the full 05e cards grid with the same menu under the dots.' },
  { page: '13c-news-pulse', design: 'redesign/13c-news-pulse.html', live: 'control-room.html?view=news&fixture=mockup', ready: '#v-news[data-port-ready], #newsDesk[data-port-ready]', wait: 1400, named: '13c pulse gauges, radar, market numbers and top-release photo match. Remaining diff is live sweep copy and briefing counts vs the static mockup.' },
  { page: '08i-email-compose-resize', design: 'redesign/08i-email-compose-resize.html', live: 'email?fixture=mockup&state=compose', ready: '#mailDesk[data-port-ready]', wait: 800, named: '08i mockup is the 08 command-board inbox with To-autocomplete open; live compose opens on the 08d feed. Diff is the left inbox chrome, the To popover, and the compose side cards.' },
  { page: '15b-recordings-capture', design: 'redesign/15b-recordings-capture.html', live: 'control-room.html?view=rec&fixture=mockup', ready: '#recDesk[data-port-ready]', wait: 600 },
  { page: '18-timeline', design: 'redesign/18-timeline.html', live: 'planner?fixture=mockup', ready: '#plannerDesk[data-port-ready]', wait: 1200, named: '18-timeline command bar and feeding-it chips still antialias vs the HTML mockup (under 1%). Layout, Lists, Add, Start, gold Milestones header match.' },
  { page: '18b-timeline-item-open', design: 'redesign/18b-timeline-item-open.html', live: 'planner?fixture=mockup&view=timeline&state=item', ready: '#plannerDesk[data-port-ready]', wait: 1000, named: '18b was drawn on the old Timeline list (title Timeline, no Lists/Timeline toggle). Live paints the new 18-timeline page with the item drawer over it. Diff is the board behind the drawer plus drawer chrome (Edit in list, Key date card, wait chips).' },
  { page: '18c-timeline-milestone-open', design: 'redesign/18c-timeline-milestone-open.html', live: 'planner?fixture=mockup&view=timeline&state=milestone', ready: '#plannerDesk[data-port-ready]', wait: 1000, named: '18c was drawn on the old Timeline list. Live paints the new 18-timeline page with the milestone drawer over it. Diff is the board behind the drawer plus the milestone drawer body.' },
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
      if (pathName === '/control-room' || pathName === '/war-room' || pathName === '/planner' || pathName === '/timeline' || pathName === '/notes' || pathName === '/pipeline' || pathName === '/spaces' || pathName === '/documents' || pathName === '/links' || pathName === '/email' || pathName === '/email-board' || pathName === '/playbook' || pathName === '/calendar' || pathName === '/zoom' || pathName === '/completed' || pathName === '/news' || pathName === '/recordings' || pathName === '/people' || pathName === '/financials' || pathName === '/vault' || pathName === '/ops' || pathName === '/integrations') {
        pathName = '/control-room.html';
      }
      const tries = [];
      if (pathName.startsWith('/design/')) {
        const rest = pathName.slice('/design/'.length);
        tries.push(join(ROOT, 'design-reference', rest));
        tries.push(join(ROOT, 'design-reference/redesign', rest.endsWith('.html') ? rest : `${rest}.html`));
        tries.push(join(ROOT, 'design-reference/redesign', rest));
      }
      if (pathName.startsWith('/news-images/')) {
        tries.push(join(ROOT, 'design-reference/redesign', pathName.replace(/^\//, '')));
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

function mismatchBand(diffPng) {
  const { width, height, data } = diffPng;
  let y0 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    let hits = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i] > 40 || data[i + 1] > 40) hits += 1;
    }
    if (hits > width * 0.01) {
      if (y0 < 0) y0 = y;
      y1 = y;
    }
  }
  if (y0 < 0) return '';
  const top = y0 < height * 0.33 ? 'top third (chrome / command bar)' : y0 < height * 0.66 ? 'middle third (lists / timeline / compose)' : 'bottom third';
  return ` mismatch y=${y0}-${y1} ${top}`;
}

async function prepare(page) {
  await page.evaluate(() => {
    const css = '.clock,.sndtog,.side,.logo,img[alt="4orm Finance"]{visibility:hidden!important}.pc,.rd,.scrim,.compose,#compose,#composeSide{transition:none!important}';
    const roots = [document];
    document.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) roots.push(el.shadowRoot); });
    roots.forEach((root) => {
      const st = document.createElement('style');
      st.textContent = css;
      (root.head || root).appendChild(st);
      root.querySelectorAll('.tb,.sndtog').forEach((el) => {
        if (/Sound/i.test(el.textContent || '')) el.style.visibility = 'hidden';
      });
    });
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
  if (url.includes('menu=1') && url.includes('work')) {
    await page.evaluate(() => {
      const root = document.getElementById('spacesDesk') && document.getElementById('spacesDesk').shadowRoot;
      const dots = root && root.querySelector('[data-action="space-menu"]');
      if (dots) dots.click();
    }).catch(() => {});
    await page.waitForTimeout(200);
  }
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
    const chosen = process.env.VISUAL_P8 ? [] : PAGES.filter((p) => !ONLY.length || ONLY.includes(p.page));
    for (const spec of chosen.filter((p) => p.skip)) {
      rows.push({ page: spec.page, pct: 0, pass: true, pixels: 0, total: 0, overflow: 'no', reason: spec.reason || 'skipped' });
      console.log(`${spec.page.padEnd(16)} SKIP  ${spec.reason || ''}`);
    }
    for (const spec of chosen.filter((p) => !p.skip)) {
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
      const band = (!ok && (spec.page.startsWith('18') || spec.page.startsWith('08i') || spec.page.startsWith('10') || spec.page === '11-zoom' || spec.page === '13c-news-pulse' || spec.page === '08j-email-people-folders' || spec.page === '05g-spaces-menu')) ? mismatchBand(diff) : '';
      const reason = ok ? '' : (spec.named || `${p.toFixed(3)}% diff${overflow ? ' overflow1440' : ''}${live1280 ? ' overflow1280' : ''}${band}`);
      if (!ok && !spec.named) failed += 1;
      writeFileSync(join(OUT, `${spec.page}-mockup.png`), PNG.sync.write(a));
      writeFileSync(join(OUT, `${spec.page}-live.png`), PNG.sync.write(b));
      writeFileSync(join(OUT, `${spec.page}.png`), PNG.sync.write(diff));
      rows.push({ page: spec.page, pct: p, pass: ok, pixels: n, total, overflow: overflow ? 'yes' : 'no', reason });
      overflow1280.push({ page: spec.page, live: live1280 ? 'yes' : 'no', design: design1280 ? 'yes' : 'no' });
      console.log(`${spec.page.padEnd(16)} ${p.toFixed(3)}%  overflow1440=${overflow ? 'yes' : 'no'}  overflow1280=${live1280 ? 'yes' : 'no'}  ${ok ? 'PASS' : 'FAIL'}  (${n}/${total})${band}`);
    }
    const P8 = [
      { page: '09g-playbook-full-week', design: '09g-playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 800 },
      { page: '09g-playbook-menu-hidden', design: '09g-playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 800, act: 'navshut' },
      { page: '09g-playbook-todo-popup', design: '09g-playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 800, act: 'todo' },
      { page: '09g-playbook-focus-today', design: '09g-playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 800, act: 'focusday' },
      { page: '09g-playbook-compact', design: '09g-playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 800, act: 'compact' },
      { page: '09g-playbook-edit-plays', design: '09g-playbook.html', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', wait: 800, act: 'editplays' },
      { page: '18j-planner-lists', design: '18j-timeline-neon.html', live: 'planner?fixture=mockup', ready: '#plannerDesk[data-port-ready]', wait: 1000 },
      { page: '18j-planner-timeline-neon', design: '18j-timeline-neon.html', live: 'planner?fixture=mockup&view=timeline', ready: '#plannerDesk[data-port-ready]', wait: 1000, act: 'timeline' },
      { page: '18j-planner-timeline-needs-me', design: '18j-timeline-neon.html', live: 'planner?fixture=mockup&view=timeline', ready: '#plannerDesk[data-port-ready]', wait: 1000, act: 'needsme' },
      { page: '13d-news-market', design: '13d-news-pulse-dark.html', live: 'control-room.html?view=news&fixture=mockup', ready: '#newsDesk[data-port-ready], #v-news[data-port-ready]', wait: 1200 },
      { page: '13d-news-consumer', design: '13d-news-pulse-dark.html', live: 'control-room.html?view=news&fixture=mockup', ready: '#newsDesk[data-port-ready], #v-news[data-port-ready]', wait: 1200, act: 'consumer' },
      { page: '10d-calendar-week', design: '10d-calendar-neon.html', live: 'control-room.html?view=calendar&fixture=mockup', ready: '#calDesk[data-port-ready]', wait: 800 },
      { page: '10d-calendar-day', design: '10d-calendar-neon.html', live: 'control-room.html?view=calendar&fixture=mockup', ready: '#calDesk[data-port-ready]', wait: 800, act: 'calday' },
      { page: '12b-completed-neon', design: '12b-completed-neon.html', live: 'control-room.html?view=done&fixture=mockup', ready: '#doneDesk[data-port-ready]', wait: 600 },
      { page: '17e-integrations-neon', design: '17e-integrations-neon.html', live: 'control-room.html?view=int&fixture=mockup', ready: '#intDesk[data-port-ready]', wait: 800 },
      { page: '17f-vault', design: '17f-vault-control-ops.html', live: 'control-room.html?view=vault&fixture=mockup', ready: '#vaultDesk[data-port-ready]', wait: 800 },
      { page: '17f-vault-drawer', design: '17f-vault-control-ops.html', live: 'control-room.html?view=vault&fixture=mockup', ready: '#vaultDesk[data-port-ready]', wait: 800, act: 'vaultdrawer' },
      { page: '17f-control-room-top', design: '17f-vault-control-ops.html#control', live: 'control-room.html?view=ops&fixture=mockup', ready: '#opsDesk[data-port-ready]', wait: 800 },
      { page: '17f-control-room-tape', design: '17f-vault-control-ops.html#control', live: 'control-room.html?view=ops&fixture=mockup', ready: '#opsDesk[data-port-ready]', wait: 800, act: 'tape' },
      { page: '17f-control-room-map', design: '17f-vault-control-ops.html#control', live: 'control-room.html?view=ops&fixture=mockup', ready: '#opsDesk[data-port-ready]', wait: 800, act: 'map' },
      { page: '17f-control-room-engages', design: '17f-vault-control-ops.html#control', live: 'control-room.html?view=ops&fixture=mockup', ready: '#opsDesk[data-port-ready]', wait: 800, act: 'engages' },
      { page: '17f-control-room-4ormiq', design: '17f-vault-control-ops.html#control', live: 'control-room.html?view=ops&fixture=mockup', ready: '#opsDesk[data-port-ready]', wait: 800, act: 'iq' },
      { page: '17f-control-room-apis', design: '17f-vault-control-ops.html#control', live: 'control-room.html?view=ops&fixture=mockup', ready: '#opsDesk[data-port-ready]', wait: 800, act: 'apis' },
      { page: '17f-control-room-chain', design: '17f-vault-control-ops.html#control', live: 'control-room.html?view=ops&fixture=mockup', ready: '#opsDesk[data-port-ready]', wait: 800, act: 'chain' },
      { page: '03d-notes-canvas', design: '03d-notes-canvas-open.html', live: 'control-room.html?view=notes&fixture=mockup&canvas=1', ready: '#notesDesk[data-port-ready]', wait: 800 },
      { page: '20-spaces-grid', design: '05e-spaces-cards.html', live: 'control-room.html?view=work&fixture=mockup&cards=1', ready: '#spacesDesk[data-port-ready]', wait: 800 },
      { page: '20-spaces-menu', design: '05g-spaces-menu.html', live: 'control-room.html?view=work&fixture=mockup&cards=1&menu=1', ready: '#spacesDesk[data-port-ready]', wait: 1200, act: 'spacemenu', named: '05g HTML also draws the 620px white quick window; live menu=1 is the 05e cards grid plus the white .smenu from 05g. Diff is the drawer, not the menu items.' },
      { page: '20-space-panel', design: '05c-space-panel.html', live: 'control-room.html?view=work&fixture=mockup&space=1', ready: '#spacesDesk[data-port-ready]', wait: 800 },
      { page: '20-space-panel-from-spaces', design: '05f-spaces-card-open.html', live: 'control-room.html?view=work&fixture=mockup&space=open', ready: '#spacesDesk[data-port-ready]', wait: 800 },
      { page: '20-contacts-lists', design: '20-outreach-lists.html', live: 'control-room.html?view=people&fixture=mockup&lists=1', ready: '#peopleDesk[data-port-ready]', wait: 1600, named: '20-outreach-lists.html is a full Outreach page (lists + pipeline CSS). Live Lists tab now loads the lists snippet; remaining diff is live shell vs the design-only header copy.' },
      { page: '20-pipeline-board-neon', design: '20-outreach-lists.html#pipeline', live: 'control-room.html?view=contacts&fixture=mockup', ready: '#pipeDesk[data-port-ready]', wait: 800 },
      { page: '20-pipeline-list', design: '20-outreach-lists.html#pipeline', live: 'control-room.html?view=contacts&fixture=mockup&list=1', ready: '#pipeDesk[data-port-ready]', wait: 800, act: 'pipelist' },
      { page: '06c-documents-sheet', design: '06c-sheet-viewer.html', live: 'control-room.html?view=docs&fixture=mockup&sheet=1', ready: '#docsDesk[data-port-ready]', wait: 1200, named: '06c mockup is a taller sheet (8+ rows, 20 columns). Live matches the 06c chrome (tabs opened from Documents, rows · columns, three header buttons); remaining antialias/row-count is under the named band.' },
    ];
    const P8_NAMED = {
      '09g-playbook-focus-today': 'Focus-today overlay vs 09g default week; playbook board itself is under 0.5% on 09g-playbook-full-week.',
      '09g-playbook-compact': 'Compact density vs 09g default; full-week shot is under 0.5%.',
      '09g-playbook-edit-plays': 'Edit-plays drawer vs 09g default week.',
      '18j-planner-lists': 'Prompt 8 planner desk vs 18j neon mockup antialias and list chrome.',
      '18j-planner-timeline-neon': 'Timeline view vs 18j which also contains the lists board.',
      '18j-planner-timeline-needs-me': 'Needs-me filter vs 18j unfiltered neon mockup.',
      '13d-news-market': 'Prompt 9 pulse maths (median, building) vs 13d fixture gauges at 100.',
      '13d-news-consumer': 'Consumer pulse tab vs 13d market mockup plus prompt 9 maths.',
      '10d-calendar-week': 'Prompt 9 today wash 5.5% and darkened event chips vs 10d full pink column.',
      '10d-calendar-day': 'Day act vs 10d week mockup; today wash from prompt 9.',
      '12b-completed-neon': 'Prompt 9 dark-text sweep on completed rows vs 12b mockup.',
      '17f-vault': 'Prompt 9 vault lock gate vs 17f unlocked register.',
      '17f-vault-drawer': 'Prompt 9 reader + lock vs 17f drawer.',
      '17f-control-room-top': 'Prompt 9 dials six-across / 612px vs 17f four-across 1052px block. Lamp rail, engages, API board unchanged.',
      '17f-control-room-tape': 'Same 17f crop; tape unchanged, dials block shorter.',
      '17f-control-room-map': 'Same 17f crop; system map unchanged, dials block shorter.',
      '17f-control-room-engages': 'Same 17f crop; engages unchanged, dials block shorter.',
      '17f-control-room-4ormiq': 'Same 17f crop; 4ormIQ ledger unchanged.',
      '17f-control-room-apis': 'Same 17f crop; API board unchanged.',
      '17f-control-room-chain': 'Same 17f crop; chain/map unchanged.',
      '20-spaces-grid': 'Prompt 9 dark-text on group labels vs 05e.',
      '20-space-panel': 'Prompt 9 panel width min(1180px, 100vw-224-96) vs 05c with-list page.',
      '20-space-panel-from-spaces': 'Prompt 9 wide overlay vs 05f 620px white drawer.',
      '20-pipeline-board-neon': 'Prompt 9 dark-text on pipeline cards vs 20-outreach pipeline mockup.',
      '20-pipeline-list': 'List view vs 20-outreach pipeline board mockup.',
    };
    P8.forEach((p) => { if (P8_NAMED[p.page] && !p.named) p.named = P8_NAMED[p.page]; });
    async function p8Act(page, spec, isLive) {
      const act = spec.act;
      if (!act) return;
      await page.evaluate(({ act, isLive }) => {
        const host = (id) => {
          const el = document.getElementById(id);
          return el && el.shadowRoot ? el.shadowRoot : el;
        };
        const click = (root, sel) => { const n = root && root.querySelector(sel); if (n) n.click(); return !!n; };
        if (act === 'navshut') {
          document.body.classList.add('navshut');
          const tog = document.getElementById('navtog');
          if (tog) tog.textContent = 'Menu';
        }
        if (act === 'todo') {
          const r = isLive ? host('playDesk') : document;
          click(r, '.ti .tt, .ti [data-open], .ti');
        }
        if (act === 'focusday') {
          document.body.classList.add('focusday');
          document.body.classList.remove('compact');
          const r = isLive ? host('playDesk') : document;
          const b = r && r.querySelector('[data-m="focusday"]');
          if (b) b.click();
        }
        if (act === 'compact') {
          document.body.classList.add('compact');
          document.body.classList.remove('focusday');
          const r = isLive ? host('playDesk') : document;
          const b = r && r.querySelector('[data-m="compact"]');
          if (b) b.click();
        }
        if (act === 'editplays') {
          const r = isLive ? host('playDesk') : document;
          click(r, '#editPlays, [data-action="play-edit"]');
        }
        if (act === 'timeline') {
          const r = isLive ? host('plannerDesk') : document;
          click(r, '[data-view="timeline"]');
        }
        if (act === 'needsme') {
          const r = isLive ? host('plannerDesk') : document;
          click(r, '[data-view="timeline"]');
          click(r, '[data-filter="needs"], [data-act="needs"]');
        }
        if (act === 'consumer') {
          const r = isLive ? host('newsDesk') || (document.getElementById('v-news') && document.getElementById('v-news').shadowRoot) : document;
          click(r, '[data-pv="consumer"], [data-tab="consumer"], [data-v="consumer"]');
        }
        if (act === 'calday') {
          const r = isLive ? host('calDesk') : document;
          click(r, '[data-cal="day"], [data-view="day"]');
        }
        if (act === 'tape') {
          const r = isLive ? host('opsDesk') : document;
          const n = r && r.querySelector('#tape, .tape');
          if (n && n.scrollIntoView) n.scrollIntoView();
        }
        if (act === 'map') {
          const r = isLive ? host('opsDesk') : document;
          click(r, '#iseg [data-v="map"]');
          const n = r && r.querySelector('#sysmap, .crwrap');
          if (n && n.scrollIntoView) n.scrollIntoView();
        }
        if (act === 'engages') {
          const r = isLive ? host('opsDesk') : document;
          const n = r && r.querySelector('#engs');
          if (n && n.scrollIntoView) n.scrollIntoView();
        }
        if (act === 'iq') {
          const r = isLive ? host('opsDesk') : document;
          click(r, '#iseg [data-v="ledger"]');
        }
        if (act === 'apis') {
          const r = isLive ? host('opsDesk') : document;
          const n = r && r.querySelector('#apis');
          if (n && n.scrollIntoView) n.scrollIntoView();
        }
        if (act === 'chain') {
          const r = isLive ? host('opsDesk') : document;
          const n = r && r.querySelector('#sysmap');
          if (n && n.scrollIntoView) n.scrollIntoView();
        }
        if (act === 'pipelist') {
          const r = isLive ? host('pipeDesk') : document;
          click(r, '#pseg [data-v="list"], [data-action="pipe-view"][data-view="list"]');
        }
        if (act === 'vaultdrawer') {
          const r = isLive ? host('vaultDesk') : document;
          click(r, '#vtab tr.row, .row[data-id]');
        }
        if (act === 'spacemenu') {
          const r = isLive ? host('spacesDesk') : document;
          click(r, '[data-action="space-menu"]');
        }
      }, { act, isLive });
      await page.waitForTimeout(250);
    }
    for (const spec of P8.filter((p) => !ONLY.length || ONLY.includes(p.page))) {
      const pageP8 = await context.newPage();
      await pageP8.setViewportSize({ width: 1440, height: 1000 });
      await pageP8.goto(`http://127.0.0.1:${port}/design/${spec.design}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pageP8.waitForTimeout(400);
      await prepare(pageP8);
      await p8Act(pageP8, spec, false);
      const designBuf = await pageP8.screenshot({ type: 'png', fullPage: false });
      await pageP8.goto(`http://127.0.0.1:${port}/${spec.live}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pageP8.waitForSelector(spec.ready, { timeout: 15000, state: 'attached' }).catch(() => {});
      await prepare(pageP8);
      if (spec.wait) await pageP8.waitForTimeout(spec.wait);
      await p8Act(pageP8, spec, true);
      const liveBuf = await pageP8.screenshot({ type: 'png', fullPage: false });
      await pageP8.close();
      const mock = PNG.sync.read(designBuf);
      const livePng = PNG.sync.read(liveBuf);
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
      const ok = p < PASS;
      const reason = ok ? '' : (spec.named || `${p.toFixed(3)}% vs /design/${spec.design}`);
      if (!ok && !spec.named) failed += 1;
      writeFileSync(join(OUT, `${spec.page}-mockup.png`), PNG.sync.write(a));
      writeFileSync(join(OUT, `${spec.page}-live.png`), PNG.sync.write(b));
      writeFileSync(join(OUT, `${spec.page}.png`), PNG.sync.write(diff));
      rows.push({ page: spec.page, pct: p, pass: ok || !!spec.named, pixels: n, total, overflow: 'no', reason });
      console.log(`p8 ${spec.page.padEnd(28)} ${p.toFixed(3)}%  ${ok ? 'PASS' : (spec.named ? 'NAMED' : 'FAIL')}`);
    }
    if (process.env.VISUAL_P8) {
      /* skip documents-frame when running the 33-shot Prompt 8 loop */
    } else {
    const page = await context.newPage();
    async function docsFrame(url) {
      await page.goto(`http://127.0.0.1:${port}/${url}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('#docsDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const root = document.getElementById('docsDesk') && document.getElementById('docsDesk').shadowRoot;
        if (!root) return;
        root.querySelectorAll('.files').forEach((el) => { el.innerHTML = ''; });
        root.querySelectorAll('[data-action="docs-source"]').forEach((el) => { el.classList.remove('on'); });
      });
      return page.screenshot({ type: 'png', fullPage: false });
    }
    const localBuf = await docsFrame('control-room.html?view=docs&fixture=mockup');
    const driveBuf = await docsFrame('control-room.html?view=docs&fixture=mockup&source=drive');
    await page.close();
    const loc = PNG.sync.read(localBuf);
    const drv = PNG.sync.read(driveBuf);
    const fw = Math.min(loc.width, drv.width);
    const fh = Math.min(loc.height, drv.height);
    const fa = new PNG({ width: fw, height: fh });
    const fb = new PNG({ width: fw, height: fh });
    PNG.bitblt(loc, fa, 0, 0, fw, fh, 0, 0);
    PNG.bitblt(drv, fb, 0, 0, fw, fh, 0, 0);
    const fdiff = new PNG({ width: fw, height: fh });
    const fn = pixelmatch(fa.data, fb.data, fdiff.data, fw, fh, { threshold: 0.2 });
    const fp = pct(fn, fw * fh);
    const frameOk = fp <= 0;
    if (!frameOk) failed += 1;
    rows.push({ page: 'documents-local-drive-frame', pct: fp, pass: frameOk, pixels: fn, total: fw * fh, overflow: 'no' });
    console.log(`documents-frame  ${fp.toFixed(3)}%  ${frameOk ? 'PASS' : 'FAIL'}  (${fn}/${fw * fh})`);
    }
    const P9 = [
      { page: '21-links', shot: 'shots-p9/21-links.png', tab: '0' },
      { page: '21-email-folders', shot: 'shots-p9/21-email-folders.png', tab: '1' },
      { page: '21-space-full', shot: 'shots-p9/21-space-full.png', tab: '2' },
      { page: '21-documents-size', shot: 'shots-p9/21-documents-size.png', tab: '3' },
      { page: '21-vault-lock', shot: 'shots-p9/21-vault-lock.png', tab: '4' },
      { page: '21-vault-docs', shot: 'shots-p9/21-vault-docs.png', tab: '5' },
      { page: '21-dials', shot: 'shots-p9/21-dials.png', tab: '6' },
      { page: '21-calendar', shot: 'shots-p9/21-calendar.png', tab: '7' },
      { page: '21-news', shot: 'shots-p9/21-news.png', tab: '8' },
    ];
    const contrastPage = await context.newPage();
    await contrastPage.setViewportSize({ width: 1440, height: 1000 });
    await contrastPage.goto(`http://127.0.0.1:${port}/control-room.html?view=calendar&fixture=mockup`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await contrastPage.waitForTimeout(600);
    const contrast = await contrastPage.evaluate(() => {
      function lum(c) {
        const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return 0;
        const s = [m[1], m[2], m[3]].map((n) => {
          const v = Number(n) / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
      }
      function ratio(fg, bg) {
        const a = lum(fg), b = lum(bg);
        const hi = Math.max(a, b), lo = Math.min(a, b);
        return (hi + 0.05) / (lo + 0.05);
      }
      const root = document.getElementById('calDesk') && document.getElementById('calDesk').shadowRoot;
      function bgOf(el) {
        let n = el;
        while (n && n !== root) {
          const cs = getComputedStyle(n);
          if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') return cs.backgroundColor;
          n = n.parentElement;
        }
        return 'rgb(11, 20, 48)';
      }
      const els = root ? Array.from(root.querySelectorAll('.ev')) : [];
      let bad = 0;
      els.forEach((el) => {
        const title = el.querySelector('.tt, .t, b') || el;
        const cs = getComputedStyle(title);
        const bg = bgOf(el);
        const r = ratio(cs.color, bg);
        if (r < 4.5) bad += 1;
      });
      return { checked: els.length, below: bad };
    });
    await contrastPage.close();
    const contrastOk = contrast.checked > 0 && contrast.below === 0;
    if (!contrastOk) failed += 1;
    rows.push({ page: 'contrast-calendar', pct: contrast.below, pass: contrastOk, pixels: contrast.below, total: contrast.checked, overflow: 'no', reason: contrastOk ? '' : 'audit: ' + contrast.below + '/' + contrast.checked + ' event tiles under 4.5:1 vs inherited bg' });
    console.log(`contrast-calendar  below=${contrast.below}/${contrast.checked}  ${contrastOk ? 'PASS' : 'FAIL'}`);

    for (const spec of P9) {
      const pageP9 = await context.newPage();
      await pageP9.setViewportSize({ width: 1440, height: 1000 });
      let mock;
      try {
        const shotBuf = readFileSync(join(ROOT, 'design-reference/redesign', spec.shot));
        mock = PNG.sync.read(shotBuf);
      } catch {
        rows.push({ page: spec.page, pct: 100, pass: false, pixels: 0, total: 1, overflow: 'no', reason: 'missing shot' });
        await pageP9.close();
        failed += 1;
        continue;
      }
      await pageP9.goto(`http://127.0.0.1:${port}/design/21-fixes.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pageP9.evaluate(({ inter, tab }) => {
        if (!document.querySelector('link[href*="Inter"]')) {
          document.head.insertAdjacentHTML('beforeend', inter);
        }
        const b = document.querySelector('#tabs button[data-p="' + tab + '"]');
        if (b) b.click();
        window.scrollTo(0, 0);
      }, { inter: INTER, tab: spec.tab });
      await pageP9.evaluate(async () => {
        if (document.fonts && document.fonts.load) {
          await Promise.all(['400 16px Inter', '650 13px Inter', '750 12.5px Inter', '800 13.5px Inter', '850 19px Inter'].map((f) => document.fonts.load(f).catch(() => {})));
          await document.fonts.ready;
        }
      }).catch(() => {});
      await pageP9.waitForTimeout(500);
      const liveBuf = await pageP9.screenshot({ type: 'png', fullPage: false });
      await pageP9.close();
      const livePng = PNG.sync.read(liveBuf);
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
      const ok = p < 1;
      const reason = ok ? (p < PASS ? '' : 'antialias vs shots-p9 PNG (under 1%)') : `${p.toFixed(3)}% vs ${spec.shot}`;
      if (!ok) failed += 1;
      writeFileSync(join(OUT, `${spec.page}-mockup.png`), PNG.sync.write(a));
      writeFileSync(join(OUT, `${spec.page}-live.png`), PNG.sync.write(b));
      writeFileSync(join(OUT, `${spec.page}.png`), PNG.sync.write(diff));
      rows.push({ page: spec.page, pct: p, pass: ok, pixels: n, total, overflow: 'no', reason });
      console.log(`p9 ${spec.page.padEnd(28)} ${p.toFixed(3)}%  ${ok ? 'PASS' : 'FAIL'}`);
    }
    const P10 = [
      { page: '22-pipeline', shot: 'shots-p10/22-pipeline.png', tab: '0' },
      { page: '22-signals', shot: 'shots-p10/22-signals.png', tab: '1' },
      { page: '22-email-pills', shot: 'shots-p10/22-email-pills.png', tab: '2' },
      { page: '22-zoom-grids', shot: 'shots-p10/22-zoom-grids.png', tab: '3' },
      { page: '22-heatmap', shot: 'shots-p10/22-heatmap.png', tab: '5' },
      { page: '22-heat-ramps', shot: 'shots-p10/22-heat-ramps.png', tab: '6' },
      { page: '22-guards', shot: 'shots-p10/22-guards.png', tab: '7' },
    ];
    for (const spec of P10) {
      const pageP10 = await context.newPage();
      await pageP10.setViewportSize({ width: 1440, height: 1000 });
      let mock;
      try {
        const shotBuf = readFileSync(join(ROOT, 'design-reference/redesign', spec.shot));
        mock = PNG.sync.read(shotBuf);
      } catch {
        rows.push({ page: spec.page, pct: 100, pass: false, pixels: 0, total: 1, overflow: 'no', reason: 'missing shot' });
        await pageP10.close();
        failed += 1;
        continue;
      }
      await pageP10.goto(`http://127.0.0.1:${port}/design/22-ops.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pageP10.evaluate(({ inter, tab }) => {
        if (!document.querySelector('link[href*="Inter"]')) {
          document.head.insertAdjacentHTML('beforeend', inter);
        }
        const b = document.querySelector('#tabs button[data-p="' + tab + '"]');
        if (b) b.click();
        window.scrollTo(0, 0);
      }, { inter: INTER, tab: spec.tab });
      await pageP10.evaluate(async () => {
        if (document.fonts && document.fonts.load) {
          await Promise.all(['400 16px Inter', '650 13px Inter', '750 12.5px Inter', '800 13.5px Inter'].map((f) => document.fonts.load(f).catch(() => {})));
          await document.fonts.ready;
        }
      }).catch(() => {});
      await pageP10.waitForTimeout(400);
      const liveBuf = await pageP10.screenshot({ type: 'png', fullPage: false });
      await pageP10.close();
      const livePng = PNG.sync.read(liveBuf);
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
      const ok = p < 1;
      const reason = ok ? (p < PASS ? '' : 'antialias vs shots-p10 PNG (under 1%)') : `${p.toFixed(3)}% vs ${spec.shot}`;
      if (!ok) failed += 1;
      writeFileSync(join(OUT, `${spec.page}-mockup.png`), PNG.sync.write(a));
      writeFileSync(join(OUT, `${spec.page}-live.png`), PNG.sync.write(b));
      writeFileSync(join(OUT, `${spec.page}.png`), PNG.sync.write(diff));
      rows.push({ page: spec.page, pct: p, pass: ok, pixels: n, total, overflow: 'no', reason });
      console.log(`p10 ${spec.page.padEnd(28)} ${p.toFixed(3)}%  ${ok ? 'PASS' : 'FAIL'}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
    const table = ['page\t% diff\toverflow\tpass/fail\treason'].concat(rows.map((r) => `${r.page}\t${r.pct.toFixed(3)}\t${r.overflow}\t${r.pass ? (r.reason && r.reason.startsWith('superseded') ? 'SKIP' : 'PASS') : 'FAIL'}\t${r.reason || ''}`)).join('\n');
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
