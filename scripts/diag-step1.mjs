import { chromium } from 'playwright';
import { signInAsTestUser } from './auth-state.mjs';

const ORIGIN = 'https://www.4ormop.com';

function slim(body, max = 800) {
  if (body == null) return '';
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return text.length > max ? text.slice(0, max) + '…' : text;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const traces = [];
  page.on('response', async (res) => {
    if (!/\/api\/(items|notes|links|board)(\/|$|\?)/.test(res.url())) return;
    const req = res.request();
    let reqBody = '';
    try { reqBody = req.postData() || ''; } catch { reqBody = ''; }
    let resBody = '';
    try { resBody = await res.text(); } catch { resBody = '(unreadable)'; }
    traces.push({
      method: req.method(),
      url: res.url().replace(ORIGIN, ''),
      status: res.status(),
      req: slim(reqBody),
      res: slim(resBody),
    });
  });
  try {
    await signInAsTestUser(page);
    const stamp = Date.now();
    const captureTitle = 'TEST diag-capture ' + stamp;

    await page.goto(ORIGIN + '/war-room', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#warDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
    await page.waitForTimeout(1500);

    const captureClick = await page.evaluate((title) => {
      const root = document.getElementById('warDesk').shadowRoot;
      const input = root.querySelector('[data-action="capture-input"]');
      const add = root.querySelector('[data-action="capture-add"]');
      if (input) {
        input.focus();
        input.value = title;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (add) add.click();
      return { inputValue: input ? input.value : null, clicked: !!add };
    }, captureTitle);
    await page.waitForTimeout(2000);
    const afterCapture = await page.evaluate(async (title) => {
      const items = (window.STATE && window.STATE.items) || [];
      let board = null;
      try {
        const r = await (window.authFetch || fetch)('/api/board', { credentials: 'same-origin' });
        board = { status: r.status, json: await r.json().catch(() => null) };
      } catch (e) { board = { error: String(e) }; }
      const boardItems = ((board.json && board.json.items) || []).map((it) => ({ id: it.id, title: it.title, status: it.status, due: it.due, owner: it.owner }));
      return {
        stateCount: items.length,
        stateHit: items.some((it) => String(it.title || '') === title),
        boardStatus: board && board.status,
        boardReads: board && board.json && board.json.reads,
        boardHit: boardItems.some((it) => it.title === title),
        boardTest: boardItems.filter((it) => /TEST /.test(String(it.title || ''))),
        clerkUser: !!(window.Clerk && window.Clerk.user && window.Clerk.user.id),
      };
    }, captureTitle);

    await page.goto(ORIGIN + '/notes', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#notesDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
    await page.waitForTimeout(800);
    const noteTitle = 'TEST diag-note ' + stamp;
    const noteCreate = await page.evaluate(async (title) => {
      const fn = window.authFetch || fetch;
      const r = await fn('/api/notes', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title, body: 'draft', color: 'yellow' }),
      });
      const json = await r.json().catch(() => null);
      return { status: r.status, json: json };
    }, noteTitle);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#notesDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
    await page.waitForTimeout(800);
    const noteUi = await page.evaluate(async ({ id, body }) => {
      const root = document.getElementById('notesDesk').shadowRoot;
      const card = root.querySelector('[data-action="note-open"][data-id="' + id + '"]') || root.querySelector('[data-action="note-open"]');
      const cardSource = card && card.getAttribute('data-source');
      const cardId = card && card.getAttribute('data-id');
      if (card) card.click();
      const ob = root.getElementById('ob');
      const obSource = ob && ob.getAttribute('data-source');
      if (ob) {
        ob.innerText = body;
        ob.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: body }));
      }
      await new Promise(function (r) { setTimeout(r, 800); });
      return {
        cardFound: !!card, cardId: cardId, cardSource: cardSource,
        obSource: obSource, opened: !!ob,
        stateNotes: ((window.STATE && window.STATE.notes) || []).map((n) => ({ id: n.id, title: n.title, body: String(n.body || '').slice(0, 40) })),
      };
    }, { id: noteCreate.json && noteCreate.json.id, body: 'TEST autosave ' + stamp });
    await page.waitForTimeout(800);
    const noteRead = await page.evaluate(async (id) => {
      const fn = window.authFetch || fetch;
      const r = await fn('/api/notes', { credentials: 'same-origin' });
      const json = await r.json().catch(() => null);
      const hit = ((json && json.notes) || []).filter((n) => String(n.id) === String(id))[0];
      return { status: r.status, hit: hit || null, count: ((json && json.notes) || []).length };
    }, noteCreate.json && noteCreate.json.id);

    await page.goto(ORIGIN + '/links', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#linksDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
    await page.waitForTimeout(800);
    const linkTitle = 'TEST diag-link ' + stamp;
    const linkCreate = await page.evaluate(async (title) => {
      const fn = window.authFetch || fetch;
      const r = await fn('/api/links', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title, url: 'https://4ormop.com/test-click-check' }),
      });
      const json = await r.json().catch(() => null);
      return { status: r.status, json: json };
    }, linkTitle);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#linksDesk[data-port-ready]', { timeout: 20000, state: 'attached' });
    await page.waitForTimeout(800);
    const linkUi = await page.evaluate((id) => {
      const root = document.getElementById('linksDesk').shadowRoot;
      const el = root.querySelector('[data-action="link-note"][data-id="' + id + '"]');
      const any = root.querySelector('[data-action="link-note"]');
      const links = ((window.STATE && window.STATE.links) || []).map((l) => ({ id: l.id, title: l.title, cat: l.cat || l.category, note: l.note }));
      const cats = ((window.STATE && window.STATE.categories) || []).map((c) => c.name || c.title);
      return {
        exact: !!el, any: !!any, stateHit: links.some((l) => String(l.id) === String(id)),
        links: links.slice(0, 8), cats: cats, cat: window.STATE && (window.STATE.cat || window.STATE.linkCat),
      };
    }, linkCreate.json && linkCreate.json.id);

    const drop = await page.evaluate(async () => {
      const fn = window.authFetch || fetch;
      const dropped = [];
      for (const it of ((window.STATE && window.STATE.items) || [])) {
        if (!/^TEST /.test(String(it.title || ''))) continue;
        await fn('/api/items', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: it.id, status: 'dropped' }) });
        dropped.push('item:' + it.id);
      }
      for (const n of ((window.STATE && window.STATE.notes) || [])) {
        if (!/^TEST /.test(String(n.title || '')) && !/^TEST /.test(String(n.body || ''))) continue;
        await fn('/api/notes', { method: 'DELETE', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: n.id, kind: 'note' }) });
        dropped.push('note:' + n.id);
      }
      for (const l of ((window.STATE && window.STATE.links) || [])) {
        if (!/^TEST /.test(String(l.title || '')) && !/^TEST /.test(String(l.note || ''))) continue;
        await fn('/api/links/' + encodeURIComponent(l.id), { method: 'DELETE', credentials: 'same-origin' });
        dropped.push('link:' + l.id);
      }
      return dropped;
    });

    console.log(JSON.stringify({
      captureClick, afterCapture, noteCreate, noteUi, noteRead, linkCreate, linkUi, drop,
      traces: traces.filter((t) => t.method !== 'GET' || /\/api\/(notes|board)$/.test(t.url)),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
