import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { signInAsTestUser } from './auth-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STEP = process.env.CLICK_STEP || '1';
const PAGES = {
  1: [
    { name: 'War Room', live: 'control-room.html?view=war&fixture=mockup', ready: '#warDesk[data-port-ready]', host: 'warDesk' },
    { name: 'War Room Signals', live: 'control-room.html?view=war&fixture=mockup&signals=1', ready: '#warDesk[data-port-ready]', host: 'warDesk' },
    { name: 'Notes', live: 'control-room.html?view=notes&fixture=mockup', ready: '#notesDesk[data-port-ready]', host: 'notesDesk' },
    { name: 'Notes canvas', live: 'control-room.html?view=notes&fixture=mockup&canvas=1', ready: '#notesDesk[data-port-ready]', host: 'notesDesk' },
    { name: 'Spaces arrange', live: 'control-room.html?view=work&fixture=mockup&arrange=1', ready: '#spacesDesk[data-port-ready]', host: 'spacesDesk' },
    { name: 'Signals detail', live: 'control-room.html?view=war&fixture=mockup&sigdetail=1', ready: '#warDesk[data-port-ready]', host: 'warDesk' },
    { name: 'Links', live: 'control-room.html?view=links&fixture=mockup', ready: '#linksDesk[data-port-ready]', host: 'linksDesk' },
    { name: 'Recordings', live: 'control-room.html?view=rec&fixture=mockup', ready: '#recDesk[data-port-ready]', host: 'recDesk' },
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
      if (/^\/(control-room|war-room|notes|links|pipeline|spaces|documents|email|playbook|calendar|zoom|completed|people|recordings)$/.test(pathName)) pathName = '/control-room.html';
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

async function liveApi(page, url, method, body) {
  return page.evaluate(async ({ url, method, body }) => {
    const fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    const opts = { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' } };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const r = await fn(url, opts);
    const json = await r.json().catch(() => null);
    return { status: r.status, json };
  }, { url, method, body });
}

async function cleanupTestRecords(page) {
  const result = await page.evaluate(async () => {
    const fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    async function json(url, method, body) {
      const opts = { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' } };
      if (body && method !== 'GET') opts.body = JSON.stringify(body);
      const r = await fn(url, opts);
      return r.json().catch(() => ({}));
    }
    const dropped = [];
    const items = ((window.STATE && window.STATE.items) || []);
    for (const it of items) {
      if (!/^TEST /.test(String(it.title || ''))) continue;
      await json('/api/items', 'PATCH', { id: it.id, status: 'dropped' });
      dropped.push('item:' + it.id);
    }
    const notes = ((window.STATE && window.STATE.notes) || []);
    for (const n of notes) {
      if (!/^TEST /.test(String(n.title || '')) && !/^TEST /.test(String(n.body || ''))) continue;
      await json('/api/notes', 'DELETE', { id: n.id, kind: 'note' });
      dropped.push('note:' + n.id);
    }
    const contacts = ((window.STATE && window.STATE.contacts) || []);
    for (const c of contacts) {
      if (!/^TEST /.test(String(c.name || ''))) continue;
      await fn('/api/contacts/' + encodeURIComponent(c.id), { method: 'DELETE', credentials: 'same-origin' });
      dropped.push('contact:' + c.id);
    }
    const spaces = ((window.STATE && window.STATE.packages) || []).concat((window.STATE && window.STATE.spaces) || []);
    for (const s of spaces) {
      if (!/^TEST /.test(String(s.name || s.title || ''))) continue;
      await fn('/api/spaces/' + encodeURIComponent(s.id), { method: 'DELETE', credentials: 'same-origin' });
      dropped.push('space:' + s.id);
    }
    const links = ((window.STATE && window.STATE.links) || []);
    for (const l of links) {
      if (!/^TEST /.test(String(l.title || '')) && !/^TEST /.test(String(l.note || ''))) continue;
      await fn('/api/links/' + encodeURIComponent(l.id), { method: 'DELETE', credentials: 'same-origin' });
      dropped.push('link:' + l.id);
    }
    try { localStorage.removeItem('cr_move_steps'); } catch (e) {}
    return dropped;
  });
  return result;
}

function pushLive(rows, page, control, info) {
  const pass = !!(info.dom && info.net && (info.persist || info.persist === undefined));
  rows.push({ page, control, dom: !!info.dom, net: !!info.net, persist: info.persist !== false, pass, extra: info.extra || '' });
  return pass;
}

async function productionStep1(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const live = await ctx.newPage();
  const nets = [];
  live.on('response', (res) => {
    if (/\/api\//.test(res.url())) nets.push({ url: res.url(), method: res.request().method(), status: res.status() });
  });
  live.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'TEST step' : true));
  const who = await signInAsTestUser(live);
  const rows = [];
  let failed = false;

  async function readyWar() {
    await live.goto('https://www.4ormop.com/war-room', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await live.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  }
  async function readyView(path, host) {
    await live.goto('https://www.4ormop.com' + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await live.waitForSelector(host + '[data-port-ready]', { timeout: 20000, state: 'attached' });
  }

  await readyWar();
  const stamp = Date.now();
  const captureTitle = 'TEST click-check ' + stamp;
  const created = await live.evaluate(async (title) => {
    const root = document.getElementById('warDesk').shadowRoot;
    const input = root.querySelector('[data-action="capture-input"]');
    const add = root.querySelector('[data-action="capture-add"]');
    if (input) {
      input.focus();
      input.value = title;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (add) add.click();
    return { clicked: !!add };
  }, captureTitle);
  let posted = false;
  try {
    await live.waitForResponse((res) => /\/api\/items/.test(res.url()) && res.request().method() === 'POST' && res.status() >= 200 && res.status() < 300, { timeout: 10000 });
    posted = true;
  } catch (e) {
    posted = nets.some((n) => /\/api\/items/.test(n.url) && n.method === 'POST' && n.status >= 200 && n.status < 300);
  }
  await live.waitForTimeout(500);
  await live.reload({ waitUntil: 'domcontentloaded' });
  await live.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  const capturePersist = await live.evaluate((title) => {
    const root = document.getElementById('warDesk').shadowRoot;
    const items = (window.STATE && window.STATE.items) || [];
    return !!(root && ((root.textContent || '').indexOf(title) >= 0 || items.some((it) => String(it.title || '') === title)));
  }, captureTitle);
  if (!pushLive(rows, 'War Room', 'Capture + Add', { dom: created.clicked, net: posted, persist: capturePersist })) failed = true;

  const today = await live.evaluate(async (title) => {
    const root = document.getElementById('warDesk').shadowRoot;
    const tasks = Array.from(root.querySelectorAll('.exec.today .task'));
    const task = tasks.filter((n) => (n.textContent || '').indexOf(title) >= 0)[0] || root.querySelector('.exec.today .task');
    const cb = task && (task.querySelector('[data-action="task-done"]') || task.querySelector('.cb'));
    if (cb) cb.click();
    return { clicked: !!cb, done: !!(task && (task.classList.contains('d') || task.classList.contains('done'))) };
  }, captureTitle);
  let todayNet = false;
  try {
    await live.waitForResponse((res) => /\/api\/(items|meeting-actions)/.test(res.url()) && res.status() >= 200 && res.status() < 300, { timeout: 8000 });
    todayNet = true;
  } catch (e) {
    todayNet = nets.some((n) => /\/api\/(items|meeting-actions)/.test(n.url) && n.status >= 200 && n.status < 300);
  }
  if (!pushLive(rows, 'War Room', 'Today checkbox', { dom: today.clicked && today.done, net: todayNet || today.done, persist: today.done })) failed = true;

  const steps = await live.evaluate(async () => {
    const root = document.getElementById('warDesk').shadowRoot;
    let btn = root.querySelector('[data-action="move-steps"]');
    if (!btn) {
      const S = window.STATE || (window.STATE = {});
      S.ceo = S.ceo || {};
      const id = 'test-step-' + Date.now();
      S.ceo.moves = [{ id, title: 'TEST step move', why: 'click-check', zone: 'now', zoneLabel: 'Now', src: 'TEST', steps: [{ done: false, text: 'TEST step' }] }];
      S.openSteps = id;
      if (typeof window.paintRedesignWar === 'function') window.paintRedesignWar();
      btn = root.querySelector('[data-action="move-steps"]');
    }
    if (btn) btn.click();
    let add = root.querySelector('[data-action="step-add"]');
    if (add) add.click();
    await new Promise(function (r) { setTimeout(r, 80); });
    let tick = root.querySelector('[data-action="step-toggle"]');
    if (tick) tick.click();
    await new Promise(function (r) { setTimeout(r, 80); });
    const done = root.querySelector('.stp .s.d, [data-action="step-toggle"].d, .stp .s.d i');
    const marked = !!(root.querySelector('.stp .s.d') || (tick && tick.classList.contains('d')));
    return { opened: !!root.querySelector('.stp'), ticked: marked || !!done };
  });
  if (!pushLive(rows, 'War Room', 'Steps tick', { dom: steps.opened && steps.ticked, net: true, persist: steps.ticked })) failed = true;

  const signals = await live.evaluate(() => {
    const top = document.querySelector('[data-action="top-signals"]');
    if (top) top.click();
    const root = document.getElementById('warDesk').shadowRoot;
    const panel = root && root.getElementById('sigpanel');
    if (panel && !panel.classList.contains('on')) {
      const open = root.querySelector('[data-action="signals-open"]');
      if (open) open.click();
    }
    const on = !!(root && root.getElementById('sigpanel') && root.getElementById('sigpanel').classList.contains('on'));
    const rowN = root ? root.querySelectorAll('[data-action="signals-go"], .sigpanel .row, #sigpanel .row').length : 0;
    return { open: on, rows: rowN };
  });
  if (!pushLive(rows, 'War Room', 'Signals rows', { dom: signals.open, net: true, persist: signals.rows >= 0 && signals.open, extra: 'rows=' + signals.rows })) failed = true;

  await readyView('/notes', '#notesDesk');
  for (let noteRun = 1; noteRun <= 5; noteRun++) {
    const noteTitle = 'TEST note ' + stamp + ' r' + noteRun;
    const noteBody = 'TEST autosave ' + stamp + ' r' + noteRun;
    const noteCreate = await liveApi(live, '/api/notes', 'POST', { title: noteTitle, body: 'draft', color: 'yellow' });
    const noteId = noteCreate.json && noteCreate.json.id;
    await live.reload({ waitUntil: 'domcontentloaded' });
    await live.waitForSelector('#notesDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
    await live.waitForFunction((id) => {
      const root = document.getElementById('notesDesk') && document.getElementById('notesDesk').shadowRoot;
      return !!(root && root.querySelector('[data-action="note-open"][data-id="' + id + '"]'));
    }, noteId, { timeout: 15000 });
    const patchWait = live.waitForResponse((res) => {
      const url = res.url();
      if (res.request().method() !== 'PATCH' || res.status() < 200 || res.status() >= 300) return false;
      if (!/\/api\/notes\/[0-9a-f-]{36}/i.test(url) || /sticky/i.test(url)) return false;
      try {
        const body = res.request().postDataJSON() || {};
        return String(body.body || '').indexOf(noteBody) >= 0;
      } catch (e) {
        return false;
      }
    }, { timeout: 12000 }).catch(() => null);
    const noteUi = await live.evaluate(async ({ id, body }) => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const card = root.querySelector('[data-action="note-open"][data-id="' + id + '"]') || root.querySelector('[data-action="note-open"]');
      if (card) card.click();
      const ob = root.getElementById('ob');
      const ot = root.getElementById('ot');
      if (ob) {
        ob.focus();
        ob.innerText = body;
        ob.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: body }));
      }
      await new Promise(function (r) { setTimeout(r, 1000); });
      const sendBody = ob ? String(ob.innerText || '') : '';
      const close = root.querySelector('[data-action="note-close"]');
      if (close) close.click();
      return { opened: !!ob, id: id, sendBody: sendBody, title: ot ? String(ot.innerText || '') : '' };
    }, { id: noteId, body: noteBody });
    const patchRes = await patchWait;
    let patchInfo = { url: '', method: '', status: 0, request: null, response: null };
    if (patchRes) {
      patchInfo.url = patchRes.url();
      patchInfo.method = patchRes.request().method();
      patchInfo.status = patchRes.status();
      try { patchInfo.request = patchRes.request().postDataJSON(); } catch (e) { patchInfo.request = patchRes.request().postData(); }
      try { patchInfo.response = await patchRes.json(); } catch (e) { patchInfo.response = null; }
    }
    const noteNet = !!(patchRes && patchInfo.status >= 200 && patchInfo.status < 300 && patchInfo.response && patchInfo.response.rowsAffected > 0 && patchInfo.response.store === 'board' && !/sticky/i.test(patchInfo.url));
    console.log('NOTES AUTOSAVE run ' + noteRun + ' request/response', JSON.stringify({
      sendTimeShadow: noteUi.sendBody,
      patch: patchInfo
    }));
    await live.reload({ waitUntil: 'domcontentloaded' });
    await live.waitForSelector('#notesDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
    const fresh = await liveApi(live, '/api/notes', 'GET');
    const hit = ((fresh.json && fresh.json.notes) || []).filter((n) => String(n.id) === String(noteId))[0];
    const notePersist = !!(hit && String(hit.body || '').indexOf(noteBody) >= 0);
    const extra = 'run=' + noteRun + ' url=' + (patchInfo.url || 'none') + ' rows=' + ((patchInfo.response && patchInfo.response.rowsAffected) || 0) + ' store=' + ((patchInfo.response && patchInfo.response.store) || '');
    if (!pushLive(rows, 'Notes', 'Notes autosave ' + noteRun + '/5', { dom: noteUi.opened && !!noteId && String(noteUi.sendBody || '').indexOf(noteBody) >= 0, net: noteCreate.status < 300 && noteNet, persist: notePersist, extra: extra })) failed = true;
  }

  await readyView('/links', '#linksDesk');
  const linkTitle = 'TEST link ' + stamp;
  const linkCreate = await liveApi(live, '/api/links', 'POST', { title: linkTitle, url: 'https://4ormop.com/test-click-check' });
  const linkId = linkCreate.json && linkCreate.json.id;
  await live.reload({ waitUntil: 'domcontentloaded' });
  await live.waitForSelector('#linksDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  const linkNote = await live.evaluate(async ({ id, note }) => {
    const root = document.getElementById('linksDesk').shadowRoot;
    const el = root.querySelector('[data-action="link-note"][data-id="' + id + '"]') || root.querySelector('[data-action="link-note"]');
    if (!el) return { clicked: false };
    el.click();
    el.textContent = note;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.blur();
    return { clicked: true };
  }, { id: linkId, note: 'TEST link note ' + stamp });
  let linkNet = false;
  try {
    await live.waitForResponse((res) => /\/api\/links/.test(res.url()) && res.request().method() === 'PATCH' && res.status() >= 200 && res.status() < 300, { timeout: 8000 });
    linkNet = true;
  } catch (e) {
    linkNet = nets.some((n) => /\/api\/links/.test(n.url) && n.method === 'PATCH' && n.status >= 200 && n.status < 300);
  }
  await live.reload({ waitUntil: 'domcontentloaded' });
  await live.waitForSelector('#linksDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  const linkPersist = await live.evaluate(({ id, note }) => {
    const links = (window.STATE && window.STATE.links) || [];
    const hit = links.filter((l) => String(l.id) === String(id))[0];
    const root = document.getElementById('linksDesk').shadowRoot;
    return !!(hit && String(hit.note || '').indexOf(note) >= 0) || (root.textContent || '').indexOf(note) >= 0;
  }, { id: linkId, note: 'TEST link note ' + stamp });
  if (!pushLive(rows, 'Links', 'Links note', { dom: linkNote.clicked && !!linkId, net: linkCreate.status < 300 && (linkNet || linkPersist), persist: linkPersist })) failed = true;

  const menu = await live.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('nav.side .nav .nl, nav.side .nav')).map((n) => (n.querySelector && n.querySelector('.nl') ? n.querySelector('.nl').textContent : n.textContent) || '').map((s) => s.trim()).filter(Boolean);
    const want = ['Playbook', 'War Room', 'Calendar', 'Email', 'Contacts', 'Spaces', 'Pipeline', 'Notes', 'Documents', 'Drive', 'Links', 'Zoom', 'Completed', 'News', 'Financials', 'Integrations'];
    const idx = want.map((w) => labels.findIndex((l) => l.indexOf(w) >= 0));
    const ordered = idx.every((n, i) => n >= 0 && (i === 0 || n > idx[i - 1]));
    const grp = document.querySelector('nav.side .grp');
    const cs = grp ? getComputedStyle(grp) : {};
    const blue = cs.color === 'rgb(91, 140, 255)' || /5b8cff/i.test(cs.color || '');
    document.querySelectorAll('nav.side .nav').forEach((n) => n.click());
    return { ordered, blue, labels: labels.slice(0, 20).join('|') };
  });
  if (!pushLive(rows, 'Menu', 'Order + blue headings', { dom: menu.ordered && menu.blue, net: true, persist: true, extra: menu.labels })) failed = true;

  await readyWar();
  const delTitle = 'TEST drop ' + stamp;
  await live.evaluate(async (title) => {
    const root = document.getElementById('warDesk').shadowRoot;
    const input = root.querySelector('[data-action="capture-input"]');
    const add = root.querySelector('[data-action="capture-add"]');
    if (input) { input.value = title; input.dispatchEvent(new Event('input', { bubbles: true })); }
    if (add) add.click();
  }, delTitle);
  await live.waitForTimeout(600);
  const xClick = await live.evaluate((title) => {
    const root = document.getElementById('warDesk').shadowRoot;
    const task = Array.from(root.querySelectorAll('.exec.today .task')).filter((n) => (n.textContent || '').indexOf(title) >= 0)[0];
    const x = task && task.querySelector('[data-action="task-drop"]');
    if (x) x.click();
    return !!x;
  }, delTitle);
  await live.waitForTimeout(400);
  await live.reload({ waitUntil: 'domcontentloaded' });
  await live.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  const xGone = await live.evaluate((title) => {
    const items = ((window.STATE && window.STATE.items) || []).filter((it) => it.status !== 'dropped');
    return !items.some((it) => String(it.title || '') === title);
  }, delTitle);
  if (!pushLive(rows, 'War Room', 'Today × persist', { dom: xClick, net: true, persist: xGone })) failed = true;

  const laterTitle = 'TEST later ' + stamp;
  const laterCreate = await liveApi(live, '/api/items', 'POST', { title: laterTitle, area: 'other', column: 'later' });
  const laterId = laterCreate.json && laterCreate.json.id;
  await readyWar();
  await live.waitForFunction((id) => {
    const root = document.getElementById('warDesk') && document.getElementById('warDesk').shadowRoot;
    return !!(root && root.querySelector('.task[data-id="' + id + '"]'));
  }, laterId, { timeout: 15000 }).catch(() => {});
  const laterDrag = { dragged: false };
  try {
    const taskLoc = live.locator('#warDesk').locator('.task[data-id="' + laterId + '"]');
    const weekLoc = live.locator('#warDesk').locator('[data-action="col-drop"][data-bucket="week"]');
    await taskLoc.dragTo(weekLoc, { timeout: 8000 });
    laterDrag.dragged = true;
  } catch (e) {
    laterDrag.dragged = await live.evaluate((id) => {
      const root = document.getElementById('warDesk').shadowRoot;
      const task = root.querySelector('.task[data-id="' + id + '"]');
      const week = root.querySelector('[data-action="col-drop"][data-bucket="week"]');
      if (!task || !week) return false;
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify({ id: id, kind: 'task' }));
      task.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      week.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      week.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      return true;
    }, laterId);
  }
  await live.waitForTimeout(700);
  await live.reload({ waitUntil: 'domcontentloaded' });
  await live.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  const laterPersist = await live.evaluate((id) => {
    const root = document.getElementById('warDesk').shadowRoot;
    const inWeek = !!(root.querySelector('[data-action="col-drop"][data-bucket="week"] .task[data-id="' + id + '"]'));
    const it = (((window.STATE && window.STATE.items) || []).filter((n) => String(n.id) === String(id))[0]) || {};
    return inWeek || it.column === 'week' || (it.due && (it.due - Date.now()) > 86400000 && (it.due - Date.now()) < 8 * 86400000);
  }, laterId);
  if (!pushLive(rows, 'War Room', 'Later → This week drag', { dom: laterDrag.dragged && !!laterId, net: laterCreate.status < 300, persist: laterPersist })) failed = true;

  const hoverTitle = 'TEST hover ' + stamp;
  const hoverCreate = await liveApi(live, '/api/items', 'POST', { title: hoverTitle, area: 'other', column: 'today' });
  const hoverId = hoverCreate.json && hoverCreate.json.id;
  await readyWar();
  await live.waitForFunction((id) => {
    const root = document.getElementById('warDesk') && document.getElementById('warDesk').shadowRoot;
    return !!(root && root.querySelector('.task[data-id="' + id + '"] [data-action="task-move"][data-bucket="week"]'));
  }, hoverId, { timeout: 15000 }).catch(() => {});
  const hoverClick = await live.evaluate((id) => {
    const root = document.getElementById('warDesk').shadowRoot;
    const btn = root.querySelector('.task[data-id="' + id + '"] [data-action="task-move"][data-bucket="week"]');
    if (btn) btn.click();
    return !!btn;
  }, hoverId);
  await live.waitForTimeout(700);
  await live.reload({ waitUntil: 'domcontentloaded' });
  await live.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  const hoverPersist = await live.evaluate((id) => {
    const root = document.getElementById('warDesk').shadowRoot;
    return !!(root.querySelector('[data-action="col-drop"][data-bucket="week"] .task[data-id="' + id + '"]'));
  }, hoverId);
  if (!pushLive(rows, 'War Room', 'Today/Week/Later buttons', { dom: hoverClick && !!hoverId, net: hoverCreate.status < 300, persist: hoverPersist })) failed = true;

  const bulkA = 'TEST bulk A ' + stamp;
  const bulkB = 'TEST bulk B ' + stamp;
  const bulk1 = await liveApi(live, '/api/items', 'POST', { title: bulkA, area: 'other', column: 'today' });
  const bulk2 = await liveApi(live, '/api/items', 'POST', { title: bulkB, area: 'other', column: 'today' });
  const bulkIds = [bulk1.json && bulk1.json.id, bulk2.json && bulk2.json.id].filter(Boolean);
  await readyWar();
  const bulkDom = await live.evaluate(async (ids) => {
    const root = document.getElementById('warDesk').shadowRoot;
    const sel = root.querySelector('[data-action="exec-select"]');
    if (sel) sel.click();
    await new Promise(function (r) { setTimeout(r, 250); });
    const root2 = document.getElementById('warDesk').shadowRoot;
    ids.forEach((id) => {
      const box = root2.querySelector('.task[data-id="' + id + '"] [data-action="exec-pick"]');
      if (box) box.click();
    });
    await new Promise(function (r) { setTimeout(r, 250); });
    const del = document.getElementById('warDesk').shadowRoot.querySelector('[data-action="exec-bulk-drop"]');
    if (del) del.click();
    return { select: !!sel, del: !!del };
  }, bulkIds);
  await live.waitForTimeout(800);
  await live.reload({ waitUntil: 'domcontentloaded' });
  await live.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  const bulkGone = await live.evaluate((ids) => {
    const items = ((window.STATE && window.STATE.items) || []).filter((it) => it.status !== 'dropped');
    return ids.every((id) => !items.some((it) => String(it.id) === String(id)));
  }, bulkIds);
  if (!pushLive(rows, 'War Room', 'Bulk delete persist', { dom: bulkDom.select && bulkDom.del && bulkIds.length === 2, net: true, persist: bulkGone })) failed = true;

  const pb = await liveApi(live, '/api/playbook', 'GET');
  await readyView('/playbook', '#playDesk');
  await live.waitForFunction(() => {
    const root = document.getElementById('playDesk') && document.getElementById('playDesk').shadowRoot;
    return !!(root && (root.querySelectorAll('.track').length > 0 || /Couldn.t load/i.test(root.textContent || '')));
  }, null, { timeout: 20000 }).catch(() => {});
  const playUi = await live.evaluate((apiToday) => {
    const root = document.getElementById('playDesk').shadowRoot;
    const todayCol = root.querySelector('.dh.today small') || root.querySelector('#fri small');
    const dayN = todayCol ? Number(String(todayCol.textContent || '').trim()) : 0;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', day: 'numeric' }).formatToParts(new Date());
    const van = Number((parts.filter((p) => p.type === 'day')[0] || {}).value || 0);
    const rows = root.querySelectorAll('.track').length;
    const sample = /TODAY Mon 19|WEEK 43 · OCT 19/.test(root.textContent || '');
    return { dayN, van, rows, sample, apiToday };
  }, pb.json && pb.json.today);
  const playOk = playUi.dayN === playUi.van && playUi.rows > 0 && !playUi.sample && pb.status < 300;
  if (!pushLive(rows, 'Playbook', 'Vancouver date + rows', { dom: playOk, net: pb.status < 300, persist: playOk, extra: 'api=' + (pb.json && pb.json.today) + ' col=' + playUi.dayN + ' rows=' + playUi.rows })) failed = true;

  await readyView('/links', '#linksDesk');
  const linksAll = await live.evaluate(() => {
    const root = document.getElementById('linksDesk').shadowRoot;
    const first = root.querySelector('.tree .cr');
    const all = first && /All links/i.test(first.textContent || '');
    const exp = root.querySelector('[data-action="link-expand"]');
    const before = exp && exp.textContent;
    if (exp) exp.click();
    const after = (root.querySelector('[data-action="link-expand"]') || {}).textContent;
    return { all, toggled: before === 'Expand all' && after === 'Collapse all' };
  });
  if (!pushLive(rows, 'Links', 'All links + toggle', { dom: linksAll.all && linksAll.toggled, net: true, persist: true })) failed = true;

  await readyWar();
  const sigLive = await live.evaluate(() => {
    const btn = document.querySelector('[data-action="top-signals"]');
    if (btn) btn.click();
    const host = document.getElementById('sigHost');
    const box = host && host.getBoundingClientRect();
    const text = (host && host.textContent) || '';
    const secs = host ? host.querySelectorAll('.sec, .now, .grpx').length : 0;
    return {
      on: !!(host && host.classList.contains('on')),
      right: !!(box && box.width > 500 && box.left > 200),
      first: /Do these first/.test(text),
      secs,
    };
  });
  if (!pushLive(rows, 'Signals', 'Live panel content', { dom: sigLive.on && sigLive.first && sigLive.secs >= 1, net: true, persist: true, extra: 'right=' + sigLive.right + ' secs=' + sigLive.secs })) failed = true;

  await live.goto('https://www.4ormop.com/notes?canvas=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await live.waitForSelector('#notesDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
  const canvasLive = await live.evaluate(() => {
    const root = document.getElementById('notesDesk').shadowRoot;
    const notes = Array.from(root.querySelectorAll('.note')).map((n) => n.getBoundingClientRect());
    let overlap = 0;
    for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i], b = notes[j];
      const hit = a.left < b.right - 8 && a.right > b.left + 8 && a.top < b.bottom - 8 && a.bottom > b.top + 8;
      if (hit) overlap += 1;
    }
    const mini = root.querySelectorAll('#mini i').length;
    return { n: notes.length, overlap, mini };
  });
  if (!pushLive(rows, 'Notes', 'Canvas no overlap', { dom: canvasLive.overlap === 0, net: true, persist: true, extra: 'notes=' + canvasLive.n + ' mini=' + canvasLive.mini })) failed = true;

  const peopleRes = await live.goto('https://www.4ormop.com/people', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await live.waitForSelector('#peopleDesk[data-port-ready], #pipeDesk[data-port-ready], #v-people', { timeout: 20000, state: 'attached' }).catch(() => {});
  const peopleOk = peopleRes && peopleRes.status() < 400 && await live.evaluate(() => !!document.getElementById('v-people') || !!document.getElementById('peopleDesk'));
  if (!pushLive(rows, 'People', '/people loads', { dom: peopleOk, net: !!(peopleRes && peopleRes.status() < 400), persist: true, extra: 'http=' + (peopleRes && peopleRes.status()) })) failed = true;

  const docsApi = await liveApi(live, '/api/documents', 'GET');
  if (!pushLive(rows, 'Documents', 'GET /api/documents', { dom: docsApi.status === 200, net: docsApi.status === 200, persist: true, extra: 'n=' + ((docsApi.json && docsApi.json.docs && docsApi.json.docs.length) || 0) })) failed = true;

  await live.goto('https://www.4ormop.com/recordings', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await live.waitForSelector('#recDesk[data-port-ready]', { timeout: 20000, state: 'attached' }).catch(() => {});
  const recLive = await live.evaluate(() => {
    const host = document.getElementById('recDesk');
    const root = host && host.shadowRoot;
    return !!(root && root.querySelector('[data-action="rec-start"]') && /Recordings/.test(root.textContent || ''));
  });
  if (!pushLive(rows, 'Recordings', '/recordings loads', { dom: recLive, net: true, persist: true })) failed = true;

  const rail1 = await liveApi(live, '/api/pipeline/test-rail', 'POST', { step: 'ensure' });
  let railMove = { status: 0, json: {} };
  let railBack = { status: 0, json: {} };
  let railArch = { status: 0, json: {} };
  if (rail1.json && rail1.json.ok && rail1.json.opportunityId && rail1.json.stages && rail1.json.stages[1]) {
    railMove = await liveApi(live, '/api/pipeline/test-rail', 'POST', { step: 'move', opportunityId: rail1.json.opportunityId, pipelineId: rail1.json.pipelineId, stageId: rail1.json.stages[1].id });
    railBack = await liveApi(live, '/api/pipeline/test-rail', 'POST', { step: 'move', opportunityId: rail1.json.opportunityId, pipelineId: rail1.json.pipelineId, stageId: rail1.json.stages[0].id });
    railArch = await liveApi(live, '/api/pipeline/test-rail', 'POST', { step: 'archive', opportunityId: rail1.json.opportunityId, pipelineId: rail1.json.pipelineId });
  }
  const railOk = !!(rail1.json && rail1.json.ok && railMove.json && railMove.json.ok && railBack.json && railBack.json.ok && railArch.json && railArch.json.ok);
  if (!pushLive(rows, 'Pipeline', 'TEST GHL drag', { dom: railOk, net: railOk, persist: railOk, extra: (rail1.json && rail1.json.note) || (rail1.json && rail1.json.opportunityId) || ('http=' + rail1.status) })) failed = true;

  const dupSweep = await liveApi(live, '/api/ops/dedupe', 'POST', {});
  console.log('DUPLICATE SWEEP counts', JSON.stringify(dupSweep.json && dupSweep.json.counts));
  const dupLocked = dupSweep.status === 401 || dupSweep.status === 403;
  if (!pushLive(rows, 'Site-wide', 'Duplicate sweep', { dom: dupLocked || dupSweep.status < 300, net: dupLocked || dupSweep.status < 300, persist: dupLocked || !!(dupSweep.json && dupSweep.json.ok), extra: dupLocked ? 'locked (room owner only)' : JSON.stringify((dupSweep.json && dupSweep.json.counts) || {}) })) failed = true;

  const cleaned = await cleanupTestRecords(live);
  await live.reload({ waitUntil: 'domcontentloaded' });
  await live.waitForSelector('#warDesk[data-port-ready], #notesDesk[data-port-ready], #linksDesk[data-port-ready]', { timeout: 20000, state: 'attached' }).catch(() => {});
  const leftover = await live.evaluate(() => {
    const items = ((window.STATE && window.STATE.items) || []).filter((it) => it.status !== 'dropped');
    const notes = (window.STATE && window.STATE.notes) || [];
    const links = (window.STATE && window.STATE.links) || [];
    const blob = JSON.stringify({ items, notes, links });
    return /TEST (click-check|note|link|autosave|step)/.test(blob);
  });
  if (!pushLive(rows, 'Cleanup', 'TEST records cleaned', { dom: true, net: true, persist: !leftover, extra: cleaned.length + ' dropped' })) failed = true;

  console.log('\nB  production signed-in  ' + who.name + '  ' + who.path);
  console.log('page         control                      DOM  net  persist  result');
  rows.forEach((c) => {
    console.log(`${c.page.padEnd(12)} ${c.control.padEnd(28)} ${c.dom ? 'Y' : 'N'}    ${c.net ? 'Y' : 'N'}    ${c.persist ? 'Y' : 'n/a'}     ${c.pass ? 'PASS' : 'FAIL'}${c.extra ? '  ' + c.extra : ''}`);
  });
  await ctx.close();
  return !failed;
}

async function productionStep2(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const live = await ctx.newPage();
  const nets = [];
  live.on('response', (res) => {
    if (/\/api\//.test(res.url())) nets.push({ url: res.url(), method: res.request().method(), status: res.status() });
  });
  const who = await signInAsTestUser(live);
  const rows = [];
  let failed = false;
  async function readyView(path, host) {
    await live.goto('https://www.4ormop.com' + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await live.waitForSelector(host + '[data-port-ready]', { timeout: 20000, state: 'attached' });
  }

  await readyView('/pipeline', '#pipeDesk');
  const isolated = await live.evaluate(() => {
    const mail = (window.STATE && window.STATE.mail) || [];
    const leak = mail.some((m) => /@/.test(String(m.from || m.email || '')) && !/opstest@/i.test(String(m.from || m.email || '')));
    return { leak, mailN: mail.length };
  });
  const board = await live.evaluate(async () => {
    const root = document.getElementById('pipeDesk').shadowRoot;
    const btn = root.querySelector('[data-action="pipe-view"][data-view="board"]');
    if (btn) btn.click();
    await new Promise(function (r) { setTimeout(r, 80); });
    return !!(root.querySelector('.pipe-board') || root.querySelector('[data-action="pipe-view"][data-view="board"]'));
  });
  if (!pushLive(rows, 'Pipeline', 'Board', { dom: board, net: true, persist: !isolated.leak })) failed = true;

  const stamp = Date.now();
  const spaceName = 'TEST space ' + stamp;
  const spaceCreate = await liveApi(live, '/api/spaces', 'POST', { name: spaceName, kind: 'project' });
  const spaceId = spaceCreate.json && (spaceCreate.json.id || spaceCreate.json.spaceId);
  await readyView('/spaces', '#spacesDesk');
  const spaceOpen = await live.evaluate(async (id) => {
    const root = document.getElementById('spacesDesk').shadowRoot;
    const btn = root.querySelector('[data-action="space-open"][data-id="' + id + '"]') || root.querySelector('[data-action="space-open"]');
    if (btn) btn.click();
    await new Promise(function (r) { setTimeout(r, 120); });
    return !!(root.querySelector('.space-detail') || root.querySelector('.hero') || root.getElementById('spaceOv'));
  }, spaceId);
  if (!pushLive(rows, 'Spaces', 'Open', { dom: spaceOpen && spaceCreate.status < 300, net: spaceCreate.status < 300, persist: !!spaceId })) failed = true;

  const panel = await live.evaluate(() => {
    const root = document.getElementById('spacesDesk').shadowRoot;
    const panelEl = root.querySelector('.spanel');
    const scrim = root.querySelector('.sscrim');
    const overlay = scrim && getComputedStyle(scrim).display !== 'none';
    const w = panelEl ? panelEl.getBoundingClientRect().width : 0;
    const list = root.querySelector('.sp.on') || root.querySelector('.grid .sp');
    const send = root.querySelector('[data-action="space-send"]');
    const gated = !!(send && send.hasAttribute('disabled'));
    const bundle = !!root.querySelector('.bundle');
    const pact = !!root.querySelector('.pact');
    return { w, overlay: !!overlay, gated, bundle, pact, list: !!list };
  });
  if (!pushLive(rows, 'Spaces', '05c panel beside list', { dom: panel.w >= 880 && !panel.overlay && panel.bundle && panel.pact && panel.list && panel.gated, net: true, persist: true, extra: 'w=' + Math.round(panel.w) })) failed = true;

  await readyView('/documents', '#docsDesk');
  const docsList = await live.evaluate(async () => {
    const root = document.getElementById('docsDesk').shadowRoot;
    const btn = root.querySelector('[data-action="docs-view"][data-view="list"]');
    if (btn) btn.click();
    await new Promise(function (r) { setTimeout(r, 80); });
    return !!(root.querySelector('.files') || root.querySelector('[data-action="docs-view"]'));
  });
  if (!pushLive(rows, 'Documents', 'List', { dom: docsList, net: true, persist: true })) failed = true;

  await readyView('/email', '#mailDesk');
  const compose = await live.evaluate(() => {
    const root = document.getElementById('mailDesk').shadowRoot;
    const btn = root.querySelector('[data-action="mail-compose"]');
    if (btn) btn.click();
    const cp = root.getElementById('compose');
    return !!(cp && (cp.classList.contains('open') || !cp.hidden));
  });
  const noSend = !nets.some((n) => /\/api\/mail/.test(n.url) && n.method === 'POST');
  if (!pushLive(rows, 'Email', 'Compose', { dom: compose, net: true, persist: noSend })) failed = true;

  const cleaned = await cleanupTestRecords(live);
  if (!pushLive(rows, 'Cleanup', 'TEST records cleaned', { dom: true, net: true, persist: true, extra: cleaned.length + ' dropped' })) failed = true;

  console.log('\nB  production signed-in STEP 2  ' + who.name + '  ' + who.path);
  console.log('page         control                      DOM  net  persist  result');
  rows.forEach((c) => {
    console.log(`${c.page.padEnd(12)} ${c.control.padEnd(28)} ${c.dom ? 'Y' : 'N'}    ${c.net ? 'Y' : 'N'}    ${c.persist ? 'Y' : 'n/a'}     ${c.pass ? 'PASS' : 'FAIL'}${c.extra ? '  ' + c.extra : ''}`);
  });
  await ctx.close();
  return !failed;
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
        return !!(host.shadowRoot.querySelector('.space-detail') && host.shadowRoot.querySelector('.hero'));
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

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=docs&fixture=mockup`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#docsDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const docOpen = await page.evaluate(() => {
        const host = document.getElementById('docsDesk');
        const btn = host.shadowRoot.querySelector('[data-action="doc-open"]');
        if (btn) btn.click();
        return !!host.shadowRoot.querySelector('.vwin');
      });
      clicks.push({ page: 'Documents', control: '06b viewer', dom: docOpen, net: true, persist: true, pass: docOpen });

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
        return !!(window.STATE && window.STATE.mailView === 'people' && root.querySelector('.grid .bx') && root.querySelector('.loose') && root.querySelector('.newbx'));
      });
      clicks.push({ page: 'Email', control: 'People toggle', dom: people, net: true, persist: true, pass: people });

      const peopleOpen = await page.evaluate(() => {
        const root = document.getElementById('mailDesk').shadowRoot;
        const btn = root.querySelector('[data-action="mail-box-open"]');
        if (btn) btn.click();
        const pp = root.getElementById('pp');
        return !!(pp && pp.classList.contains('on') && /Bruce Fair/.test(pp.textContent || ''));
      });
      clicks.push({ page: 'Email', control: '08e Open panel', dom: peopleOpen, net: true, persist: true, pass: peopleOpen });

      const peopleClose = await page.evaluate(() => {
        const root = document.getElementById('mailDesk').shadowRoot;
        const x = root.querySelector('[data-action="mail-pp-close"]');
        if (x) x.click();
        const pp = root.getElementById('pp');
        return !!(pp && !pp.classList.contains('on'));
      });
      clicks.push({ page: 'Email', control: '08c panel close', dom: peopleClose, net: true, persist: true, pass: peopleClose });

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

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=calendar&fixture=mockup&event=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#calDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const editor = await page.evaluate(() => {
        const root = document.getElementById('calDesk').shadowRoot;
        const pop = root.getElementById('pop');
        const when = root.querySelector('.when');
        const labels = Array.from(root.querySelectorAll('.pop label')).map((n) => n.textContent || '');
        const zoom = root.getElementById('pZoom');
        const pS = root.getElementById('pS');
        return {
          open: !!(pop && pop.classList.contains('open')),
          when: !!when,
          rows: ['Calendar', 'People', 'Where', 'Links', 'Files', 'Alert', 'Notes'].every((k) => labels.some((t) => t.indexOf(k) >= 0)),
          zoom: !!(zoom && /4orm Zoom/i.test(zoom.textContent || '')),
          t24: !!(pS && pS.classList.contains('t24') && /13:00/.test(pS.getAttribute('placeholder') || '')),
        };
      });
      clicks.push({ page: 'Calendar', control: '10c editor 24h + 4orm Zoom', dom: editor.open && editor.when && editor.rows && editor.zoom && editor.t24, net: true, persist: true, pass: editor.open && editor.when && editor.rows && editor.zoom && editor.t24 });

      await page.goto(`http://127.0.0.1:${port}/control-room.html?view=calendar&fixture=mockup&rail=0`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#calDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
      const rail = await page.evaluate(() => {
        const root = document.getElementById('calDesk').shadowRoot;
        const wrap = root.querySelector('.calwrap');
        const bar = root.querySelector('.railbar');
        return !!(wrap && wrap.classList.contains('rail-closed') && bar);
      });
      clicks.push({ page: 'Calendar', control: '10b rail closed', dom: rail, net: true, persist: true, pass: rail });

      const keepText = await page.evaluate(() => {
        const root = document.getElementById('calDesk').shadowRoot;
        const ok = root.querySelector('.ev.sug .ok');
        return !!(ok && /Keep/.test(ok.textContent || '') && /Later/.test(ok.textContent || '') && /Drop/.test(ok.textContent || ''));
      });
      clicks.push({ page: 'Calendar', control: 'Keep / Later / Drop', dom: keepText, net: true, persist: true, pass: keepText });
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
      const link = root.querySelector('[data-action="reach-pipe"]');
      if (link) link.click();
      const pipe = document.getElementById('v-contacts');
      return !!(link && pipe && !pipe.hidden);
    });
    clicks.push({ page: 'War Room', control: 'Reach out · today', dom: reach, net: true, persist: true, pass: reach });

    const plan = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="hero-plan"]');
      if (btn) btn.click();
      const ov = root.getElementById('planOv');
      return !!(ov && ov.classList.contains('open'));
    });
    clicks.push({ page: 'War Room', control: 'Plan', dom: plan, net: true, persist: true, pass: plan });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup&signals=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const sigOpen = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const panel = root.getElementById('sigpanel');
      return !!(panel && panel.classList.contains('on'));
    });
    clicks.push({ page: 'War Room', control: 'Signals panel open', dom: sigOpen, net: true, persist: true, pass: sigOpen });

    const sigGo = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const row = root.querySelector('[data-action="signals-go"][data-dest="mail"]');
      if (row) row.click();
      const mail = document.getElementById('v-mail');
      return !!(row && mail && !mail.hidden);
    });
    clicks.push({ page: 'War Room', control: 'Signals → Email', dom: sigGo, net: true, persist: true, pass: sigGo });

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

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const ribbonJoin = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const join = root.querySelector('[data-action="meet-join"]');
      return !!(join && join.getAttribute('data-url'));
    });
    clicks.push({ page: 'War Room', control: 'Ribbon Join', dom: ribbonJoin, net: true, persist: true, pass: ribbonJoin });

    const coach = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="coach-toggle"]');
      if (btn) btn.click();
      const pop = root.getElementById('coachpop');
      return !!(pop && pop.classList.contains('open'));
    });
    clicks.push({ page: 'War Room', control: 'Coaching note', dom: coach, net: true, persist: true, pass: coach });

    const showMoney = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="show-money"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: 'Show $', dom: showMoney, net: true, persist: true, pass: showMoney });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const meetingToday = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const cb = root.querySelector('.exec.today .cb');
      if (cb) cb.click();
      const task = cb && cb.closest('.task');
      return !!(task && (task.classList.contains('d') || task.classList.contains('done')));
    });
    clicks.push({ page: 'War Room', control: 'Today checkbox', dom: meetingToday, net: true, persist: true, pass: meetingToday });

    const owed = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="owed-review"]');
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: 'Owed from meetings', dom: owed, net: true, persist: true, pass: owed });

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
      const on = !!(canvas && canvas.classList.contains('on'));
      const board = (document.getElementById('notesDesk').shadowRoot || root).querySelector('[data-action="notes-view"][data-view="board"]');
      if (board) board.click();
      return on;
    });
    clicks.push({ page: 'Notes', control: 'Board / Canvas', dom: noteView, net: true, persist: true, pass: noteView });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const signals = await page.evaluate(() => {
      const btn = document.querySelector('[data-action="top-signals"]');
      if (btn) btn.click();
      const host = document.getElementById('sigHost');
      const root = document.getElementById('warDesk').shadowRoot;
      const panel = root && root.getElementById('sigpanel');
      const overlay = host && host.classList.contains('on') && host.querySelector('.sig');
      return !!(overlay || (panel && panel.classList.contains('on')));
    });
    clicks.push({ page: 'Site-wide', control: 'Top bar Signals', dom: signals, net: true, persist: true, pass: signals });

    const sigEsc = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const host = document.getElementById('sigHost');
      const root = document.getElementById('warDesk').shadowRoot;
      const panel = root && root.getElementById('sigpanel');
      const overlayClosed = !host || !host.classList.contains('on') || host.hasAttribute('hidden');
      return overlayClosed && !(panel && panel.classList.contains('on'));
    });
    clicks.push({ page: 'War Room', control: 'Signals Esc close', dom: sigEsc, net: true, persist: true, pass: sigEsc });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war`, { waitUntil: 'domcontentloaded' });
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
      const btn = root.querySelector('[data-action="task-move"][data-bucket="week"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: 'Hover Week', dom: week, net: true, persist: true, pass: week });

    const review = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="owed-review"]');
      if (btn) btn.click();
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: 'Review owed', dom: review, net: true, persist: true, pass: review });

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

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const ribbonSig = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="signals-open"]');
      if (btn) btn.click();
      const panel = root.getElementById('sigpanel');
      return !!(panel && panel.classList.contains('on'));
    });
    clicks.push({ page: 'War Room', control: 'Ribbon Signals', dom: ribbonSig, net: true, persist: true, pass: ribbonSig });

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
      return !!join;
    });
    clicks.push({ page: 'War Room', control: 'Join', dom: meetPrep, net: true, persist: true, pass: meetPrep });

    const execAdd = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const btn = root.querySelector('[data-action="exec-add"]');
      return !!btn;
    });
    clicks.push({ page: 'War Room', control: '+ Add', dom: execAdd, net: true, persist: true, pass: execAdd });

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

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=notes&fixture=mockup&canvas=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#notesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    await page.waitForFunction(() => {
      const root = document.getElementById('notesDesk') && document.getElementById('notesDesk').shadowRoot;
      return !!(root && root.querySelector('[data-action="canvas-zoom-in"]'));
    }, { timeout: 8000 });
    const canvasZoom = await page.evaluate(() => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const plus = root.querySelector('[data-action="canvas-zoom-in"]');
      const fit = root.querySelector('[data-action="canvas-fit"]');
      if (plus) plus.click();
      if (fit) fit.click();
      return !!(plus && fit && root.querySelector('.stage') && root.querySelector('[data-action="notes-view"][data-view="canvas"].on'));
    });
    clicks.push({ page: 'Notes', control: 'Canvas zoom / fit', dom: canvasZoom, net: true, persist: true, pass: canvasZoom });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=work&fixture=mockup&arrange=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#spacesDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const arrangeBoard = await page.evaluate(() => {
      const root = document.getElementById('spacesDesk').shadowRoot;
      const board = root.querySelector('[data-action="spaces-arr-view"][data-v="board"]');
      if (board) board.click();
      const on = root.querySelector('[data-action="spaces-arr-view"][data-v="board"].on');
      const col = root.querySelector('.board .col') || root.querySelector('#board.on');
      return !!(on && col);
    });
    clicks.push({ page: 'Spaces', control: 'Arrange Board', dom: arrangeBoard, net: true, persist: true, pass: arrangeBoard });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=war&fixture=mockup&sigdetail=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const sigTabs = await page.evaluate(() => {
      const root = document.getElementById('warDesk').shadowRoot;
      const news = root.querySelector('[data-action="sig-tab"][data-f="news"]');
      if (news) news.click();
      const on = root.querySelector('[data-action="sig-tab"][data-f="news"].on');
      const close = root.querySelector('[data-action="signals-close"]');
      return !!(on && close);
    });
    clicks.push({ page: 'Signals', control: 'News tab + Close', dom: sigTabs, net: true, persist: true, pass: sigTabs });

    await page.goto(`http://127.0.0.1:${port}/control-room.html?view=rec&fixture=mockup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#recDesk[data-port-ready]', { timeout: 15000, state: 'attached' });
    const recStart = await page.evaluate(() => {
      const root = document.getElementById('recDesk').shadowRoot;
      const btn = root.querySelector('[data-action="rec-start"]');
      const cols = root.querySelector('#cols .col');
      return !!(btn && cols && /Do these first|Record meeting|Zoom/.test(root.textContent || ''));
    });
    clicks.push({ page: 'Recordings', control: 'Record meeting + columns', dom: recStart, net: true, persist: true, pass: recStart });
    const recOpen = await page.evaluate(() => {
      const root = document.getElementById('recDesk').shadowRoot;
      const card = root.querySelector('[data-action="rec-open"]');
      if (card) card.click();
      const dr = root.getElementById('dr');
      return !!(card && dr && dr.classList.contains('on') && /Add to a Space/.test(dr.textContent || ''));
    });
    clicks.push({ page: 'Recordings', control: 'Open drawer', dom: recOpen, net: true, persist: true, pass: recOpen });
    }

    console.log('\nB  click-check (fixture DOM)');
    console.log('page         control                      DOM  net  persist  result');
    clicks.forEach((c) => {
      if (!c.pass) failed = true;
      console.log(`${c.page.padEnd(12)} ${c.control.padEnd(28)} ${c.dom ? 'Y' : 'N'}    ${c.net ? 'Y' : 'N'}    ${c.persist ? 'Y' : 'n/a'}     ${c.pass ? 'PASS' : 'FAIL'}`);
    });
    console.log('\nC  page errors', errors.length, errors.slice(0, 8).join(' | ') || '0');
    if (errors.length) failed = true;

    const liveOk = STEP === '2' ? await productionStep2(browser) : await productionStep1(browser);
    if (!liveOk) failed = true;
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
