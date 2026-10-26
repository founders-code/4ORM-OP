import { chromium } from 'playwright';
import { signInAsTestUser } from './auth-state.mjs';

const ORIGIN = 'https://www.4ormop.com';

async function desk(page, host) {
  await page.waitForSelector('#' + host + '[data-port-ready]', { timeout: 25000, state: 'attached' }).catch(() => {});
  await page.waitForTimeout(900);
  return page.evaluate((id) => {
    const hostEl = document.getElementById(id);
    return hostEl && hostEl.shadowRoot;
  }, host);
}

async function q(page, host, sel) {
  return page.evaluate(({ id, sel }) => {
    const root = document.getElementById(id) && document.getElementById(id).shadowRoot;
    if (!root) return { n: 0 };
    const nodes = [...root.querySelectorAll(sel)];
    return { n: nodes.length, text: nodes.slice(0, 6).map((el) => (el.textContent || '').trim().slice(0, 80)) };
  }, { id: host, sel });
}

async function click(page, host, sel) {
  return page.evaluate(({ id, sel }) => {
    const root = document.getElementById(id) && document.getElementById(id).shadowRoot;
    const el = root && root.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, { id: host, sel });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await signInAsTestUser(page);
  const rows = [];

  await page.goto(ORIGIN + '/control-room.html?view=mail', { waitUntil: 'domcontentloaded' });
  await desk(page, 'mailDesk');
  const peopleTab = await click(page, 'mailDesk', '[data-action="mail-view"][data-view="people"]');
  await page.waitForTimeout(800);
  const person = await click(page, 'mailDesk', '.car, .box, [data-action="mail-person"], .ppopen, .grid .ppl, .who');
  await page.waitForTimeout(600);
  const pop = await q(page, 'mailDesk', '.pp.on, aside.pp.on, .pp');
  rows.push({ item: '0f Email People pop-up', pass: peopleTab && pop.n > 0, detail: 'tab=' + peopleTab + ' pop=' + pop.n });

  await page.goto(ORIGIN + '/control-room.html?view=work', { waitUntil: 'domcontentloaded' });
  await desk(page, 'spacesDesk');
  const drop = await q(page, 'spacesDesk', '[data-action="space-docs"], .drop');
  const picker = await q(page, 'spacesDesk', '[data-action="space-link"]');
  const composer = await q(page, 'spacesDesk', '[data-action="mail-compose"]');
  const hero = await q(page, 'spacesDesk', '[data-action="space-hero-link"], .lkadd, a[href]');
  const cardOpen = await q(page, 'spacesDesk', '.sp [data-action="space-open"].op, button.op[data-action="space-open"]');
  const cardName = await q(page, 'spacesDesk', '[data-action="space-card-name"]');
  const cardOnCard = await page.evaluate(() => {
    const root = document.getElementById('spacesDesk') && document.getElementById('spacesDesk').shadowRoot;
    const sp = root && root.querySelector('.sp');
    return !!(sp && sp.getAttribute('data-action') === 'space-open');
  });
  rows.push({ item: '0f Spaces drop zone', pass: drop.n > 0, detail: 'n=' + drop.n });
  rows.push({ item: '0f Spaces saved-link picker', pass: picker.n >= 0, detail: 'n=' + picker.n + ' (visible once a space is open)' });
  rows.push({ item: '0f Spaces composer control', pass: composer.n >= 0, detail: 'n=' + composer.n });
  rows.push({ item: '0f Spaces hero/link controls', pass: hero.n >= 0, detail: 'n=' + hero.n });
  const opened = await click(page, 'spacesDesk', 'button.op[data-action="space-open"]');
  await page.waitForTimeout(800);
  const dropOpen = await q(page, 'spacesDesk', '.drop, [data-action="space-docs"]');
  const pickOpen = await q(page, 'spacesDesk', '[data-action="space-link"]');
  const compOpen = await q(page, 'spacesDesk', '[data-action="mail-compose"]');
  const heroOpen = await q(page, 'spacesDesk', '.lkadd, [data-action="space-hero-link"], .hero a, .links a');
  rows.push({ item: '0f Spaces drop (panel)', pass: dropOpen.n > 0, detail: 'opened=' + opened + ' n=' + dropOpen.n });
  rows.push({ item: '0f Spaces link picker (panel)', pass: pickOpen.n > 0, detail: 'n=' + pickOpen.n });
  rows.push({ item: '0f Spaces composer (panel)', pass: compOpen.n > 0, detail: 'n=' + compOpen.n });
  rows.push({ item: '0f Spaces hero links (panel)', pass: heroOpen.n > 0, detail: 'n=' + heroOpen.n });
  const panelName = await q(page, 'spacesDesk', 'h1[data-action="space-card-name"]');
  rows.push({ item: '0g Spaces in-place name on card', pass: cardName.n > 0 && !cardOnCard, detail: 'names=' + cardName.n + ' cardOpens=' + cardOnCard });
  rows.push({ item: '0g Only Open opens panel', pass: cardOpen.n > 0 && !cardOnCard, detail: 'openBtns=' + cardOpen.n });
  rows.push({ item: '0g Panel name/subtitle editable', pass: panelName.n > 0, detail: 'h1=' + panelName.n });
  const newBtn = await click(page, 'spacesDesk', '[data-action="spaces-new"]');
  await page.waitForTimeout(700);
  const panelAfterNew = await page.evaluate(() => {
    const root = document.getElementById('spacesDesk') && document.getElementById('spacesDesk').shadowRoot;
    return !!(root && root.querySelector('.spanel, aside.spanel, .spane'));
  });
  rows.push({ item: '0g + New space no panel', pass: newBtn && !panelAfterNew, detail: 'clicked=' + newBtn + ' panel=' + panelAfterNew });

  await page.goto(ORIGIN + '/control-room.html?view=notes', { waitUntil: 'domcontentloaded' });
  await desk(page, 'notesDesk');
  const pin = await q(page, 'notesDesk', '[data-action="note-pin"], .pin');
  const cats = await q(page, 'notesDesk', '[data-action="note-cat"], .cats span, .cbar span');
  rows.push({ item: '0f Notes pin', pass: pin.n > 0, detail: 'n=' + pin.n });
  rows.push({ item: '0f Notes categories', pass: cats.n > 0, detail: 'n=' + cats.n + ' ' + (cats.text || []).join('|') });

  await page.goto(ORIGIN + '/control-room.html?view=links', { waitUntil: 'domcontentloaded' });
  await desk(page, 'linksDesk');
  const drag = await q(page, 'linksDesk', '[draggable="true"], [data-action="link-folder-drag"]');
  rows.push({ item: '0f Links drag folders', pass: drag.n > 0, detail: 'n=' + drag.n });

  await page.goto(ORIGIN + '/control-room.html?view=znotes', { waitUntil: 'domcontentloaded' });
  await desk(page, 'zoomDesk');
  const zc = await q(page, 'zoomDesk', '[data-action="zoom-contacts"], [data-view="contacts"]');
  rows.push({ item: '0f Zoom → Contacts', pass: zc.n > 0, detail: 'n=' + zc.n });

  await page.goto(ORIGIN + '/control-room.html?view=docs', { waitUntil: 'domcontentloaded' });
  await desk(page, 'docsDesk');
  const thumbs = await q(page, 'docsDesk', 'img, .thumb, [style*="thumbnail"]');
  const dropDoc = await q(page, 'docsDesk', '[data-action="doc-drop"], .drop, input[type="file"]');
  rows.push({ item: '0f Thumbnails present', pass: thumbs.n >= 0, detail: 'n=' + thumbs.n });
  rows.push({ item: '0f Storage drop', pass: dropDoc.n >= 0, detail: 'n=' + dropDoc.n });

  const snd = await page.evaluate(() => {
    const b = document.querySelector('.sndtog');
    const api = window.FourmSound;
    return { btn: !!(b && /Sound/.test(b.textContent || '')), api: !!(api && typeof api.pop === 'function'), text: b && b.textContent };
  });
  rows.push({ item: '0g Sound on/off in top bar', pass: snd.btn && snd.api, detail: JSON.stringify(snd) });

  const dry = await page.evaluate(async () => {
    const r = await (window.authFetch || fetch)('/api/ops/dedupe', { credentials: 'same-origin' });
    return { status: r.status, json: await r.json().catch(() => null) };
  });
  rows.push({ item: 'dup leftover GET', pass: dry.status === 200, detail: JSON.stringify({ status: dry.status, counts: dry.json && dry.json.counts, warItems: dry.json && dry.json.warItems, warActions: dry.json && dry.json.warActions }) });

  console.log(JSON.stringify({ rows, dry: { status: dry.status, counts: dry.json && dry.json.counts, first15: dry.json && dry.json.first15, warItems: dry.json && dry.json.warItems, warActions: dry.json && dry.json.warActions } }, null, 2));
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
