#!/usr/bin/env node
/* Measured proofs signed in as Chad on production after Prompt 14 Ready. */
import { chromium } from 'playwright';
import { LIVE_ORIGIN, signInAsChad, CHAD_EMAIL } from './auth-state.mjs';

const SHA = process.env.P14_SHA || 'pending';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ready(page, id) {
  await page.waitForSelector('#' + id + '[data-port-ready]', { timeout: 60000, state: 'attached' }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const out = { sha: SHA, origin: LIVE_ORIGIN, measuredAt: new Date().toISOString() };

  try {
    const who = await signInAsChad(page, LIVE_ORIGIN);
    out.who = who;
    if (String(who.email || '').toLowerCase() !== CHAD_EMAIL) {
      throw new Error('STOP: not signed in as Chad, got ' + JSON.stringify(who));
    }
    console.log('P14 PROOF signed-in', who.email, 'sha', SHA);

    /* ---- 1 PLAYBOOK (09g colours only) ---- */
    await page.goto(LIVE_ORIGIN + '/playbook', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'playDesk');
    await sleep(1200);
    out.playbook = await page.evaluate(() => {
      const root = document.querySelector('#playDesk')?.shadowRoot || document;
      const wrap = root.querySelector('.pbwrap, #pbwrap, .play') || root;
      const cs = getComputedStyle(wrap);
      const body = cs.color || '';
      const due = root.querySelector('.pad.due, .due, .today .pad');
      const dueColor = due ? getComputedStyle(due).color : '';
      const focus = root.querySelector('[data-view="focus"], [data-act="focus"], .seg [data-v="focus"]');
      const todoCols = root.querySelectorAll('.todo .col, .todos .col, .tday, #todo .col, .todo-cols > *').length;
      const say = !!(root.querySelector('.say, #say, [data-say], textarea.say') || /say it/i.test(wrap.textContent || ''));
      const seqHidden = [...root.querySelectorAll('.seq, .beats, .beatlh')].map((el) => getComputedStyle(el).display === 'none' || el.hidden);
      const today = root.querySelector('.today, #todayBand, .band.today');
      const fri = root.querySelector('#fri, .dh.today, [data-day].today');
      let bandAlign = null;
      if (today && fri) {
        const tb = today.getBoundingClientRect();
        const fb = fri.getBoundingClientRect();
        bandAlign = { todayLeft: Math.round(tb.left), friLeft: Math.round(fb.left), delta: Math.round(tb.left - fb.left) };
      }
      return {
        bodyColor: body,
        dueColor,
        todoCols,
        say,
        seqHiddenSample: seqHidden.slice(0, 3),
        bandAlign,
        sample: (wrap.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180),
      };
    });
    console.log('1 PLAYBOOK', JSON.stringify(out.playbook));

    /* ---- 2 CONTACTS / LISTS rows ---- */
    await page.goto(LIVE_ORIGIN + '/people?tab=lists', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'peopleDesk');
    await sleep(5000);
    out.lists = await page.evaluate(() => {
      const root = document.querySelector('#peopleDesk')?.shadowRoot || document;
      const headers = [...root.querySelectorAll('h1')].map((h) => (h.textContent || '').trim());
      const switches = [...root.querySelectorAll('[data-action="people-tab"], #mode button, .vseg button')]
        .map((b) => (b.textContent || '').trim());
      const th = [...root.querySelectorAll('thead th, .tbl th')].map((t) => (t.textContent || '').trim());
      const stageBtns = root.querySelectorAll('.stg2, [data-a="stage"]').length;
      const pills = [...root.querySelectorAll('.pills .pl, [data-a="cb"], [data-a="email"], [data-a="space"], [data-a="del"]')]
        .map((b) => (b.textContent || '').trim())
        .slice(0, 12);
      const loading = /Loading contacts/i.test(root.textContent || '');
      const noYet = /No contacts yet/i.test(root.textContent || '');
      const rows = root.querySelectorAll('#lbody tr, tbody tr').length;
      return { headers, switches, th, stageBtns, pills, loading, noYet, rows };
    });
    console.log('2 LISTS', JSON.stringify(out.lists));

    await page.goto(LIVE_ORIGIN + '/people', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'peopleDesk');
    await sleep(4000);
    out.contacts = await page.evaluate(() => {
      const root = document.querySelector('#peopleDesk')?.shadowRoot || document;
      const headers = [...root.querySelectorAll('h1')].map((h) => (h.textContent || '').trim());
      const stageBtns = root.querySelectorAll('.stg2, [data-a="stage"]').length;
      const pills = [...root.querySelectorAll('.pills .pl')].map((b) => (b.textContent || '').trim()).slice(0, 8);
      const roleRail = !!(root.querySelector('#lroles') && getComputedStyle(root.querySelector('#lroles')).display !== 'none');
      const rows = root.querySelectorAll('#lbody tr').length;
      return { headers, stageBtns, pills, roleRail, rows };
    });
    console.log('2 CONTACTS', JSON.stringify(out.contacts));

    /* ---- 3 SPACES cards ---- */
    await page.goto(LIVE_ORIGIN + '/spaces', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'spacesDesk');
    await sleep(2000);
    out.spaces = await page.evaluate(() => {
      const root = document.querySelector('#spacesDesk')?.shadowRoot || document;
      const card = root.querySelector('.sp[data-action="spaces-card-open"]');
      const ring = root.querySelector('[data-action="spaces-card-ring"]');
      const chk = root.querySelector('.sp > .chk');
      const pill = root.querySelector('.nx[data-action="space-people"], .ft .nx[data-action]');
      if (ring) ring.click();
      const chkOn = !!(chk && chk.classList.contains('on'));
      const steps = chk ? [...chk.querySelectorAll('div')].map((d) => (d.textContent || '').trim()) : [];
      return {
        cards: root.querySelectorAll('.sp[data-action="spaces-card-open"]').length,
        hasRing: !!ring,
        chkOn,
        steps,
        pillAction: pill ? pill.getAttribute('data-action') : null,
        cardSample: card ? (card.querySelector('h4')?.textContent || '').trim() : null,
      };
    });
    console.log('3 SPACES', JSON.stringify(out.spaces));

    /* ---- 4 CALENDAR months ---- */
    await page.goto(LIVE_ORIGIN + '/calendar', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'calDesk');
    await sleep(1500);
    await page.evaluate(() => {
      const root = document.querySelector('#calDesk')?.shadowRoot || document;
      const monthBtn = root.querySelector('[data-v="month"], [data-view="month"]');
      if (monthBtn) monthBtn.click();
    });
    await sleep(800);
    out.calendar = await page.evaluate(() => {
      const root = document.querySelector('#calDesk')?.shadowRoot || document;
      const scroll = root.querySelector('.months-scroll, .q.months-scroll');
      const mos = root.querySelectorAll('.mo');
      const sticky = [...mos].slice(0, 2).map((m) => {
        const h = m.querySelector('h4');
        return h ? getComputedStyle(h).position : null;
      });
      return {
        months: mos.length,
        hasScroll: !!scroll,
        sticky,
        first: mos[0] ? (mos[0].querySelector('h4')?.textContent || '').trim() : null,
      };
    });
    console.log('4 CALENDAR', JSON.stringify(out.calendar));

    /* ---- 5 NEWS dials ---- */
    await page.goto(LIVE_ORIGIN + '/news', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'newsDesk');
    await sleep(2000);
    out.news = await page.evaluate(() => {
      const root = document.querySelector('#newsDesk')?.shadowRoot || document.querySelector('#v-news')?.shadowRoot || document;
      const gc = root.querySelector('.gc');
      if (!gc) return { gauges: 0 };
      const r = gc.getBoundingClientRect();
      const svg = gc.querySelector('svg');
      const sr = svg ? svg.getBoundingClientRect() : null;
      return {
        gauges: root.querySelectorAll('.gc').length,
        card: { w: Math.round(r.width), h: Math.round(r.height) },
        dial: sr ? { w: Math.round(sr.width), h: Math.round(sr.height) } : null,
      };
    });
    console.log('5 NEWS', JSON.stringify(out.news));

    /* ---- 6 LINKS dark ---- */
    await page.goto(LIVE_ORIGIN + '/links', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'linksDesk');
    await sleep(1500);
    out.links = await page.evaluate(() => {
      const root = document.querySelector('#linksDesk')?.shadowRoot || document;
      const tile = root.querySelector('.tile, .link-tile');
      if (!tile) return { tiles: 0 };
      const nb = tile.querySelector('.nb') || tile;
      const cs = getComputedStyle(nb);
      const title = tile.querySelector('.ltitle, .t, b, h3, .name');
      return {
        tiles: root.querySelectorAll('.tile, .link-tile').length,
        nbBg: cs.backgroundColor,
        nbColor: cs.color,
        titleColor: title ? getComputedStyle(title).color : null,
      };
    });
    console.log('6 LINKS', JSON.stringify(out.links));

    /* ---- 7 DOCUMENTS scroll ---- */
    await page.goto(LIVE_ORIGIN + '/documents', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'docsDesk');
    await sleep(1500);
    out.docs = await page.evaluate(() => {
      const root = document.querySelector('#docsDesk')?.shadowRoot || document;
      const board = root.querySelector('.board, .lay > .card.ctr, #board');
      if (!board) return { found: false };
      const cs = getComputedStyle(board);
      return {
        found: true,
        overflow: cs.overflow + '/' + cs.overflowY,
        scrollHeight: board.scrollHeight,
        clientHeight: board.clientHeight,
        canScroll: board.scrollHeight > board.clientHeight + 2,
      };
    });
    console.log('7 DOCUMENTS', JSON.stringify(out.docs));

    /* ---- 8 NOTES recovery ---- */
    out.notes = await page.evaluate(async () => {
      const api = await (window.authFetch || fetch)('/api/notes', { credentials: 'same-origin' }).then((r) => r.json()).catch(() => ({}));
      const probe = await (window.authFetch || fetch)('/api/ops/chad-account?notes=1', { credentials: 'same-origin' })
        .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
        .catch((e) => ({ status: 0, body: { error: String(e) } }));
      return {
        apiNotes: Array.isArray(api.notes) ? api.notes.length : null,
        probeStatus: probe.status,
        pitr: probe.body && probe.body.pitr,
        error: probe.body && (probe.body.error || probe.body.detail),
        note: (probe.body && probe.body.notes) || null,
      };
    });
    console.log('8 NOTES', JSON.stringify(out.notes));

    console.log('\nP14_PROOF_JSON', JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
