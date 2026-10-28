#!/usr/bin/env node
/* Measured proofs signed in as Chad on production. */
import { chromium } from 'playwright';
import { LIVE_ORIGIN, signInAsChad } from './auth-state.mjs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const out = {};
  try {
    await signInAsChad(page, LIVE_ORIGIN);
    out.who = await page.evaluate(() => document.body?.innerText?.slice(0, 80) || location.href);

    await page.goto(LIVE_ORIGIN + '/ops', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    out.dial = await page.evaluate(() => {
      const root = document.querySelector('#opsDesk')?.shadowRoot || document;
      const dial = root.querySelector('.dial svg');
      if (!dial) return { error: 'no .dial svg' };
      const val = dial.closest('.dial')?.querySelector('.val');
      const cs = val ? getComputedStyle(val) : null;
      return {
        paths: dial.querySelectorAll('path').length,
        lines: dial.querySelectorAll('line').length,
        valColor: cs ? cs.color : null,
        lab: dial.closest('.dial')?.querySelector('.lab')?.textContent || null,
      };
    });

    await page.goto(LIVE_ORIGIN + '/pipeline', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    out.pipeline = await page.evaluate(() => {
      const root = document.querySelector('#pipeDesk')?.shadowRoot || document.querySelector('#contactsDesk')?.shadowRoot || document;
      const bcols = root.querySelector('#bcols') || root.querySelector('.bcols');
      const board = root.querySelector('.pipe-board');
      if (!bcols) return { error: 'no .bcols', display: board ? getComputedStyle(board).display : null };
      return {
        boardDisplay: board ? getComputedStyle(board).display : null,
        bcolsClientWidth: bcols.clientWidth,
        bcolsScrollWidth: bcols.scrollWidth,
        chWidth: board?.querySelector('.ch')?.getBoundingClientRect()?.width || null,
      };
    });

    await page.goto(LIVE_ORIGIN + '/planner', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    out.planner = await page.evaluate(() => {
      const root = document.querySelector('#planDesk')?.shadowRoot || document;
      const on = root.querySelector('.seg span.on, [aria-pressed="true"]');
      return {
        view: on?.textContent?.trim() || null,
        muted: getComputedStyle(root.querySelector('.port-body') || document.body).getPropertyValue('--muted').trim(),
        faint: getComputedStyle(root.querySelector('.port-body') || document.body).getPropertyValue('--faint').trim(),
      };
    });

    await page.goto(LIVE_ORIGIN + '/calendar', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    out.calendar = await page.evaluate(() => {
      const root = document.querySelector('#calDesk')?.shadowRoot || document;
      const tts = [...root.querySelectorAll('.tt')].slice(0, 12).map((el) => {
        const cs = getComputedStyle(el);
        const bg = (() => {
          let n = el;
          while (n) {
            const b = getComputedStyle(n).backgroundColor;
            if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b;
            n = n.parentElement;
          }
          return 'none';
        })();
        return { text: el.textContent?.trim()?.slice(0, 40), color: cs.color, bg, equal: cs.color === bg };
      });
      return { ttSample: tts, equalCount: tts.filter((t) => t.equal).length };
    });

    const notes = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/notes', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      return { n: Array.isArray(j.notes) ? j.notes.length : -1, titles: (j.notes || []).map((x) => x.title) };
    });
    out.notes = notes;

    const dials = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/ops/dials', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      return j;
    });
    out.dialsApi = dials;

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
