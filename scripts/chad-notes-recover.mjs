#!/usr/bin/env node
/* Sign in as Chad on production and recover soft-deleted notes. */
import { chromium } from 'playwright';
import { LIVE_ORIGIN, signInAsChad } from './auth-state.mjs';

const APPLY = process.argv.includes('--apply');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signInAsChad(page, LIVE_ORIGIN);
    const notes = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/notes', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, n: Array.isArray(j.notes) ? j.notes.length : -1, titles: (j.notes || []).map((x) => x.title) };
    });
    console.log('GET /api/notes', notes);
    const probe = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/ops/chad-account', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, notes: j.notes, pitr: j.pitr };
    });
    console.log('chad-account notes', JSON.stringify(probe, null, 2));
    if (!APPLY) {
      console.log('dry run; pass --apply to POST recoverNotes');
      return;
    }
    const recovered = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/ops/chad-account', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recoverNotes: true }),
      });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, body: j };
    });
    console.log('recoverNotes', JSON.stringify(recovered, null, 2));
    const after = await page.evaluate(async () => {
      const r = await (window.authFetch || fetch)('/api/notes', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      return { n: Array.isArray(j.notes) ? j.notes.length : -1, titles: (j.notes || []).map((x) => x.title) };
    });
    console.log('GET /api/notes after', after);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
