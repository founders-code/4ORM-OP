#!/usr/bin/env node
/* Measured proofs signed in as Chad on production after Prompt 10 Ready. */
import { chromium } from 'playwright';
import { LIVE_ORIGIN, signInAsChad } from './auth-state.mjs';

function desk(page, id) {
  return page.evaluate((deskId) => {
    const host = document.getElementById(deskId);
    return host?.shadowRoot || document;
  }, id);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const out = { sha: '8f1ed14', origin: LIVE_ORIGIN };
  try {
    await signInAsChad(page, LIVE_ORIGIN);
    out.who = await page.evaluate(() => {
      const t = document.body?.innerText || '';
      const m = t.match(/[\w.+-]+@[\w.-]+\.\w+/);
      return { email: m ? m[0] : null, href: location.href };
    });

    await page.goto(LIVE_ORIGIN + '/ops', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2800);
    out.dial = await page.evaluate(() => {
      const root = document.querySelector('#opsDesk')?.shadowRoot || document;
      const dial = root.querySelector('.dial svg');
      if (!dial) return { error: 'no .dial svg' };
      const val = dial.closest('.dial')?.querySelector('.val');
      const cs = val ? getComputedStyle(val) : null;
      const covers = root.querySelectorAll('.sw .cover, .engage .cover').length;
      return {
        paths: dial.querySelectorAll('path').length,
        lines: dial.querySelectorAll('line').length,
        valColor: cs ? cs.color : null,
        lab: dial.closest('.dial')?.querySelector('.lab')?.textContent || null,
        engageCovers: covers,
      };
    });
    out.dialsApi = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/ops/dials', { credentials: 'same-origin' });
      return r.json().catch(() => ({}));
    });

    await page.goto(LIVE_ORIGIN + '/pipeline', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    out.pipeline = await page.evaluate(() => {
      const root = document.querySelector('#pipeDesk')?.shadowRoot || document.querySelector('#contactsDesk')?.shadowRoot || document;
      const bcols = root.querySelector('#bcols') || root.querySelector('.bcols');
      const board = root.querySelector('.pipe-board');
      return {
        boardDisplay: board ? getComputedStyle(board).display : null,
        bcolsClientWidth: bcols?.clientWidth ?? null,
        bcolsScrollWidth: bcols?.scrollWidth ?? null,
      };
    });

    await page.goto(LIVE_ORIGIN + '/planner', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2200);
    out.planner = await page.evaluate(() => {
      const root = document.querySelector('#planDesk')?.shadowRoot || document;
      const on = root.querySelector('.vseg button[aria-pressed="true"], .seg span.on');
      const sname = root.querySelector('.sname');
      const drawer = root.querySelector('#drawer');
      const body = root.querySelector('.port-body') || root.querySelector('.page') || document.body;
      return {
        view: on?.textContent?.trim() || null,
        snameBg: sname ? getComputedStyle(sname).backgroundColor : null,
        snameColor: sname ? getComputedStyle(sname).color : null,
        muted: getComputedStyle(body).getPropertyValue('--muted').trim(),
        faint: getComputedStyle(body).getPropertyValue('--faint').trim(),
        drawerBg: drawer && !drawer.hidden ? getComputedStyle(drawer).backgroundColor : 'closed',
      };
    });

    await page.goto(LIVE_ORIGIN + '/calendar', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    out.calendar = await page.evaluate(() => {
      const root = document.querySelector('#calDesk')?.shadowRoot || document;
      const title = root.querySelector('.c-top h2, .wklab, .mtitle b, .c-main h2')?.textContent?.trim() || null;
      const weekChip = root.querySelector('.wklab, .range, [data-week]')?.textContent?.trim()?.slice(0, 40) || null;
      const todayCol = !!root.querySelector('.col.today, .dd.today, .mini .d.today');
      const tts = [...root.querySelectorAll('.tt')].slice(0, 14).map((el) => {
        const cs = getComputedStyle(el);
        let n = el;
        let bg = 'none';
        while (n) {
          const b = getComputedStyle(n).backgroundColor;
          if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') { bg = b; break; }
          n = n.parentElement;
        }
        return { text: el.textContent?.trim()?.slice(0, 36), color: cs.color, bg, equal: cs.color === bg };
      });
      return { title, weekChip, todayCol, equalCount: tts.filter((t) => t.equal).length, ttSample: tts.slice(0, 6) };
    });

    await page.goto(LIVE_ORIGIN + '/documents', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2200);
    out.documents = await page.evaluate(() => {
      const root = document.querySelector('#docsDesk')?.shadowRoot || document;
      const fd = root.querySelector('.fd');
      const fl = root.querySelector('.fl .nm');
      const files = root.querySelector('#files');
      const range = root.querySelector('[data-action="docs-size"]');
      const dw = files ? getComputedStyle(files).getPropertyValue('--dw').trim() : null;
      const cards = files ? files.querySelectorAll('.fl').length : 0;
      const width = files?.clientWidth || 0;
      const cardW = Number(String(dw || '168').replace('px', '')) || 168;
      const across = width && cardW ? Math.floor((width + 11) / (cardW + 11)) : 0;
      return {
        folderColor: fd ? getComputedStyle(fd).color : null,
        nameColor: fl ? getComputedStyle(fl).color : null,
        dw,
        across,
        cards,
        rangeMax: range?.max || null,
        rangeValue: range?.value || null,
      };
    });

    out.notes = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/notes', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      return { n: Array.isArray(j.notes) ? j.notes.length : -1, titles: (j.notes || []).map((x) => x.title) };
    });

    out.pulse = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/news/pulse?view=market&rebuild=1', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      const gauges = (j.gauges || []).map((g) => ({
        k: g.k, v: g.v, d: g.d, building: g.building, buildingN: g.buildingN, w: g.w,
        lead: g.story?.h || g.why || null,
      }));
      return { rebuilt: j.rebuilt, gauges };
    });

    await page.goto(LIVE_ORIGIN + '/recordings', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    out.recordings = await page.evaluate(() => {
      const root = document.querySelector('#recDesk')?.shadowRoot || document.querySelector('#recordingsDesk')?.shadowRoot || document;
      const procs = [...root.querySelectorAll('.rc.proc h4, .rc h4')].slice(0, 6).map((el) => el.textContent?.trim());
      return { heads: procs };
    });

    await page.goto(LIVE_ORIGIN + '/playbook', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1800);
    out.clock = await page.evaluate(() => {
      const clock = document.querySelector('header.top .clock, .top .clock, .clock');
      return clock ? getComputedStyle(clock).color : null;
    });
    out.playbookPink = await page.evaluate(() => {
      const root = document.querySelector('#playDesk')?.shadowRoot || document;
      const today = root.querySelector('.today, .todaytag, .ph.today, [class*="today"]');
      if (!today) return null;
      return { bg: getComputedStyle(today).backgroundColor, color: getComputedStyle(today).color, text: today.textContent?.trim()?.slice(0, 20) };
    });

    await page.goto(LIVE_ORIGIN + '/contacts', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    out.toggles = await page.evaluate(() => {
      const root = document.querySelector('#contactsDesk')?.shadowRoot || document.querySelector('#peopleDesk')?.shadowRoot || document;
      const seg = root.querySelector('.seg span:not(.on), .vseg button[aria-pressed="false"]');
      return seg ? { color: getComputedStyle(seg).color, text: seg.textContent?.trim() } : null;
    });

    await page.goto(LIVE_ORIGIN + '/links', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1800);
    out.links = await page.evaluate(() => {
      const root = document.querySelector('#linksDesk')?.shadowRoot || document;
      const cards = [...root.querySelectorAll('.card, .lk, .row')].slice(0, 20);
      let overlay = 0;
      cards.forEach((card) => {
        const img = card.querySelector('img');
        if (!img) return;
        const ib = img.getBoundingClientRect();
        [...card.querySelectorAll('b, .nm, .dom, a, span')].forEach((t) => {
          const tb = t.getBoundingClientRect();
          if (tb.width < 4 || tb.height < 4) return;
          const overlap = !(tb.right < ib.left || tb.left > ib.right || tb.bottom < ib.top || tb.top > ib.bottom);
          const textOverImg = overlap && tb.top >= ib.top && tb.bottom <= ib.bottom + 2;
          if (textOverImg) overlay += 1;
        });
      });
      const seg = root.querySelector('.seg span:not(.on)');
      return { overlayTextInImage: overlay, segColor: seg ? getComputedStyle(seg).color : null };
    });

    await page.goto(LIVE_ORIGIN + '/financials', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    out.financials = await page.evaluate(() => {
      const root = document.querySelector('#finDesk')?.shadowRoot || document;
      const lock = root.querySelector('input[type="password"], input[placeholder*="code"], .lock, #finLock');
      const body = root.textContent || '';
      const hasCashLabel = /Cash|cheques|Fills in from the master/i.test(body);
      const figures = [...root.querySelectorAll('b, .n, .amt, .val')].map((el) => el.textContent?.trim()).filter((t) => /\$[\d,]|\d+\.\d{2}/.test(t || ''));
      return { lockedUi: !!lock, hasCashLabel, figureSamples: figures.slice(0, 5) };
    });

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
