import { chromium } from 'playwright';
import { loadLocalEnv } from './load-local-env.mjs';
import { LIVE_ORIGIN, signInAsChad } from './auth-state.mjs';

loadLocalEnv();
const APPLY = process.argv.includes('--apply');
const SKIP_BACKFILL = process.argv.includes('--no-backfill');
const origin = LIVE_ORIGIN;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function ready(page, id) {
  await page.waitForSelector('#' + id + '[data-port-ready]', { timeout: 45000, state: 'attached' });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const who = await signInAsChad(page, origin);
  console.log('PROOF signed-in', who.email);

  const listed = await page.evaluate(async () => {
    const r = await fetch('/api/ops/chad-account', { credentials: 'include' });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  console.log('\n=== FAULT A deleted boxes 2026-10-26 ===');
  const boxes = (listed.body && listed.body.boxes) || [];
  boxes.forEach((block) => {
    console.log('owner', block.ownerId);
    (block.deleted || []).forEach((row) => {
      console.log([row.key, JSON.stringify(row.name), row.deleted_at, 'addrs=' + row.addr_n, 'tags=' + row.tag_n].join('\t'));
    });
    console.log('live', (block.live || []).map((r) => r.key + ':' + JSON.stringify(r.name)).join(' | '));
    console.log('all_boxes', (block.allBoxes || []).length);
    (block.allBoxes || []).forEach((row) => {
      console.log(['all', row.key, JSON.stringify(row.name), row.deleted_at || 'live', row.created_at].join('\t'));
    });
  });
  if (listed.status !== 200) console.log('list_status', listed.status, listed.body);

  if (APPLY) {
    const applied = await page.evaluate(async () => {
      const r = await fetch('/api/ops/chad-account', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apply: true }),
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    });
    console.log('\n=== APPLY ===', applied.status, JSON.stringify(applied.body && { restored: applied.body.boxes, tidy: applied.body.tidy, fpf: applied.body.fpf }));
  }

  let report = { ok: 0, letter: 0, failed: 0, n: 0 };
  if (SKIP_BACKFILL) {
    console.log('\n=== FAULT C backfill skipped ===');
  } else
  for (let offset = 0; offset < 80; offset += 8) {
    const slice = await page.evaluate(async (off) => {
      const r = await fetch('/api/links/preview?backfill=all&offset=' + off, { credentials: 'include' });
      return r.json().catch(() => null);
    }, offset);
    if (!slice || !slice.n) break;
    report.ok += Number(slice.ok || 0);
    report.letter += Number(slice.letter || 0);
    report.failed += Number(slice.failed || 0);
    report.n += Number(slice.n || 0);
    if (slice.next == null) break;
    await sleep(250);
  }
  console.log('\n=== FAULT C backfill ===', report);

  await page.goto(origin + '/email?people=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(page, 'mailDesk');
  await sleep(2500);
  const people = await page.evaluate(() => {
    const r = document.getElementById('mailDesk').shadowRoot;
    const names = [...r.querySelectorAll('.pb h4')].map((el) => el.textContent || '');
    const bruce = names.filter((n) => /bruce\s+fair/i.test(n))[0];
    const card = [...r.querySelectorAll('.pb')].filter((el) => /bruce\s+fair/i.test(el.textContent || ''))[0];
    if (card) card.click();
    return { names: names.slice(0, 12), bruce: !!bruce, n: names.length };
  });
  await sleep(800);
  const opened = await page.evaluate(() => {
    const r = document.getElementById('mailDesk').shadowRoot;
    const pp = r.querySelector('.pp.on, .pc.on');
    const reader = r.querySelector('#ppread, .rd.on, #rd');
    const title = (r.querySelector('.pp.on h2, .pc.on h2, .pc h2') || {}).textContent || '';
    return { panel: !!pp, reader: !!reader, title };
  });
  console.log('\nPROOF A', JSON.stringify({ people: people.n, bruce: people.bruce, opened }));

  await page.goto(origin + '/notes?canvas=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(page, 'notesDesk');
  await sleep(800);
  const notes = await page.evaluate(() => {
    const r = document.getElementById('notesDesk').shadowRoot;
    const cards = [...r.querySelectorAll('.world > .note, .world .note')];
    const nested = r.querySelectorAll('.note .note').length;
    const titles = cards.map((el) => (el.querySelector('h4') && el.querySelector('h4').textContent) || '');
    const blank = titles.filter((t) => !String(t).trim() || /^\d+(\s*[x×]\s*\d+)?$/.test(String(t).trim()));
    function box(el) {
      return { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0, w: parseFloat(el.style.width) || 0, h: parseFloat(el.style.height) || 0 };
    }
    let overlaps = 0;
    const b = cards.map(box);
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        const a = b[i], c = b[j];
        if (a.x < c.x + c.w && a.x + a.w > c.x && a.y < c.y + c.h && a.y + a.h > c.y) overlaps += 1;
      }
    }
    return { n: cards.length, nested, overlaps, blank: blank.length, titles: titles.slice(0, 8) };
  });
  console.log('PROOF B', JSON.stringify(notes));

  await page.goto(origin + '/links', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(page, 'linksDesk');
  await sleep(1500);
  const links = await page.evaluate(() => {
    const r = document.getElementById('linksDesk').shadowRoot;
    const tiles = [...r.querySelectorAll('.tile')];
    const imgs = tiles.filter((t) => t.querySelector('img'));
    const loaded = imgs.filter((t) => {
      const img = t.querySelector('img');
      return img && img.naturalWidth > 0;
    });
    const logos = r.querySelectorAll('img.logo').length;
    return { tiles: tiles.length, withImg: imgs.length, loaded: loaded.length, logos };
  });
  console.log('PROOF C', JSON.stringify(links));

  await page.goto(origin + '/completed', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(page, 'doneDesk');
  await sleep(800);
  const done = await page.evaluate(() => {
    const r = document.getElementById('doneDesk').shadowRoot;
    const house = [...r.querySelectorAll('.hx')].map((el) => ({
      k: (el.querySelector('span') && el.querySelector('span').textContent) || '',
      v: (el.querySelector('b') && el.querySelector('b').textContent) || '',
      p: [...el.querySelectorAll('p')].map((p) => p.textContent).join(' | '),
    }));
    return { house, raw: window.__doneStats || null };
  });
  console.log('PROOF D', JSON.stringify(done));

  await page.goto(origin + '/planner', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(page, 'warDesk');
  await sleep(2000);
  const planner = await page.evaluate(() => {
    const r = document.getElementById('warDesk').shadowRoot;
    const txt = r.textContent || '';
    const fpf = [...r.querySelectorAll('.bar, .ms, .drow, [data-open]')].filter((el) => /Fraud Prevention Forum/i.test(el.textContent || ''));
    const red = (txt.match(/(\d+)\s+overdue or slipping/i) || [])[1];
    const fpfHtml = fpf.map((el) => el.className + '|' + (el.textContent || '').replace(/\s+/g, ' ').slice(0, 80));
    const overdue = [...r.querySelectorAll('.drow .w.late, .bar.overdue, .msi.overdue')].map((el) => (el.closest('[data-open]') || el).textContent.replace(/\s+/g, ' ').trim().slice(0, 80));
    const stats = (r.querySelector('#stats') && r.querySelector('#stats').textContent || '').replace(/\s+/g, ' ').trim();
    const redRows = [...r.querySelectorAll('.drow')].filter((el) => el.querySelector('.w.late')).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());
    return { red, stats, redRows, fpf: fpfHtml.slice(0, 4), overdue: overdue.slice(0, 8), hasDone: /done/i.test(fpfHtml.join(' ')) };
  });
  console.log('PROOF E', JSON.stringify(planner));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
