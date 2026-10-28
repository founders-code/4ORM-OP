#!/usr/bin/env node
/* Measured proofs signed in as Chad on production after Prompt 13 Ready. */
import { chromium } from 'playwright';
import { LIVE_ORIGIN, signInAsChad, CHAD_EMAIL } from './auth-state.mjs';

const SHA = '39340dd';

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
    console.log('P13 PROOF signed-in', who.email, 'sha', SHA);

    /* ---- 1 NOTES ---- */
    await page.goto(LIVE_ORIGIN + '/notes', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'notesDesk');
    await sleep(2500);
    out.notes = await page.evaluate(async () => {
      const api = await (window.authFetch || fetch)('/api/notes', { credentials: 'same-origin' }).then((r) => r.json()).catch(() => ({}));
      const root = document.querySelector('#notesDesk')?.shadowRoot || document;
      const chips = [...root.querySelectorAll('.chip, [data-filt], [data-cat]')].map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 20);
      const cards = root.querySelectorAll('.note, .card.note, [data-note], .sticky, .ncard, .tile.note').length;
      const boardText = (root.querySelector('.board, #board, .wall, .notes') || root)?.textContent || '';
      const allChip = chips.find((t) => /^All\b/i.test(t)) || null;
      const titles = [...root.querySelectorAll('.note b, .ncard b, .sticky textarea, .title, h3, h4')]
        .map((el) => (el.value || el.textContent || '').trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 20);
      return {
        apiNotes: Array.isArray(api.notes) ? api.notes.length : (api.counts && api.counts.all) || null,
        apiPinned: Array.isArray(api.pinned) ? api.pinned.length : null,
        apiCounts: api.counts || null,
        clusters: Array.isArray(api.clusters) ? api.clusters.length : null,
        allChip,
        cardCount: cards,
        titles,
        boardHasUntitled: /Untitled/i.test(boardText),
        boardSample: boardText.replace(/\s+/g, ' ').trim().slice(0, 220),
      };
    });
    console.log('1 NOTES', JSON.stringify(out.notes));

    /* ---- 2 CALL LISTS ---- */
    await page.goto(LIVE_ORIGIN + '/people?tab=lists', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'peopleDesk');
    await sleep(5000);
    out.lists = await page.evaluate(async () => {
      const api = await (window.authFetch || fetch)('/api/reach-out?lists=1', { credentials: 'same-origin' })
        .then((r) => r.json())
        .catch(() => ({}));
      const lists = api.lists || api.callLists || [];
      const root = document.querySelector('#peopleDesk')?.shadowRoot || document;
      const rail = [...root.querySelectorAll('#listsRail .cr, .lists .cr, [data-list], .llist button, .rail .row')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 30);
      const rows = root.querySelectorAll('#ltbody tr, table tbody tr, .ltable tbody tr').length;
      const summary = (lists.length ? lists : []).map((l) => {
        const people = l.people || l.rows || [];
        const withPhone = people.filter((p) => p.phone || p.Phone).length;
        const withEmail = people.filter((p) => p.email || p.Email).length;
        return {
          name: l.name || l.key,
          count: l.count != null ? l.count : people.length,
          withPhone,
          withEmail,
        };
      });
      return { rail, visibleRows: rows, lists: summary, apiKeys: Object.keys(api || {}) };
    });
    console.log('2 LISTS', JSON.stringify(out.lists));

    /* ---- 3 EMAIL BODY + TONE (opstest space) ---- */
    const spaces = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/spaces', { credentials: 'same-origin' });
      return r.json().catch(() => ({}));
    });
    const packList = spaces.packages || spaces.spaces || spaces.items || [];
    let spaceId = null;
    let spaceName = null;
    for (const p of packList) {
      const blob = `${p.name || ''} ${p.emailSubject || ''} ${(p.recipients || []).map((x) => x.email).join(' ')}`.toLowerCase();
      if (blob.includes('opstest') || blob.includes('ops test')) {
        spaceId = p.id;
        spaceName = p.name;
        break;
      }
    }
    if (!spaceId && packList[0]) {
      spaceId = packList[0].id;
      spaceName = packList[0].name;
    }
    const bodyMarker = 'P13 tone body ' + Date.now() + ' keep Alice and $12,400.';
    out.email = { spaceId, spaceName, bodyMarker };
    if (spaceId) {
      await page.goto(LIVE_ORIGIN + '/spaces?id=' + encodeURIComponent(spaceId), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await ready(page, 'spacesDesk');
      await sleep(2800);
      /* Ensure Ready-for-email / detail open */
      await page.evaluate((id) => {
        const root = document.querySelector('#spacesDesk')?.shadowRoot || document;
        const open = root.querySelector('[data-action="space-open"][data-id="' + id + '"], .scard[data-id="' + id + '"]');
        if (open) open.click();
      }, spaceId);
      await sleep(1500);
      const typed = await page.evaluate(async ({ id, body, tone }) => {
        const patch = await (window.authFetch || fetch)('/api/spaces/' + encodeURIComponent(id), {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ emailBody: body, emailTone: tone }),
        }).then((r) => r.json().catch(() => ({})));
        return patch;
      }, { id: spaceId, body: bodyMarker, tone: 'voss' });
      out.email.patch = { ok: !!typed && (typed.ok || typed.id || typed.package || typed.emailBody), keys: Object.keys(typed || {}) };
      const rewrites = {};
      for (const tone of ['voss', 'ury', 'cialdini', 'plain']) {
        const r = await page.evaluate(async ({ body, tone }) => {
          const res = await (window.authFetch || fetch)('/api/mail/write', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'tone', tone, body, instruction: '' }),
          });
          const j = await res.json().catch(() => ({}));
          return { status: res.status, body: j.body || j.text || j.draft || null, err: j.error || j.message || null };
        }, { body: bodyMarker, tone });
        rewrites[tone] = r;
        if (r.body) {
          await page.evaluate(async ({ id, body, tone }) => {
            await (window.authFetch || fetch)('/api/spaces/' + encodeURIComponent(id), {
              method: 'PATCH',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ emailBody: body, emailTone: tone }),
            });
          }, { id: spaceId, body: r.body, tone });
        }
      }
      out.email.rewrites = rewrites;
      /* reload and read saved */
      await page.goto(LIVE_ORIGIN + '/spaces?id=' + encodeURIComponent(spaceId), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(2000);
      const saved = await page.evaluate(async (id) => {
        const r = await (window.authFetch || fetch)('/api/spaces/' + encodeURIComponent(id), { credentials: 'same-origin' });
        const j = await r.json().catch(() => ({}));
        const p = j.package || j;
        return {
          emailBody: p.emailBody || (p.email && p.email.body) || null,
          emailTone: p.emailTone || (p.email && p.email.tone) || null,
        };
      }, spaceId);
      out.email.saved = saved;
    }
    console.log('3 EMAIL', JSON.stringify(out.email));

    /* ---- 4 DOCUMENTS board ---- */
    await page.goto(LIVE_ORIGIN + '/documents', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'docsDesk');
    await sleep(3000);
    out.documents = await page.evaluate(async () => {
      const api = await (window.authFetch || fetch)('/api/documents', { credentials: 'same-origin' }).then((r) => r.json()).catch(() => ({}));
      const docs = api.docs || [];
      const layout = api.layout || [];
      const two = docs.slice(0, 2).map((d, i) => ({
        docId: d.id || d.docId,
        x: 24 + i * 192,
        y: 36 + i * 24,
        w: 168 + i * 36,
        h: 210 + i * 24,
      }));
      let saved = null;
      if (two.length) {
        saved = await (window.authFetch || fetch)('/api/documents', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'save-layout', items: two }),
        }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
      }
      const again = await (window.authFetch || fetch)('/api/documents', { credentials: 'same-origin' }).then((r) => r.json()).catch(() => ({}));
      const root = document.querySelector('#docsDesk')?.shadowRoot || document;
      const board = root.querySelector('#files, .board, .wall, .docs-board');
      return {
        docCount: docs.length,
        priorLayout: layout.slice(0, 4),
        saved,
        boxes: (again.layout || []).filter((b) => two.some((t) => String(t.docId) === String(b.docId))).slice(0, 4),
        boardClass: board ? board.className : null,
      };
    });
    console.log('4 DOCS', JSON.stringify(out.documents));

    /* ---- 5 LINKS white text ---- */
    await page.goto(LIVE_ORIGIN + '/links', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'linksDesk');
    await sleep(2500);
    out.links = await page.evaluate(() => {
      const root = document.querySelector('#linksDesk')?.shadowRoot || document;
      const tile = root.querySelector('.tile');
      const nb = tile && tile.querySelector('.nb');
      const b = tile && tile.querySelector('b');
      const dm = tile && tile.querySelector('.dm');
      const nt = tile && tile.querySelector('.nt');
      function cs(el) {
        if (!el) return null;
        const s = getComputedStyle(el);
        return { color: s.color, bg: s.backgroundColor };
      }
      return { nb: cs(nb), title: cs(b), domain: cs(dm), note: cs(nt), tiles: root.querySelectorAll('.tile').length };
    });
    console.log('5 LINKS', JSON.stringify(out.links));

    /* ---- 6 PLAYBOOK today band ---- */
    out.playbook = {};
    for (const width of [1280, 1440, 1728]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(LIVE_ORIGIN + '/playbook', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await ready(page, 'playDesk');
      await sleep(2200);
      const views = {};
      for (const view of ['full', 'focus', 'compact']) {
        await page.evaluate((v) => {
          const body = document.querySelector('#playDesk')?.shadowRoot?.querySelector('.port-body')
            || document.querySelector('#playDesk')?.shadowRoot
            || document.body;
          body.classList.toggle('focusday', v === 'focus');
          body.classList.toggle('compact', v === 'compact');
          if (v === 'full') {
            body.classList.remove('focusday');
            body.classList.remove('compact');
          }
        }, view);
        await sleep(400);
        views[view] = await page.evaluate(() => {
          const root = document.querySelector('#playDesk')?.shadowRoot || document;
          const ph = root.querySelector('#ph, .ph');
          const days = [...root.querySelectorAll('.dh, .dayh, .g > .d, .head .d')];
          let wed = null;
          for (const el of days) {
            const t = (el.textContent || '').toUpperCase();
            if (/\bWED\b/.test(t) || /\b28\b/.test(t) && /W/.test(t)) {
              wed = el;
              break;
            }
          }
          /* Prefer today's header (.today) */
          const todayH = root.querySelector('.dh.today, .d.today, [data-today="1"]') || wed;
          function box(el) {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { left: Math.round(r.left), width: Math.round(r.width), top: Math.round(r.top) };
          }
          return { band: box(ph), todayHeader: box(todayH), todayText: todayH ? (todayH.textContent || '').trim().slice(0, 40) : null };
        });
      }
      out.playbook[String(width)] = views;
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log('6 PLAYBOOK', JSON.stringify(out.playbook));

    /* ---- 7 PLANNER switch ---- */
    await page.goto(LIVE_ORIGIN + '/planner', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'planDesk');
    await sleep(2200);
    out.planner = await page.evaluate(() => {
      const root = document.querySelector('#planDesk')?.shadowRoot || document;
      const buttons = [...root.querySelectorAll('.vseg button')].map((b) => ({
        text: (b.textContent || '').trim(),
        pressed: b.getAttribute('aria-pressed') === 'true',
      }));
      return { buttons, landing: buttons.find((b) => b.pressed)?.text || null };
    });
    console.log('7 PLANNER', JSON.stringify(out.planner));

    /* ---- 8 CALENDAR glow ---- */
    await page.goto(LIVE_ORIGIN + '/calendar', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'calDesk');
    await sleep(2500);
    out.calendar = await page.evaluate(() => {
      const root = document.querySelector('#calDesk')?.shadowRoot || document;
      const col = root.querySelector('.col.today');
      if (!col) return { error: 'no .col.today' };
      const cs = getComputedStyle(col);
      return {
        boxShadow: cs.boxShadow,
        borderColor: cs.borderColor,
        backgroundColor: cs.backgroundColor,
      };
    });
    console.log('8 CALENDAR', JSON.stringify(out.calendar));

    /* ---- 9 NEWS dials rebuild ---- */
    out.news = await page.evaluate(async () => {
      const rebuilt = await (window.authFetch || fetch)('/api/news/pulse?rebuild=1', { credentials: 'same-origin' })
        .then((r) => r.json())
        .catch((e) => ({ error: String(e) }));
      const gauges = rebuilt.gauges || [];
      return {
        rebuilt: !!rebuilt.rebuilt,
        view: rebuilt.view,
        gauges: gauges.map((g) => ({
          k: g.k,
          v: g.v,
          d: g.d,
          w: g.w,
          building: g.building,
          buildingN: g.buildingN,
          lead: (g.story && g.story.h) || (Array.isArray(g.why) ? g.why.join(' ') : g.why) || null,
        })),
      };
    });
    await page.goto(LIVE_ORIGIN + '/news', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(page, 'newsDesk');
    await sleep(2500);
    out.news.ui = await page.evaluate(() => {
      const root = document.querySelector('#newsDesk')?.shadowRoot || document;
      const gcs = [...root.querySelectorAll('.gc')].map((el) => {
        const num = el.querySelector('.num b')?.textContent?.trim();
        const delta = el.querySelector('.gd')?.textContent?.trim();
        const lead = el.querySelector('.lead')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120);
        const paths = el.querySelectorAll('svg path').length;
        const lines = el.querySelectorAll('svg line').length;
        return { title: el.querySelector('.gt')?.childNodes[0]?.textContent?.trim() || el.querySelector('.gt')?.textContent?.trim(), num, delta, lead, paths, lines };
      });
      return { dials: gcs };
    });
    console.log('9 NEWS', JSON.stringify(out.news));

    console.log('\n=== P13 MEASURED JSON ===');
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
