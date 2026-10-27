import { chromium } from 'playwright';
import { signInAsChad, LIVE_ORIGIN } from './auth-state.mjs';

const ORIGIN = LIVE_ORIGIN;
const ROUTES = [
  { path: '/playbook', desk: 'playDesk' },
  { path: '/planner', desk: 'plannerDesk' },
  { path: '/war-room', desk: 'warDesk' },
  { path: '/control-room', desk: 'opsDesk' },
  { path: '/vault', desk: 'vaultDesk' },
  { path: '/notes', desk: 'notesDesk' },
  { path: '/calendar', desk: 'calDesk' },
  { path: '/completed', desk: 'doneDesk' },
  { path: '/pipeline', desk: 'pipeDesk' },
  { path: '/spaces', desk: 'spacesDesk' },
  { path: '/documents', desk: 'docsDesk' },
  { path: '/email', desk: 'mailDesk' },
  { path: '/people', desk: 'peopleDesk' },
  { path: '/recordings', desk: 'recDesk' },
  { path: '/news', desk: 'newsDesk' },
  { path: '/zoom', desk: 'zoomDesk' },
  { path: '/integrations', desk: 'intDesk' },
  { path: '/financials', desk: 'finDesk' },
];

function mounted(page, expectId) {
  return page.evaluate((expectId) => {
    function findDesk(id) {
      const direct = document.getElementById(id);
      if (direct) return direct;
      const views = Array.from(document.querySelectorAll('.view'));
      for (const v of views) {
        const root = v.shadowRoot;
        if (!root) continue;
        const hit = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
        if (hit) return hit;
      }
      if (typeof window.portEl === 'function') {
        const via = window.portEl('v-news', id);
        if (via) return via;
      }
      return null;
    }
    const host = findDesk(expectId);
    const view = (function () {
      if (!host) return document.getElementById('v-news');
      const root = host.getRootNode && host.getRootNode();
      if (root && root.host) return root.host.id ? root.host : root.host.closest && root.host.closest('.view');
      return host.closest && host.closest('.view');
    })();
    const s = host ? getComputedStyle(host) : null;
    const vs = view ? getComputedStyle(view) : null;
    const root = host && (host.shadowRoot || host);
    const h1s = root && root.querySelectorAll ? Array.from(root.querySelectorAll('h1')) : [];
    const h1 = (h1s.filter((el) => {
      const p = el.closest && (el.closest('#barVault, #barControl, .bar') || el);
      const st = getComputedStyle(p);
      return st.display !== 'none';
    })[0] || h1s[0]);
    return {
      path: location.pathname,
      view: view && view.id,
      viewHidden: !!(view && view.hidden),
      viewDisplay: vs && vs.display,
      desk: host && host.id,
      display: s && s.display,
      hidden: !!(host && host.hidden),
      height: host ? Math.round(host.getBoundingClientRect().height) : 0,
      h1: h1 ? String(h1.textContent || '').trim() : '',
      email: (window.Clerk && window.Clerk.user && window.Clerk.user.primaryEmailAddress && window.Clerk.user.primaryEmailAddress.emailAddress) || '',
    };
  }, expectId);
}

