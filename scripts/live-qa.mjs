import { chromium } from 'playwright';
import { signInAsTestUser } from './auth-state.mjs';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://www.4ormop.com').replace(/\/$/, '');

const PAGES = [
  { page: '02-war-room', path: '/war-room', ready: '#warDesk[data-port-ready]' },
  { page: '03-notes', path: '/notes', ready: '#notesDesk[data-port-ready]' },
  { page: '04-pipeline', path: '/pipeline', ready: '#pipeDesk[data-port-ready]' },
  { page: '05-spaces', path: '/spaces', ready: '#spacesDesk[data-port-ready]' },
  { page: '06-documents', path: '/documents', ready: '#docsDesk[data-port-ready]' },
  { page: '07-links', path: '/links', ready: '#linksDesk[data-port-ready]' },
  { page: '08-email', path: '/email', ready: '#mailDesk[data-port-ready]' },
  { page: '09-playbook', path: '/playbook', ready: '#playDesk[data-port-ready]' },
  { page: '10-calendar', path: '/calendar', ready: '#calDesk[data-port-ready]' },
  { page: '11-zoom', path: '/zoom', ready: '#zoomDesk[data-port-ready]' },
  { page: '12-completed', path: '/completed', ready: '#doneDesk[data-port-ready]' },
];

function isPageError(text) {
  const t = String(text || '');
  if (/Failed to load resource/i.test(t) && /404|401|403/.test(t)) return false;
  if (/net::ERR_/.test(t) && /favicon|fonts\.gstatic/.test(t)) return false;
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const rows = [];
  try {
    const gate = await context.newPage();
    await signInAsTestUser(gate, BASE);
    await gate.close();
    for (const spec of PAGES) {
      const page = await context.newPage();
      const errors = [];
      const maps = [];
      page.on('pageerror', (err) => { if (isPageError(err.message)) errors.push(err.message.split('\n')[0]); });
      page.on('console', (msg) => {
        if (msg.type() === 'error' && isPageError(msg.text())) errors.push(msg.text().slice(0, 180));
        if (msg.type() === 'info' && /\[live-map\]/.test(msg.text())) maps.push(msg.text().slice(0, 220));
      });
      await page.goto(BASE + spec.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (spec.ready) await page.waitForSelector(spec.ready, { timeout: 15000, state: 'attached' }).catch(() => {});
      await page.waitForTimeout(1200);
      const info = await page.evaluate(() => {
        const S = window.STATE || {};
        const host = document.querySelector('[data-port-ready]');
        const pads = host && host.shadowRoot ? host.shadowRoot.querySelectorAll('.pad:not(.off)').length : document.querySelectorAll('.pad:not(.off)').length;
        const days = host && host.shadowRoot ? host.shadowRoot.querySelectorAll('.day .dt b').length : 0;
        const owe = host && host.shadowRoot ? host.shadowRoot.querySelectorAll('.tag.owe').length : 0;
        return {
          mail: (S.mail || []).length,
          items: (S.items || []).length,
          notes: (S.notes || []).length,
          docs: (S.staged || S.docs || []).length,
          links: (S.links || []).length,
          zoom: (S.zoomNotes || []).length,
          actions: (S.meetingActions || []).length,
          snaps: (S.snaps || []).length,
          playbookRows: ((S.playbook && S.playbook.rows) || []).length,
          events: (S.events || []).length,
          pads: pads,
          days: days,
          owe: owe,
          signed: !!(S.me || S.user || document.querySelector('.clock'))
        };
      });
      const errN = errors.length;
      const pass = errN === 0 && info.signed;
      rows.push({ page: spec.page, pass, info, errors, maps });
      console.log(`${spec.page}\t${pass ? 'PASS' : 'FAIL'}\t${JSON.stringify(info)}\terrors=${errN}${errN ? ' ' + errors.join(' | ') : ''}`);
      maps.forEach((m) => console.log('  ' + m));
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log('\npage\tlive\tconsole errors\tpass');
  rows.forEach((r) => {
    console.log(`${r.page}\t${JSON.stringify(r.info)}\t${r.errors.length ? r.errors.join(' | ') : '0'}\t${r.pass ? 'PASS' : 'FAIL'}`);
  });
  if (rows.some((r) => !r.pass)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
