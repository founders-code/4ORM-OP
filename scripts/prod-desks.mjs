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

function mounted(page) {
  return page.evaluate(() => {
    const views = Array.from(document.querySelectorAll('.view'));
    const shown = views.filter((v) => {
      if (v.hidden) return false;
      const s = getComputedStyle(v);
      return s.display !== 'none' && s.visibility !== 'hidden';
    });
    const view = shown[0] || null;
    const desks = view ? Array.from(view.querySelectorAll('[id$="Desk"]')) : [];
    const vis = desks.map((d) => {
      const s = getComputedStyle(d);
      return {
        id: d.id,
        display: s.display,
        hidden: !!d.hidden,
        h: Math.round(d.getBoundingClientRect().height),
        controls: ((d.shadowRoot || d).querySelectorAll ? (d.shadowRoot || d).querySelectorAll('button, [data-action], .day, .tl, .hx').length : 0),
      };
    });
    const mountedDesk = vis.filter((d) => d.display !== 'none' && !d.hidden && d.h > 0)[0] || vis[0] || null;
    const h1 = (function () {
      const host = mountedDesk && document.getElementById(mountedDesk.id);
      const root = host && (host.shadowRoot || host);
      const el = root && root.querySelector && root.querySelector('h1');
      return el ? String(el.textContent || '').trim() : '';
    })();
    return {
      path: location.pathname,
      view: view && view.id,
      desk: mountedDesk && mountedDesk.id,
      display: mountedDesk && mountedDesk.display,
      height: mountedDesk && mountedDesk.h,
      h1,
      vis,
      email: (window.Clerk && window.Clerk.user && window.Clerk.user.primaryEmailAddress && window.Clerk.user.primaryEmailAddress.emailAddress) || '',
    };
  });
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
  await page.waitForTimeout(1800);
  const got = await mounted(page);
  const ok = got.desk === r.desk && got.display !== 'none' && (got.height || 0) > 20;
  const playOk = r.path !== '/playbook' || (got.desk === 'playDesk' && got.display === 'block' && got.height > 20);
  const planOk = r.path !== '/planner' || (got.desk === 'plannerDesk' && !/war room/i.test(got.h1 || ''));
  const warOk = r.path !== '/war-room' || got.desk === 'warDesk';
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
  const n = root.querySelectorAll('button, [data-action], .day, .tl, .hx, .pads span').length;
  return inv ? inv.withAction : n;
});
console.log('completed controls', doneN);

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