async function jsonGet(page, path) {
  return page.evaluate(async (p) => {
    const r = await fetch(p, { credentials: 'same-origin' });
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  }, path);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const who = await signInAsChad(page, ORIGIN);
console.log('signed in', who.email, 'at', who.path);
const fails = [];
const rows = [];
for (const r of ROUTES) {
  await page.goto(ORIGIN + r.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1600);
  await page.waitForFunction((id) => {
    const host = document.getElementById(id) || (document.getElementById('v-news') && document.getElementById('v-news').shadowRoot && document.getElementById('v-news').shadowRoot.getElementById(id));
    if (!host) return false;
    return getComputedStyle(host).display !== 'none';
  }, r.desk, { timeout: 15000 }).catch(() => {});
  const got = await mounted(page, r.desk);
  const ok = got.desk === r.desk && got.display !== 'none' && !got.hidden && !got.viewHidden;
  const playOk = r.path !== '/playbook' || (got.desk === 'playDesk' && got.display === 'block' && got.height > 20);
  const planOk = r.path !== '/planner' || (got.desk === 'plannerDesk' && !/war room/i.test(got.h1 || '') && /planner/i.test(got.h1 || 'Planner'));
  const warOk = r.path !== '/war-room' || (got.desk === 'warDesk' && got.view === 'v-war');
  const pass = ok && playOk && planOk && warOk;
  rows.push({ path: r.path, expect: r.desk, got: got.desk, display: got.display, h: got.height, h1: got.h1, pass });
  console.log((pass ? 'PASS' : 'FAIL'), r.path, 'expect', r.desk, 'got', got.desk, 'display', got.display, 'h', got.height, 'h1', got.h1);
  if (!pass) fails.push(r.path + ' expected ' + r.desk + ' got ' + JSON.stringify(got));
}

const vault = await jsonGet(page, '/api/vault');
const vdocs = await jsonGet(page, '/api/vault/documents');
const dials = await jsonGet(page, '/api/ops/dials');
const apis = await jsonGet(page, '/api/ops/apis');
const events = await jsonGet(page, '/api/ops/events');
const metrics = await jsonGet(page, '/api/ops/metrics');
console.log('GET /api/vault', vault.status, 'docs', vault.body && vault.body.docs && vault.body.docs.length, vault.body && vault.body.reason);
console.log('GET /api/vault/documents', vdocs.status, 'docs', vdocs.body && vdocs.body.docs && vdocs.body.docs.length, vdocs.body && vdocs.body.reason);
console.log('GET /api/ops/dials', dials.status, dials.body && (dials.body.dials || []).map((d) => d.key + '=' + d.value).join(','));
console.log('GET /api/ops/apis', apis.status, apis.body && (apis.body.apis || []).map((a) => a.key + ' ms=' + a.ms).join(','));
console.log('GET /api/ops/events', events.status, events.body && (events.body.events || []).length, events.body && events.body.reason);
console.log('GET /api/ops/metrics', metrics.status, events.body && metrics.body && (metrics.body.samples || []).length, metrics.body && metrics.body.reason);

await page.goto(ORIGIN + '/vault', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
const vaultUi = await page.evaluate(() => {
  const host = document.getElementById('vaultDesk');
  const root = host && host.shadowRoot;
  const text = root ? root.textContent : '';
  const drawer = root && root.querySelector('#drawer');
  const w = drawer ? Math.round(drawer.getBoundingClientRect().width) : 0;
  return { hasArticles: /Articles of incorporation/.test(text), textSlice: String(text || '').replace(/\s+/g, ' ').slice(0, 180), drawerW: w };
});
console.log('vault UI fixture', vaultUi.hasArticles, 'drawerW', vaultUi.drawerW, vaultUi.textSlice);

await page.goto(ORIGIN + '/control-room', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2200);
const opsUi = await page.evaluate(() => {
  const host = document.getElementById('opsDesk');
  const root = host && host.shadowRoot;
  const text = root ? root.textContent : '';
  const vals = root ? Array.from(root.querySelectorAll('.dial .val')).map((el) => el.textContent.trim()) : [];
  const apiMs = root ? Array.from(root.querySelectorAll('.api .rd b')).map((el) => el.textContent.trim()) : [];
  const tab = root && root.querySelector('#iseg span.on');
  if (tab) tab.click();
  const mapOn = root && root.querySelector('#pg-map') && getComputedStyle(root.querySelector('#pg-map')).display !== 'none';
  return { vals, apiMs, has210: apiMs.indexOf('210') >= 0, hasContactsLog: /GET \/contacts\?limit=100/.test(text), mapOn, tab: tab && tab.textContent };
});
console.log('ops dials', opsUi.vals);
console.log('ops api ms', opsUi.apiMs, 'has210', opsUi.has210, 'ghl log leak', opsUi.hasContactsLog, 'mapOn', opsUi.mapOn);

await page.goto(ORIGIN + '/completed', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1600);
const doneN = await page.evaluate(() => {
  const host = document.getElementById('doneDesk');
  const root = host && host.shadowRoot;
  if (!root) return 0;
  if (typeof window.stampDeskControls === 'function') window.stampDeskControls(root);
  const inv = typeof window.deskInventory === 'function' ? window.deskInventory(root) : null;
  const sel = window.__deskControlSel || 'button, [data-action]';
  return { inventory: inv, marked: root.querySelectorAll('[data-action]').length, sel: root.querySelectorAll(sel).length };
});
console.log('completed controls', JSON.stringify(doneN));

if (vaultUi.hasArticles) fails.push('vault still showing design fixture documents');
if (opsUi.hasContactsLog) fails.push('logs still serving one fixture for every service');
if (opsUi.vals.some((v) => /125|0\.42|11\.97|6\.04/.test(v))) fails.push('dials still showing fixture numbers');
if (vdocs.status === 404) fails.push('/api/vault/documents is 404');
if (events.status === 404) fails.push('/api/ops/events is 404');
if (metrics.status === 404) fails.push('/api/ops/metrics is 404');

await browser.close();
if (fails.length) {
  console.error('FAILED', fails);
  process.exit(1);
}
console.log('PASS 18-route desks + live vault/ops endpoints as', who.email);
