import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://www.4ormop.com';
const AUTH = process.env.PLAYWRIGHT_STORAGE || resolve(ROOT, 'playwright/.auth/user.json');
const TITLE = 'TEST cal-interact ' + Date.now();
const ATTENDEE = 'chad@4ormfinance.com';
const rows = [];
const createdIds = [];

function log(step, ok, extra) {
  const line = { step, ok, extra: extra || '' };
  rows.push(line);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${extra ? '  ' + extra : ''}`);
}

function hourMs(day, hour) {
  const [y, m, d] = day.split('-').map(Number);
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

async function api(page, method, body, qs) {
  return page.evaluate(async ({ method, body, qs }) => {
    const url = '/api/calendar' + (qs || '');
    const opts = { method, credentials: 'include', headers: { 'content-type': 'application/json' } };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const json = await r.json().catch(() => null);
    return { status: r.status, json };
  }, { method, body, qs });
}

async function findEvent(page, title) {
  const list = await api(page, 'GET', null, '');
  const events = (list.json && list.json.events) || [];
  return events.filter((e) => String(e.title || '').indexOf(title) >= 0);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctxOpts = { viewport: { width: 1440, height: 900 } };
  if (existsSync(AUTH)) ctxOpts.storageState = JSON.parse(readFileSync(AUTH, 'utf8'));
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  try {
    await page.goto(BASE.replace(/\/$/, '') + '/calendar', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const signedIn = await page.locator('.clock, #calDesk, .side .nav').first().waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
    if (!signedIn || page.url().includes('sign-in') || page.url().endsWith('/')) {
      log('signed-in session', false, 'no Clerk session — set PLAYWRIGHT_STORAGE or playwright/.auth/user.json');
      return;
    }
    log('signed-in session', true, page.url());

    const start = hourMs('2026-10-19', 10);
    const created = await api(page, 'POST', { title: TITLE, start, dur: 60, attendees: [ATTENDEE] });
    const id = created.json && created.json.id;
    if (!id) {
      log('create TEST event via API', false, JSON.stringify(created.json));
      return;
    }
    createdIds.push(id);
    log('create TEST event via API', true, id);

    await page.goto(BASE.replace(/\/$/, '') + '/calendar', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);

    const handle = page.locator('#calDesk');
    const ev = handle.locator(`.ev.real[data-t="${TITLE}"]`).first();
    const visible = await ev.count().then((n) => n > 0).catch(() => false);
    log('TEST event in DOM', visible, visible ? await ev.getAttribute('data-s') : 'missing');
    if (!visible) return;

    const box = await ev.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 10 + 46, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const afterHour = await ev.getAttribute('data-s');
    const apiHour = await findEvent(page, TITLE);
    const apiS = apiHour[0] ? new Date(apiHour[0].start) : null;
    log('drag 1 hour later DOM', Number(afterHour) >= 10.75, 's=' + afterHour);
    log('drag 1 hour later API', !!(apiHour[0] && apiHour[0].start >= start + 45 * 60 * 1000), apiHour[0] ? String(apiHour[0].start) : 'none');

    const box2 = await ev.boundingBox();
    await page.mouse.move(box2.x + 20, box2.y + 10);
    await page.mouse.down();
    await page.mouse.move(box2.x + 180, box2.y + 10, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const afterDay = await ev.getAttribute('data-d');
    const apiDay = await findEvent(page, TITLE);
    log('drag 1 day right DOM', afterDay !== '2026-10-19', 'd=' + afterDay);
    log('drag 1 day right API', !!(apiDay[0] && apiDay[0].start !== start), apiDay[0] ? String(apiDay[0].start) : 'none');

    const box3 = await ev.boundingBox();
    await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height - 2);
    await page.mouse.down();
    await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height + 46, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const afterResize = await ev.getAttribute('data-e');
    const apiResize = await findEvent(page, TITLE);
    log('resize DOM', Number(afterResize) > Number(afterHour || 11), 'e=' + afterResize);
    log('resize API', !!(apiResize[0] && apiResize[0].dur >= 75), apiResize[0] ? 'dur=' + apiResize[0].dur : 'none');

    const col = handle.locator('.col[data-k="2026-10-21"]').first();
    const colBox = await col.boundingBox();
    if (colBox) {
      await page.mouse.move(colBox.x + 30, colBox.y + 46 * 2);
      await page.mouse.down();
      await page.mouse.move(colBox.x + 30, colBox.y + 46 * 3, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      const titleIn = handle.locator('#pTitle');
      if (await titleIn.count()) {
        await titleIn.fill(TITLE + ' created');
        await handle.locator('#pPplIn').fill(ATTENDEE);
        await handle.locator('#pPplIn').press('Enter');
        await handle.locator('#pLinkIn').fill('https://4ormfinance.com');
        await handle.locator('#pLinkIn').press('Enter');
        await handle.locator('#pSave').click();
        await page.waitForTimeout(900);
      }
    }
    const createdDom = await handle.locator(`.ev.real[data-t="${TITLE} created"]`).count();
    const createdApi = await findEvent(page, TITLE + ' created');
    if (createdApi[0] && createdApi[0].id) createdIds.push(createdApi[0].id);
    log('drag-to-create DOM', createdDom > 0, 'count=' + createdDom);
    log('drag-to-create API', createdApi.length > 0, createdApi[0] ? createdApi[0].id : 'none');

    if (createdDom) {
      await handle.locator(`.ev.real[data-t="${TITLE} created"]`).first().click();
      await page.waitForTimeout(200);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(700);
      const goneDom = await handle.locator(`.ev.real[data-t="${TITLE} created"]`).count();
      const goneApi = await findEvent(page, TITLE + ' created');
      log('Delete key DOM', goneDom === 0, 'count=' + goneDom);
      log('Delete key API', goneApi.length === 0, 'count=' + goneApi.length);
      await page.keyboard.press('Meta+z');
      await page.waitForTimeout(900);
      const undoDom = await handle.locator(`.ev.real[data-t="${TITLE} created"]`).count();
      const undoApi = await findEvent(page, TITLE + ' created');
      if (undoApi[0] && undoApi[0].id) createdIds.push(undoApi[0].id);
      log('Cmd+Z DOM', undoDom > 0, 'count=' + undoDom);
      log('Cmd+Z API', undoApi.length > 0, undoApi[0] ? undoApi[0].id : 'none');
    } else {
      log('Delete key DOM', false, 'no created event');
      log('Delete key API', false, 'skipped');
      log('Cmd+Z DOM', false, 'skipped');
      log('Cmd+Z API', false, 'skipped');
    }
  } catch (err) {
    log('runner', false, String(err && err.message || err));
  } finally {
    try {
      for (const id of [...new Set(createdIds)]) {
        await api(page, 'DELETE', { id });
      }
      log('cleanup TEST events', true, createdIds.join(','));
    } catch (e) {
      log('cleanup TEST events', false, String(e && e.message || e));
    }
    await browser.close();
  }
  const failed = rows.filter((r) => !r.ok).length;
  console.log('\nstep\tok\tdetail');
  rows.forEach((r) => console.log(`${r.step}\t${r.ok ? 'PASS' : 'FAIL'}\t${r.extra}`));
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
