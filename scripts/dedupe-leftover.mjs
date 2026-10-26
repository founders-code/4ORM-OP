import { chromium } from 'playwright';
import { signInAsTestUser } from './auth-state.mjs';

await (async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await signInAsTestUser(page);
  const dry = await page.evaluate(async () => {
    const r = await (window.authFetch || fetch)('/api/ops/dedupe', { credentials: 'same-origin' });
    return { status: r.status, json: await r.json().catch(() => null) };
  });
  console.log('LEFTOVER_STATUS', dry.status);
  console.log('LEFTOVER_COUNTS', JSON.stringify(dry.json && dry.json.counts, null, 2));
  await browser.close();
})();
