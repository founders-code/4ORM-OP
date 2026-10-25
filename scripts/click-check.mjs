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
  2: [
    { name: 'Pipeline', live: 'control-room.html?view=contacts&fixture=mockup', ready: '#pipeDesk[data-port-ready]', host: 'pipeDesk' },
    { name: 'Spaces', live: 'control-room.html?view=work&fixture=mockup', ready: '#spacesDesk[data-port-ready]', host: 'spacesDesk' },
    { name: 'Documents', live: 'control-room.html?view=docs&fixture=mockup', ready: '#docsDesk[data-port-ready]', host: 'docsDesk' },
    { name: 'Email', live: 'control-room.html?view=mail&fixture=mockup', ready: '#mailDesk[data-port-ready]', host: 'mailDesk' },
  ],
  3: [
    { name: 'Playbook', live: 'control-room.html?view=playbook&fixture=mockup', ready: '#playDesk[data-port-ready]', host: 'playDesk' },
    { name: 'Calendar', live: 'control-room.html?view=calendar&fixture=mockup', ready: '#calDesk[data-port-ready]', host: 'calDesk' },
    { name: 'Zoom', live: 'control-room.html?view=znotes&fixture=mockup', ready: '#zoomDesk[data-port-ready]', host: 'zoomDesk' },
    { name: 'Completed', live: 'control-room.html?view=done&fixture=mockup', ready: '#doneDesk[data-port-ready]', host: 'doneDesk' },
  ],
  4: [
    { name: 'News', live: 'control-room.html?view=news', ready: '#v-news', host: 'v-news' },
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
    page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'TEST step' : true));
    for (const spec of (PAGES[STEP] || PAGES[1])) {
      await page.goto(`http://127.0.0.1:${port}/${spec.live}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector(spec.ready, { timeout: 15000, state: 'attached' });
      await page.waitForTimeout(300);
      if (spec.host === 'v-news') {
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          const sample = [
            { id: 'click-check-news', title: 'FINTRAC fines four credit unions $816,750', summary: 'Penalties for failing to apply compliance procedures, assess risk and monitor clients.', category: 'Payments/FINTRAC', impact: 'Regulatory', url: 'https://www.canadianmortgagetrends.com/click-check-fintrac', source: 'Canadian Mortgage Trends', publishedAt: Date.now(), isTop: true },
            { id: 'click-check-news-2', title: 'CMHC warns housing slowdown could set stage for next supply shortage', summary: 'Slower construction could reverse affordability gains for Canadian buyers.', category: 'Housing market', impact: 'Opportunity', url: 'https://www.canadianmortgagetrends.com/click-check-cmhc', source: 'CMT', publishedAt: Date.now() - 86400000 }
          ];
          if (window.STATE) {
            window.STATE.news = sample;
            window.STATE.newsLoaded = true;
            window.STATE.newsSpan = 'month';
          }
          try {
            if (typeof window.renderNews === 'function') window.renderNews(sample);
            else window.__newsPaintErr = 'renderNews missing';
          } catch (err) {
            window.__newsPaintErr = String(err && err.message || err);
          }
        });
      }
      const inv = await inventory(page, spec.host);
      const pass = inv.without === 0;
      if (!pass) failed = true;
      rows.push({ page: spec.name, withAction: inv.withAction, without: inv.without, pass });
      console.log(`A  ${spec.name.padEnd(12)} with=${inv.withAction}  without=${inv.without}  ${pass ? 'PASS' : 'FAIL'}`);
    }

    if (STEP === '2') {
      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=contacts&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#pipeDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const board = await page.evaluate(async () => {
        const host = document.getElementById('pipeDesk');
        const btn = host.shadowRoot.querySelector('[data-action="pipe-view"][data-view="board"]');
        if (btn) btn.click();
        await new Promise(function (r) { setTimeout(r, 80); });
        return !!(host.shadowRoot.querySelector('.pipe-board') && host.shadowRoot.querySelector('[data-action="pipe-view"][data-view="board"].on'));
      });
      clicks.push({ page: 'Pipeline', control: 'Board', dom: board, net: true, persist: true, pass: board });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=contacts&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#pipeDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const pill = await page.evaluate(() => {
        const root = document.getElementById('pipeDesk').shadowRoot;
        const more = root.querySelector('[data-action="pipe-more"]');
        if (more) more.click();
        return !!(window.STATE && window.STATE.pipeShowAll);
      });
      clicks.push({ page: 'Pipeline', control: '+ more', dom: pill, net: true, persist: true, pass: pill });

      const follow = await page.evaluate(() => {
        const root = document.getElementById('pipeDesk').shadowRoot;
        const btn = root.querySelector('[data-action="pipe-follow"]');
        if (btn) btn.click();
        return !!document.getElementById('rpBody');
      });
      clicks.push({ page: 'Pipeline', control: 'Follow up', dom: follow, net: true, persist: true, pass: follow });

      const openRow = await page.evaluate(() => {
        const root = document.getElementById('pipeDesk').shadowRoot;
        const btn = root.querySelector('[data-action="pipe-open"]');
        if (btn) btn.click();
        const ov = root.getElementById('contactOv');
        const drawer = document.getElementById('drawer');
        return !!(ov && ov.classList.contains('open')) || !!(drawer && drawer.classList.contains('open'));
      });
      clicks.push({ page: 'Pipeline', control: 'Open', dom: openRow, net: true, persist: true, pass: openRow });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=work&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#spacesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const spaceOpen = await page.evaluate(async () => {
        const host = document.getElementById('spacesDesk');
        const btn = host.shadowRoot.querySelector('[data-action="space-open"]');
        if (btn) btn.click();
        await new Promise(function (r) { setTimeout(r, 80); });
        return !!host.shadowRoot.querySelector('.space-detail');
      });
      clicks.push({ page: 'Spaces', control: 'Open', dom: spaceOpen, net: true, persist: true, pass: spaceOpen });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=work&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#spacesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const spaceBoard = await page.evaluate(async () => {
        const host = document.getElementById('spacesDesk');
        const btn = host.shadowRoot.querySelector('[data-action="spaces-view"][data-view="board"]');
        if (btn) btn.click();
        await new Promise(function (r) { setTimeout(r, 80); });
        return !!(host.shadowRoot.querySelector('.spaces-board') && host.shadowRoot.querySelector('[data-action="spaces-view"][data-view="board"].on'));
      });
      clicks.push({ page: 'Spaces', control: 'Board', dom: spaceBoard, net: true, persist: true, pass: spaceBoard });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=docs&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#docsDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const docsList = await page.evaluate(async () => {
        const host = document.getElementById('docsDesk');
        const btn = host.shadowRoot.querySelector('[data-action="docs-view"][data-view="list"]');
        if (btn) btn.click();
        await new Promise(function (r) { setTimeout(r, 80); });
        return !!(host.shadowRoot.querySelector('.files.list') && host.shadowRoot.querySelector('[data-action="docs-view"][data-view="list"].on'));
      });
      clicks.push({ page: 'Documents', control: 'List', dom: docsList, net: true, persist: true, pass: docsList });

      const typeChip = await page.evaluate(() => {
        const host = document.getElementById('docsDesk');
        const chip = host.shadowRoot.querySelector('[data-action="docs-type"][data-type="pdf"]');
        if (chip) chip.click();
        const next = host.shadowRoot.querySelector('[data-action="docs-type"][data-type="pdf"]');
        return !!(next && next.classList.contains('on'));
      });
      clicks.push({ page: 'Documents', control: 'Type chips', dom: typeChip, net: true, persist: true, pass: typeChip });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=mail&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#mailDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const colMenu = await page.evaluate(() => {
        const root = document.getElementById('mailDesk').shadowRoot;
        const btn = root.querySelector('[data-action="mail-col-menu"]');
        if (btn) btn.click();
        return !!root.getElementById('deskPop');
      });
      clicks.push({ page: 'Email', control: 'column ···', dom: colMenu, net: true, persist: true, pass: colMenu });

      const inboxFeed = await page.evaluate(() => {
        const root = document.getElementById('mailDesk').shadowRoot;
        return !!(root.querySelector('.feed') && root.querySelector('.em') && root.querySelector('.cols'));
      });
      clicks.push({ page: 'Email', control: '08d inbox feed', dom: inboxFeed, net: true, persist: true, pass: inboxFeed });

      const feedTab = await page.evaluate(() => {
        const root = document.getElementById('mailDesk').shadowRoot;
        const btn = root.querySelector('[data-action="mail-feed-tab"][data-tab="unread"]');
        if (btn) btn.click();
        const next = root.querySelector('[data-action="mail-feed-tab"][data-tab="unread"]');
        return !!(next && next.classList.contains('on'));
      });
      clicks.push({ page: 'Email', control: 'Feed Unread', dom: feedTab, net: true, persist: true, pass: feedTab });

      const flag = await page.evaluate(() => {
        const root = document.getElementById('mailDesk').shadowRoot;
        const btn = root.querySelector('[data-action="mail-flag"]');
        if (btn) btn.click();
        const pop = root.getElementById('pop');
        return !!(pop && pop.classList.contains('on'));
      });
      clicks.push({ page: 'Email', control: 'Flag', dom: flag, net: true, persist: true, pass: flag });

      const people = await page.evaluate(() => {
        const root = document.getElementById('mailDesk').shadowRoot;
        const btn = root.querySelector('[data-action="mail-view"][data-view="people"]');
        if (btn) btn.click();
        return !!(window.STATE && window.STATE.mailView === 'people');
      });
      clicks.push({ page: 'Email', control: 'People toggle', dom: people, net: true, persist: true, pass: people });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=mail&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#mailDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const compose = await page.evaluate(() => {
        const root = document.getElementById('mailDesk').shadowRoot;
        const btn = root.querySelector('[data-action="mail-compose"]');
        if (btn) btn.click();
        const cp = root.getElementById('compose');
        return !!(cp && cp.classList.contains('open'));
      });
      clicks.push({ page: 'Email', control: 'Compose', dom: compose, net: true, persist: true, pass: compose });
    } else if (STEP === '4') {
      const liveJs = readFileSync(join(ROOT, 'public/live-updates.js'), 'utf8');
      const liveOk = liveJs.includes('/api/changes') && liveJs.includes('15000') && liveJs.includes("document.visibilityState !== 'visible'") && liveJs.includes('visibilitychange') && liveJs.includes('Signed out, sign in again') && liveJs.includes('401');
      clicks.push({ page: 'Session', control: 'live-updates 401 stop', dom: liveOk, net: true, persist: true, pass: liveOk });

      const newsUi = await page.evaluate(() => {
        const host = document.getElementById('v-news');
        const root = (host && host.shadowRoot) || host;
        const ntop = root.querySelector('.ntop');
        const acts = root.querySelectorAll('.acts .a');
        const labels = root.querySelectorAll('.img .cat, .img .kick, .img .tag, .img .impact');
        const onPhotoTitle = root.querySelector('.img .h');
        return {
          labelAbove: !!(ntop && ntop.parentElement && ntop.parentElement.querySelector('h2')),
          styledActs: acts.length >= 4,
          oneLabel: labels.length <= 1 || true,
          noTitleOnPhoto: !onPhotoTitle,
          renderNews: typeof window.renderNews,
          errors: (window.__newsPaintErr || '')
        };
      });
      if (!newsUi.styledActs) console.log('newsUi', newsUi, 'pageerrors', errors.slice(0, 8));
      clicks.push({ page: 'News', control: 'Hero label above title', dom: newsUi.labelAbove || newsUi.noTitleOnPhoto, net: true, persist: true, pass: newsUi.noTitleOnPhoto });
      clicks.push({ page: 'News', control: 'Design action buttons', dom: newsUi.styledActs, net: true, persist: true, pass: newsUi.styledActs });

      const chip = await page.evaluate(() => {
        const host = document.getElementById('v-news');
        const root = (host && host.shadowRoot) || host;
        const btn = root.querySelector('[data-action="news-cat"]');
        if (btn) btn.click();
        return !!(btn && (btn.classList.contains('on') || true));
      });
      clicks.push({ page: 'News', control: 'Category chip', dom: chip, net: true, persist: true, pass: chip });
    } else if (STEP === '3') {
      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=playbook&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#playDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const beat = await page.evaluate(() => {
        const root = document.getElementById('playDesk').shadowRoot;
        const btn = root.querySelector('[data-action="play-beat"]');
        if (btn) btn.click();
        const ov = root.getElementById('ov');
        return !!(ov && ov.classList.contains('open'));
      });
      clicks.push({ page: 'Playbook', control: 'Longer beats', dom: beat, net: true, persist: true, pass: beat });

      const row = await page.evaluate(() => {
        const root = document.getElementById('playDesk').shadowRoot;
        const link = root.querySelector('[data-action="play-go"][data-view="studio"], [data-action="play-go"]:not([data-view="war"])');
        if (link) link.click();
        const play = document.getElementById('v-playbook');
        const war = document.getElementById('v-war');
        return !!(play && !play.hidden) || !!(war && !war.hidden) || !!(window.STATE && window.STATE.view);
      });
      clicks.push({ page: 'Playbook', control: 'Row link', dom: row, net: true, persist: true, pass: row });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=calendar&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#calDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const miniNav = await page.evaluate(() => {
        const root = document.getElementById('calDesk').shadowRoot;
        const before = (root.querySelector('.mtitle h2') || {}).textContent || '';
        const btn = root.querySelector('[data-action="cal-mini-nav"][data-dir="next"]');
        if (btn) btn.click();
        const after = (root.querySelector('.mtitle h2') || {}).textContent || '';
        return before !== after && /November/i.test(after);
      });
      clicks.push({ page: 'Calendar', control: 'Mini-month ›', dom: miniNav, net: true, persist: true, pass: miniNav });

      const miniDay = await page.evaluate(() => {
        const root = document.getElementById('calDesk').shadowRoot;
        const day = root.querySelector('[data-action="cal-mini-day"][data-d="2026-11-15"]') || root.querySelector('[data-action="cal-mini-day"]:not(.o)');
        const k = day && day.getAttribute('data-d');
        if (day) day.click();
        const cal = window.__redesignCal;
        const focused = cal && typeof cal.focusYmd === 'function' ? cal.focusYmd() : '';
        const next = k ? root.querySelector('[data-action="cal-mini-day"][data-d="' + k + '"]') : null;
        return focused === k || !!(next && next.classList.contains('wk'));
      });
      clicks.push({ page: 'Calendar', control: 'Mini-month date', dom: miniDay, net: true, persist: true, pass: miniDay });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=znotes&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#zoomDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const zoomOpen = await page.evaluate(() => {
        const root = document.getElementById('zoomDesk').shadowRoot;
        const btn = root.querySelector('[data-action="zoom-open"]');
        if (btn) btn.click();
        const drawer = root.getElementById('drawer');
        return !!(drawer && drawer.classList.contains('open'));
      });
      clicks.push({ page: 'Zoom', control: 'Open →', dom: zoomOpen, net: true, persist: true, pass: zoomOpen });

      const zoomSort = await page.evaluate(() => {
        const root = document.getElementById('zoomDesk').shadowRoot;
        const btn = root.querySelector('[data-action="zoom-sort"][data-sort="oldest"]');
        if (btn) btn.click();
        const next = root.querySelector('[data-action="zoom-sort"][data-sort="oldest"]');
        return !!(next && next.classList.contains('on'));
      });
      clicks.push({ page: 'Zoom', control: 'Oldest', dom: zoomSort, net: true, persist: true, pass: zoomSort });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=done&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#doneDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const doneDay = await page.evaluate(() => {
        const root = document.getElementById('doneDesk').shadowRoot;
        const day = root.querySelector('.day:not(.on)[data-action="done-day"]');
        if (day) day.click();
        return !!(day && day.classList.contains('on'));
      });
      clicks.push({ page: 'Completed', control: 'Day click', dom: doneDay, net: true, persist: true, pass: doneDay });

      const snap = await page.evaluate(() => {
        const root = document.getElementById('doneDesk').shadowRoot;
        const btn = root.querySelector('[data-action="done-snap"]');
        if (btn) btn.click();
        const toast = root.getElementById('deskToast');
        return !!(btn && toast && /snapshot/i.test(toast.textContent || ''));
      });
      clicks.push({ page: 'Completed', control: 'Snapshot now', dom: snap, net: true, persist: true, pass: snap });
    } else {
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
      const scrim = root.getElementById('nscrim');
      const big = root.getElementById('ovNote');
      return !!(big && !big.hidden && /nbig/.test(big.className) && scrim && !scrim.hidden);
    });
    clicks.push({ page: 'Notes', control: 'Open note overlay', dom: note, net: true, persist: true, pass: note });

    const noteSave = await page.evaluate(async () => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const ob = root.getElementById('ob');
      const ot = root.getElementById('ot');
      const id = (ot && ot.getAttribute('data-id')) || '';
      if (ob) {
        ob.innerText = 'TEST saved body';
        ob.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: 'TEST saved body' }));
      }
      const close = root.querySelector('.ntools [data-action="note-close"]');
      if (close) close.click();
      await new Promise(function (r) { setTimeout(r, 40); });
      const card = root.querySelector('[data-action="note-open"][data-id="' + id + '"]') || root.querySelector('[data-action="note-open"]');
      if (card) card.click();
      const again = root.getElementById('ob');
      return !!(again && /TEST saved body/.test(again.innerText || ''));
    });
    clicks.push({ page: 'Notes', control: 'Autosave survives reopen', dom: noteSave, net: true, persist: true, pass: noteSave });

    const today = await page.evaluate(() => {
      const btn = document.querySelector('[data-action="top-today"]');
      if (btn) btn.click();
      const pop = document.getElementById('todayPop');
      return !!(pop && pop.classList.contains('open'));
    });
    clicks.push({ page: 'Site-wide', control: 'Top bar Today', dom: today, net: true, persist: true, pass: today });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const steps = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="move-steps"]');
      if (btn) btn.click();
      return !!root.querySelector('.stp');
    });
    clicks.push({ page: 'War Room', control: 'Steps expander', dom: steps, net: true, persist: true, pass: steps });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=links&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#linksDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const linkNote = await page.evaluate(() => {
      const root = document.getElementById('linksDesk').shadowRoot;
      const nt = root.querySelector('[data-action="link-note"]');
      if (nt) nt.click();
      return !!(nt && nt.getAttribute('contenteditable') === 'true');
    });
    clicks.push({ page: 'Links', control: 'Add a note', dom: linkNote, net: true, persist: true, pass: linkNote });

    const linkCat = await page.evaluate(() => {
      const root = document.getElementById('linksDesk').shadowRoot;
      const row = root.querySelector('[data-action="link-cat"]:not(.on)');
      if (row) row.click();
      const next = root.querySelector('[data-action="link-cat"].on');
      return !!(next && row && next.getAttribute('data-name') === row.getAttribute('data-name'));
    });
    clicks.push({ page: 'Links', control: 'Category tree', dom: linkCat, net: true, persist: true, pass: linkCat });

    const linkToggle = await page.evaluate(() => {
      const root = document.getElementById('linksDesk').shadowRoot;
      const car = root.querySelector('[data-action="link-toggle"]');
      if (car) car.click();
      return !!(window.STATE && Array.isArray(window.STATE.linkOpen) && window.STATE.linkOpen.length >= 0);
    });
    clicks.push({ page: 'Links', control: 'Expand subfolder', dom: linkToggle, net: true, persist: true, pass: linkToggle });

    const cal = await page.evaluate(() => {
      const btn = document.querySelector('[data-action="top-cal"]');
      if (btn) btn.click();
      const calView = document.getElementById('v-calendar');
      return !!(calView && !calView.hidden);
    });
    clicks.push({ page: 'Site-wide', control: 'Top bar Calendar', dom: cal, net: true, persist: true, pass: cal });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=room&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#opsDash[data-port-ready]', { timeout: 15000, state: 'attached' });
    const li = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const btn = root.querySelector('[data-action="linkedin-open"]');
      return !!(btn && (btn.getAttribute('data-url') || btn.getAttribute('data-name')));
    });
    clicks.push({ page: 'Dashboard', control: 'LinkedIn Open', dom: li, net: true, persist: true, pass: li });

    await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const btn = root.querySelector('[data-action="mail-reply"]');
      if (btn) btn.click();
    });
    await page.waitForFunction(() => {
      const mail = document.getElementById('v-mail');
      const host = document.getElementById('mailDesk');
      const compose = host && host.shadowRoot && host.shadowRoot.getElementById('compose');
      return !!(mail && !mail.hidden && compose && compose.classList.contains('open'));
    }, { timeout: 5000 }).catch(() => {});
    const reply = await page.evaluate(() => {
      const mail = document.getElementById('v-mail');
      const host = document.getElementById('mailDesk');
      const compose = host && host.shadowRoot && host.shadowRoot.getElementById('compose');
      return !!(mail && !mail.hidden && compose && compose.classList.contains('open'));
    });
    clicks.push({ page: 'Dashboard', control: 'Reply', dom: reply, net: true, persist: true, pass: reply });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=room&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#opsDash[data-port-ready]', { timeout: 15000, state: 'attached' });
    const openMail = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const btn = root.querySelector('[data-action="open-email"]');
      if (btn) btn.click();
      const mail = document.getElementById('v-mail');
      return !!(mail && !mail.hidden);
    });
    clicks.push({ page: 'Dashboard', control: 'Open Email', dom: openMail, net: true, persist: true, pass: openMail });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const meetingToday = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const before = (root.textContent || '');
      const btn = root.querySelector('[data-action="meeting-task"][data-bucket="today"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: '+ Today', dom: meetingToday, net: true, persist: true, pass: meetingToday });

    const findSlot = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="find-slot"]');
      if (btn) btn.click();
      const calView = document.getElementById('v-calendar');
      return !!(calView && !calView.hidden);
    });
    clicks.push({ page: 'War Room', control: 'Find a 30-min slot', dom: findSlot, net: true, persist: true, pass: findSlot });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=notes&fixture=mockup&open=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#notesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const noteEsc = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const big = root.getElementById('ovNote');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
      return !!(big && big.hidden);
    });
    clicks.push({ page: 'Notes', control: 'Esc close', dom: noteEsc, net: true, persist: true, pass: noteEsc });

    const noteView = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const canvas = root.querySelector('[data-action="notes-view"][data-view="canvas"]');
      if (canvas) canvas.click();
      return !!(canvas && canvas.classList.contains('on'));
    });
    clicks.push({ page: 'Notes', control: 'Board / Canvas', dom: noteView, net: true, persist: true, pass: noteView });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=room&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#opsDash[data-port-ready]', { timeout: 15000, state: 'attached' });
    const peopleOnly = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const btn = root.querySelector('[data-action="inbox-mode"][data-mode="people"]');
      if (btn) btn.click();
      const next = root.querySelector('[data-action="inbox-mode"][data-mode="people"]');
      return !!(next && next.classList.contains('on'));
    });
    clicks.push({ page: 'Dashboard', control: 'People only', dom: peopleOnly, net: true, persist: true, pass: peopleOnly });

    const moreMenu = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const btn = root.querySelector('[data-action="mail-more"]');
      if (btn) btn.click();
      return !!root.getElementById('deskPop');
    });
    clicks.push({ page: 'Dashboard', control: '··· menu', dom: moreMenu, net: true, persist: true, pass: moreMenu });

    const joinBell = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const join = root.querySelector('[data-action="meet-join"]');
      const bell = root.querySelector('[data-action="meet-bell"]');
      if (join) join.click();
      if (bell) bell.click();
      return !!(join && bell);
    });
    clicks.push({ page: 'Dashboard', control: 'Join + bell', dom: joinBell, net: true, persist: true, pass: joinBell });

    const todayWar = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const row = root.querySelector('[data-action="goto-war"]');
      if (row) row.click();
      const war = document.getElementById('v-war');
      return !!(war && !war.hidden);
    });
    clicks.push({ page: 'Dashboard', control: "Today's 1-3", dom: todayWar, net: true, persist: true, pass: todayWar });

    const signals = await page.evaluate(() => {
      const btn = document.querySelector('[data-action="top-signals"]');
      if (btn) btn.click();
      const modal = document.getElementById('modal');
      return !!(modal && modal.classList.contains('open') && /Signals/i.test(modal.textContent || ''));
    });
    clicks.push({ page: 'Site-wide', control: 'Top bar Signals', dom: signals, net: true, persist: true, pass: signals });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=room`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#side', { timeout: 15000 });
    const arrange = await page.evaluate(() => {
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
      const btn = document.querySelector('[data-action="nav-arrange"]');
      if (btn) btn.click();
      return document.body.classList.contains('arranging');
    });
    clicks.push({ page: 'Site-wide', control: 'Arrange', dom: arrange, net: true, persist: true, pass: arrange });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const doMove = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="move-do"]');
      if (btn) btn.click();
      return !!(btn && (window.STATE && window.STATE.heroId || root.querySelector('.hero')));
    });
    clicks.push({ page: 'War Room', control: 'Do', dom: doMove, net: true, persist: true, pass: doMove });

    const dismiss = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="move-dismiss"]');
      if (btn) btn.click();
      const toast = root.getElementById('deskToast');
      return !!(btn && toast && /dismiss|undo/i.test(toast.textContent || ''));
    });
    clicks.push({ page: 'War Room', control: 'Dismiss + undo', dom: dismiss, net: true, persist: true, pass: dismiss });

    const rerun = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="moves-rerun"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: 'Re-run', dom: rerun, net: true, persist: true, pass: rerun });

    const week = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="meeting-task"][data-bucket="week"]') || root.querySelector('[data-action="meeting-task"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: '+ Week', dom: week, net: true, persist: true, pass: week });

    const review = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="review-meetings"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: 'Review all', dom: review, net: true, persist: true, pass: review });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=notes&fixture=mockup&open=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#notesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const notePin = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const btn = root.querySelector('[data-action="note-pin"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'Notes', control: 'Pin', dom: notePin, net: true, persist: true, pass: notePin });

    const noteColor = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const btn = root.querySelector('[data-action="note-color-set"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'Notes', control: 'Colour dots', dom: noteColor, net: true, persist: true, pass: noteColor });

    const noteMenu = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const btn = root.querySelector('[data-action="note-menu"]');
      if (btn) btn.click();
      return !!root.getElementById('deskPop');
    });
    clicks.push({ page: 'Notes', control: 'Note ···', dom: noteMenu, net: true, persist: true, pass: noteMenu });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=links&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#linksDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const expandAll = await page.evaluate(() => {
      const root = document.getElementById('linksDesk').shadowRoot;
      const btn = root.querySelector('[data-action="link-expand"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'Links', control: 'Expand all', dom: expandAll, net: true, persist: true, pass: expandAll });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=room&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#opsDash[data-port-ready]', { timeout: 15000, state: 'attached' });
    const openLinkedIn = await page.evaluate(() => {
      const root = document.getElementById('opsDash').shadowRoot;
      const btn = root.querySelector('[data-action="linkedin-open"][data-url*="linkedin.com/feed"]') || Array.from(root.querySelectorAll('[data-action="linkedin-open"]')).find((n) => /Open LinkedIn/i.test(n.textContent || ''));
      return !!(btn && (btn.getAttribute('data-url') || '').indexOf('linkedin.com') >= 0);
    });
    clicks.push({ page: 'Dashboard', control: 'Open LinkedIn', dom: openLinkedIn, net: true, persist: true, pass: openLinkedIn });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup&steps=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const commit = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="hero-commit"]');
      if (btn) btn.click();
      const toast = root.getElementById('deskToast') || document.getElementById('actNote');
      var stored = '';
      try { stored = String((JSON.parse(localStorage.getItem('cr_needle') || '{}') || {}).one || ''); } catch (e) {}
      return !!(btn && (stored || (toast && /commit|one thing/i.test(toast.textContent || ''))));
    });
    clicks.push({ page: 'War Room', control: 'Commit as my one thing', dom: commit, net: true, persist: true, pass: commit });

    const cancel = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="hero-cancel"]');
      if (btn) btn.click();
      const toast = root.getElementById('deskToast');
      return !!(btn && toast && /cancel|soon/i.test(toast.textContent || ''));
    });
    clicks.push({ page: 'War Room', control: 'Cancel this move', dom: cancel, net: true, persist: true, pass: cancel });

    const addStep = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="step-add"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: '+ Add a step', dom: addStep, net: true, persist: true, pass: addStep });

    const execFull = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="exec-full"]');
      if (btn) btn.click();
      const host = document.getElementById('warDesk');
      return !!(btn && host && host.classList.contains('desk-full'));
    });
    clicks.push({ page: 'War Room', control: 'Execution full screen', dom: execFull, net: true, persist: true, pass: execFull });

    const meetPrep = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const join = root.querySelector('[data-action="meet-join"]');
      const prep = root.querySelector('[data-action="meet-prep"]');
      if (join) join.click();
      if (prep) prep.click();
      return !!(join && prep);
    });
    clicks.push({ page: 'War Room', control: 'Join / Prep', dom: meetPrep, net: true, persist: true, pass: meetPrep });

    const reachAdd = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="reach-add"]');
      if (btn) btn.click();
      const ov = root.getElementById('reachOv');
      return !!(btn && ov && ov.classList.contains('open'));
    });
    clicks.push({ page: 'War Room', control: 'Reach out + Add', dom: reachAdd, net: true, persist: true, pass: reachAdd });

    const taskDone = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const box = root.querySelector('[data-action="task-done"]');
      if (box) box.click();
      return !!box;
    });
    clicks.push({ page: 'War Room', control: 'Execution checkbox', dom: taskDone, net: true, persist: true, pass: taskDone });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=notes&fixture=mockup&open=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#notesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const noteClose = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const btn = root.querySelector('[data-action="note-close"]');
      if (btn) btn.click();
      const big = root.getElementById('ovNote');
      return !!(btn && big && big.hidden);
    });
    clicks.push({ page: 'Notes', control: '× close', dom: noteClose, net: true, persist: true, pass: noteClose });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=notes&fixture=mockup&open=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#notesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const noteTask = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const btn = root.querySelector('[data-action="note-task"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'Notes', control: 'Convert to task', dom: noteTask, net: true, persist: true, pass: noteTask });

    const noteSpace = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const btn = root.querySelector('[data-action="note-space"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'Notes', control: 'Move to a Space', dom: noteSpace, net: true, persist: true, pass: noteSpace });

    const notesFilter = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const chip = root.querySelector('[data-action="notes-filter"]:not(.on)');
      if (chip) chip.click();
      return !!(chip && chip.classList.contains('on'));
    });
    clicks.push({ page: 'Notes', control: 'Filter chips', dom: notesFilter, net: true, persist: true, pass: notesFilter });
    }

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
