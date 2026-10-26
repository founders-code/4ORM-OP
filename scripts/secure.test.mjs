import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'fs';
import { tokenOk, allowArea, allowPriority, allowStage, allowStatus, allowContactType, allowTier, allowNoteColor, isBriefHour, windowKey, CEILINGS, parseDue, visibleCalendarWindow, inferContactCategory } from '../lib/guard.mjs';
import { ROADMAP, ROAD_CATEGORIES } from '../lib/roadmap.mjs';
import { STARTERS, assembleMail, fillToken, orderSpaceFolders } from '../lib/packages-core.mjs';
import { DEFAULT_WEIGHTS, computeLamps, pickMoves, readProfileFacts } from '../lib/ceo-score.mjs';
import { extractCommitments, fallbackPlan, zoneOf, NEWS_CATEGORIES } from '../lib/war-core.mjs';
import { organizeText } from '../lib/organize.mjs';
import { openSeal, seal } from '../lib/seal.mjs';
import { readState, signState } from '../lib/oauth-state.mjs';
import { calendarTokenOk, ghlOk, hookTokenOk, zoomCrc, zoomOk, zoomSignature } from '../lib/hook-auth.mjs';

test('token gate rejects a missing or wrong secret', () => {
  assert.equal(tokenOk(null, 'correct'), false);
  assert.equal(tokenOk('', 'correct'), false);
  assert.equal(tokenOk('wrong', 'correct'), false);
  assert.equal(tokenOk('correct', undefined), false);
  assert.equal(tokenOk('correct', 'correct'), true);
});

test('area names come from the allowlist', () => {
  assert.equal(allowArea('legal'), 'legal');
  assert.equal(allowArea('legal; drop table'), null);
});

test('pipeline and note values come from the allowlist', () => {
  assert.equal(allowStage('meeting'), 'meeting');
  assert.equal(allowStage('Closed Won'), null);
  assert.equal(allowContactType('grant_reg'), 'grant_reg');
  assert.equal(allowContactType('investor'), null);
  assert.equal(allowTier('A'), 'A');
  assert.equal(allowTier('D'), null);
  assert.equal(allowNoteColor('yellow'), 'yellow');
  assert.equal(allowNoteColor('red;'), null);
});

test('brief hour is 06:00 America/Edmonton on a weekday', () => {
  const winter = new Date('2026-01-15T13:00:00Z');
  const summer = new Date('2026-07-15T12:00:00Z');
  const afternoon = new Date('2026-07-15T18:00:00Z');
  assert.equal(isBriefHour(winter), true);
  assert.equal(isBriefHour(summer), true);
  assert.equal(isBriefHour(afternoon), false);
  assert.equal(windowKey(summer), '2026-07-15');
});

test('every vendor ceiling is a positive number', () => {
  for (const n of Object.values(CEILINGS)) assert.equal(n > 0, true);
});

test('a sealed value opens only with the same key', () => {
  const packed = seal('refresh-token', 'server-key');
  assert.equal(openSeal(packed, 'server-key'), 'refresh-token');
  assert.equal(openSeal(packed, 'other-key'), null);
  assert.equal(openSeal(packed.slice(0, -2) + 'aa', 'server-key'), null);
});

test('oauth state is bound to the signed-in user', () => {
  const state = signState('user_1', 'state-secret', 1_000);
  assert.equal(readState(state, 'state-secret', 1_000), 'user_1');
  assert.equal(readState(state, 'other-secret', 1_000), null);
  assert.equal(readState(state.replace('user_1', 'user_2'), 'state-secret', 1_000), null);
  assert.equal(readState(state, 'state-secret', 1_000 + 11 * 60 * 1000), null);
});

test('roadmap seed is seventeen dated items with allowed fields', () => {
  assert.equal(ROADMAP.length, 17);
  assert.equal(allowStatus('open'), 'open');
  for (const row of ROADMAP) {
    assert.equal(allowArea(row.area), row.area);
    assert.equal(allowPriority(row.priority), row.priority);
    assert.equal(ROAD_CATEGORIES.includes(row.category), true);
    assert.match(row.due, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(/[\u2013\u2014]/.test(row.title + row.owner), false);
    assert.equal(/\bAI\b/.test(row.title), false);
    assert.equal(row.title.trim().length > 0, true);
  }
});

test('zoom notes seed captures what other people said', () => {
  const notes = JSON.parse(readFileSync(new URL('../zoom_notes_seed.json', import.meta.url), 'utf8'));
  assert.equal(notes.length, 43);
  for (const note of notes) {
    assert.match(note.noteId, /^[A-Za-z0-9_-]+$/);
    assert.match(note.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(note.title.trim().length > 0, true);
    assert.equal(typeof note.solo, 'boolean');
    assert.equal(Array.isArray(note.attendees), true);
    assert.equal(Array.isArray(note.others), true);
    assert.equal(Array.isArray(note.intel), true);
    assert.equal(Array.isArray(note.improve), true);
    assert.equal(Array.isArray(note.sources), true);
    assert.equal(note.improve.length > 0, true);
    if (note.solo) assert.equal(note.others.length, 0);
    assert.equal(/AI company/i.test(note.title), false);
    assert.equal(/[\u2013\u2014]/.test(JSON.stringify(note)), false);
  }
});

test('a dump organizes into a title and sentence lines', () => {
  const row = organizeText('Call Bruce tomorrow. Send the deck after.');
  assert.equal(row.title, 'Call Bruce tomorrow.');
  assert.equal(row.body, '- Send the deck after.');
  assert.equal(organizeText('   '), null);
});

test('due values accept an ISO string, an epoch, or null', () => {
  assert.equal(parseDue(null).iso, null);
  assert.equal(parseDue('').iso, null);
  assert.equal(parseDue('2026-10-11T18:00:00.000Z').iso, '2026-10-11T18:00:00.000Z');
  assert.equal(parseDue(1_760_200_800_000).iso, new Date(1_760_200_800_000).toISOString());
  assert.equal(parseDue('not-a-date').ok, false);
});

test('the calendar window starts on Sunday and covers six weeks', () => {
  const sunday = new Date('2026-10-11T18:00:00Z');
  const wednesday = new Date('2026-10-14T18:00:00Z');
  const fromSunday = visibleCalendarWindow(sunday);
  const fromWednesday = visibleCalendarWindow(wednesday);
  assert.equal(fromSunday.start.toISOString(), '2026-10-11T06:00:00.000Z');
  // The end is midnight in America/Edmonton six weeks later. Its UTC offset depends on the installed tz
  // database (2026 tzdata releases change Alberta's rules for November 2026), so check the local wall time.
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(fromSunday.end);
  assert.equal(local.replace(',', ''), '2026-11-22 00:00');
  assert.ok(fromSunday.end - fromSunday.start >= 42 * 86400000 - 3600000 && fromSunday.end - fromSunday.start <= 42 * 86400000 + 3600000);
  assert.equal(fromWednesday.start.toISOString(), fromSunday.start.toISOString());
});

test('cash of 100 lights runway and spend red and every ranked move is returned', () => {
  const now = new Date('2026-10-12T18:00:00Z');
  const profile = readFileSync(new URL('../ceo/shared/company-profile.md', import.meta.url), 'utf8');
  const facts = readProfileFacts(profile);
  assert.equal(facts.cash, 100);
  assert.equal(facts.burnMonthly, 90050);
  const lamps = computeLamps({
    now,
    ...facts,
    overdue: { count: 0, oldest: 0 },
    conversations: null,
    regulator: [{ due: Date.parse('2026-10-17T18:00:00Z'), owner: 'Chad' }],
    exits: null,
  });
  const byKey = Object.fromEntries(lamps.map((lamp) => [lamp.key, lamp]));
  assert.equal(byKey.L1.state, 'red');
  assert.equal(byKey.L6.state, 'red');
  assert.equal(byKey.L8.state, 'unknown');
  assert.equal(lamps.length, 8);
  const items = ROADMAP.map((row) => ({
    id: row.title.slice(0, 8),
    title: row.title,
    area: row.area,
    status: 'open',
    priority: row.priority,
    owner: row.owner,
    category: row.category,
    due: Date.parse(`${row.due}T18:00:00Z`),
  }));
  const moves = pickMoves({ now, items, lamps, facts });
  assert.equal(DEFAULT_WEIGHTS.P4, 5);
  assert.equal(moves.length > 3, true);
  assert.equal(moves[0].rank, 1);
  assert.equal(moves[moves.length - 1].rank, moves.length);
  const raise = moves.filter((move) => move.principle === 'P1');
  assert.equal(raise.length > 0, true);
  assert.equal(moves.some((move) => move.principle === 'P2'), true);
  assert.equal(moves.some((move) => move.facing !== 'internal'), true);
  assert.match(raise[0].whyNow, /\$80,000 is in/);
  assert.match(raise[0].how.join(' '), /Kevin/);
  const hidden = pickMoves({ now, items, lamps, facts, quietKeys: [moves[0].sourceKey] });
  assert.equal(hidden.some((move) => move.sourceKey === moves[0].sourceKey), false);
  for (const move of moves) {
    assert.equal(move.text.length <= 90, true);
    assert.equal(move.how.length >= 2 && move.how.length <= 4, true);
    assert.equal(/[\u2013\u2014]/.test(move.text + move.whyNow + move.how.join(' ')), false);
    assert.equal(/\bAI\b/.test(move.text + move.whyNow), false);
    assert.equal(/\bSign\b/.test(move.text + move.how.join(' ')), false);
    assert.equal(/Atherton/.test(move.text + move.how.join(' ')), false);
  }
  const quiet = pickMoves({
    now,
    items: [{ id: 'r1', title: 'Regulator outreach - FCAC note', area: 'outreach', status: 'open', priority: 'normal', owner: 'Chad', due: Date.parse('2026-10-20T18:00:00Z') }],
    lamps: [],
    facts,
  });
  assert.equal(quiet.some((move) => move.principle === 'P4'), true);
});

test('package mail fills tokens and keeps research in the body', () => {
  assert.equal(STARTERS.length, 3);
  assert.equal(STARTERS.every((item) => !/@/.test(JSON.stringify(item.suggestions || []))), true);
  const investor = STARTERS.find((item) => item.kind === 'investor');
  assert.match(investor.emailSubject, /\$25,000/);
  assert.match(fillToken('Hello {{first_name}} at {{company}}', { name: 'Kevin Shaw', company: 'North' }), /Kevin/);
  const regulator = STARTERS.find((item) => item.kind === 'regulator');
  assert.match(regulator.emailBody, /RPAA/);
  assert.match(regulator.emailBody, /FINTRAC/);
  const mailed = assembleMail({ ...regulator, docs: [{ name: 'RPAA note', url: 'https://drive.google.com/file/d/abc' }] }, { name: 'Michael Stephens', company: 'Fasken' });
  assert.match(mailed, /Michael/);
  assert.match(mailed, /Docs:/);
  assert.equal(/@\w+\.\w+/.test(JSON.stringify(STARTERS.map((item) => item.suggestions))), false);
  const ordered = orderSpaceFolders([
    { id: 'c', parentId: 'b', name: 'Financials' },
    { id: 'a', parentId: '', name: 'Deck' },
    { id: 'b', parentId: 'a', name: 'Legal' },
    { id: 'e', parentId: 'd', name: 'Too deep' },
    { id: 'd', parentId: 'c', name: 'Notes' },
  ]);
  assert.deepEqual(ordered.map((folder) => folder.name), ['Deck', 'Legal', 'Financials', 'Notes']);
  assert.equal(ordered[3].depth, 4);
});

test('contact categories come from the company and role text', () => {
  assert.equal(inferContactCategory('North Capital Ventures'), 'vc');
  assert.equal(inferContactCategory('Fasken LLP'), 'regulator');
  assert.equal(inferContactCategory('Century 21'), 'business');
  assert.equal(inferContactCategory('Alberta Innovates grant'), 'grant');
  assert.equal(inferContactCategory('Advisory board'), 'board');
  assert.equal(inferContactCategory('Neighborhood cafe'), 'other');
});

test('the control room page does not carry secrets', () => {
  const page = readFileSync(new URL('../public/control-room.html', import.meta.url), 'utf8');
  assert.equal(page.includes('Connect Google'), true);
  assert.equal(page.includes('Connect GoHighLevel'), true);
  assert.equal(/DATABASE_URL|INGEST_TOKEN|CRON_SECRET|GOOGLE_|GHL_|refresh_token|client_secret/.test(page), false);
  assert.equal(page.includes('4orm Intelligence'), true);
  // UI copy that moved out of the page into the scripts it loads (2026-10 redesign) is checked where it lives now.
  const pub = (name) => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
  const warjs = pub('control-room-war.js');
  const shellNav = pub('shell-nav.js');
  assert.equal(pub('redesign-pages.js').includes('CEO ranked moves'), true);
  assert.equal(page.includes('wait-scroll'), true);
  assert.equal(page.includes('Form Intelligence'), false);
  assert.equal(page.includes('Do all steps'), true);
  assert.equal(page.includes('Close the round to $250,000'), true);
  assert.equal(page.includes('Spending cash cannot cover'), true);
  assert.equal(page.includes('Paper the subscription agreement'), true);
  assert.equal(page.includes("Delete '+ids.length+' '+noun+'?'"), true);
  assert.equal(page.includes("ids.length+' deleted'"), true);
  assert.equal(/Atherton/.test(page), false);
  assert.equal(/\/api\/(ingest|mcp|cron)/.test(page), false);
  assert.equal(warjs.includes('Daily sweep - news'), true);
  // The legacy War Room fallback no longer paints hard-coded money (Cash $100, $80K of $250K).
  assert.equal(/Cash \$100|\$80K of \$250K/.test(warjs), false);
  assert.equal(page.includes('Ask 4orm Intelligence to build the plan'), true);
  assert.equal(warjs.includes('Waiting on us'), true);
  assert.equal(warjs.includes("You said you\\'d do it"), true);
  assert.equal(warjs.includes('Waiting on others'), true);
  assert.equal(page.includes('Nothing urgent on the desk'), true);
  assert.equal(page.includes('data-v="cal"'), false);
  assert.equal(page.includes('id="navToggle"'), true);
  assert.equal(page.includes('id="peopleFilter"'), true);
  assert.equal(shellNav.includes("'work', '/spaces'"), true);
  assert.equal(page.includes('id="pkgGrid"'), true);
  assert.equal(page.includes('Prepare send'), true);
  assert.equal(page.includes('Stages from GoHighLevel'), true);
  assert.equal(page.includes('id="docView"'), true);
  assert.equal(page.includes('Open in Drive'), true);
  assert.equal(page.includes('id="v-znotes"'), true);
  assert.equal(page.includes('#v-znotes{background:linear-gradient(180deg,#1a2f70'), true);
  assert.equal(page.includes('data-doc-url'), true);
  assert.equal(shellNav.includes("'drive', '/drive'"), true);
  assert.equal(page.includes('<div class="t">Spaces</div>'), true);
  assert.equal(page.includes('Pinned / Key docs'), true);
  assert.equal(page.includes('Move to Drive'), true);
  assert.equal(page.includes('cr_docs_open'), true);
  assert.equal(page.includes('Thumbnails'), true);
  assert.equal(page.includes('control-room-war.js'), true);
  assert.equal(page.includes('live-updates.js'), true);
  assert.equal(/Atherton|example\.com/.test(warjs), false);
  assert.equal(warjs.includes('/api/ceo/plan'), true);
  assert.equal(warjs.includes('/api/plans'), true);
  assert.equal(/\/api\/(ingest|mcp|cron)/.test(warjs), false);
  // Every live script the page loads (fixture files excluded) is held to the same rules as the page,
  // and the finance code is checked on the server only: no code, no client-side compare.
  const live = readdirSync(new URL('../public/', import.meta.url))
    .filter((name) => name.endsWith('.js') && !/^redesign-fixture/.test(name))
    .map((name) => [name, pub(name)]);
  assert.ok(live.length > 5);
  for (const [name, src] of live) {
    assert.equal(/DATABASE_URL|INGEST_TOKEN|CRON_SECRET|GOOGLE_|GHL_|refresh_token|client_secret/.test(src), false, name);
    assert.equal(/\/api\/(ingest|mcp|cron)/.test(src), false, name);
    assert.equal(/Atherton|example\.com/.test(src), false, name);
    assert.equal(/finCode\s*[:=]|STATE\.finCode|\b1313\b/.test(src), false, name);
  }
  assert.equal(/finCode\s*[:=]|STATE\.finCode|'1313'/.test(page), false);
});

test('war room helpers extract commitments and fill a plan', () => {
  const rows = extractCommitments([{
    id: 'n1',
    date: '2026-10-01',
    others: ["I'll send the deck."],
    improve: ['I am going to call the broker.'],
    intel: [{ value: 'The market is quiet.' }, { value: "I will follow up tomorrow." }],
  }]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].sourceNoteId, 'n1');
  assert.equal(rows[0].madeOn, '2026-10-01');
  const again = extractCommitments([{ id: 'n1', date: '2026-10-01', others: ["I'll send the deck.", "I'll send the deck."], improve: [], intel: [] }]);
  assert.equal(again.length, 1);
  const plan = fallbackPlan({ title: 'Email the broker', area: 'outreach', steps: [] });
  assert.equal(plan.steps.length >= 2, true);
  assert.match(plan.draft, /Hello/);
  assert.equal(/[\u2013\u2014]/.test(JSON.stringify(plan)), false);
  assert.equal(zoneOf({ principle: 'P1', text: 'Close the round', area: 'other' }), 'raise');
  assert.equal(zoneOf({ principle: 'P2', text: 'Call brokers', area: 'outreach' }), 'partner');
  assert.equal(zoneOf({ principle: 'P4', facing: 'regulator', text: 'Note the file', area: 'outreach' }), 'regulator');
  assert.equal(NEWS_CATEGORIES.includes('Fundraising / VC'), true);
  assert.equal(NEWS_CATEGORIES.includes('AI'), true);
});

test('unsigned webhooks are rejected and signed ones pass', () => {
  const secret = 'hook-secret';
  const empty = { get: () => '' };
  assert.equal(hookTokenOk({ url: 'https://4ormop.com/api/hooks/gmail', headers: empty }, secret), false);
  assert.equal(hookTokenOk({ url: 'https://4ormop.com/api/hooks/gmail?token=wrong', headers: empty }, secret), false);
  assert.equal(hookTokenOk({ url: 'https://4ormop.com/api/hooks/gmail?token=hook-secret', headers: empty }, secret), true);
  assert.equal(hookTokenOk({ url: 'https://4ormop.com/api/hooks/gmail', headers: empty }, ''), false);
  assert.equal(calendarTokenOk({ get: (name) => (name === 'x-goog-channel-token' ? secret : '') }, secret), true);
  assert.equal(calendarTokenOk(empty, secret), false);
  const ghlRaw = '{"type":"ContactUpdate"}';
  assert.equal(ghlOk({ url: 'https://4ormop.com/api/hooks/ghl?token=hook-secret', headers: empty }, ghlRaw, secret), true);
  assert.equal(ghlOk({ url: 'https://4ormop.com/api/hooks/ghl', headers: empty }, ghlRaw, secret), false);
});

test('zoom crc and signature match the documented HMAC', () => {
  const secret = 'zoom-secret';
  const raw = '{"event":"recording.completed"}';
  const ts = '1710000000';
  const presented = zoomSignature(raw, ts, secret);
  assert.equal(zoomOk(raw, ts, presented, secret), true);
  assert.equal(zoomOk(raw, ts, 'v0=deadbeef', secret), false);
  assert.equal(zoomOk(raw, ts, presented, ''), false);
  assert.equal(zoomCrc('plain', secret).length, 64);
});

test('the open page polls /api/changes only while visible', () => {
  const live = readFileSync(new URL('../public/live-updates.js', import.meta.url), 'utf8');
  assert.equal(live.includes('/api/changes'), true);
  assert.equal(live.includes('15000'), true);
  assert.equal(live.includes("document.visibilityState !== 'visible'"), true);
  assert.equal(live.includes('visibilitychange'), true);
});

test('every signed-in API route is allowlisted (sessionOwner) and fails closed', () => {
  const apiRoot = new URL('../app/api/', import.meta.url);
  const files = [];
  const walk = (dir, rel) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory()) walk(new URL(ent.name + '/', dir), rel + ent.name + '/');
      else if (ent.name === 'route.ts') files.push(rel.replace(/\/$/, ''));
    }
  };
  walk(apiRoot, '');
  assert.ok(files.length > 80);
  // Token-authenticated (webhooks, cron, ingest), deliberately public, or checked by email directly.
  const exempt = /^(book|clerk-publishable-key|news\/(image|thumb)\/\[id\]|hooks\/.*|cron\/.*|ingest|mcp|ops\/dedupe|private-doc)$/;
  const missing = [];
  for (const rel of files) {
    const src = readFileSync(new URL(rel + '/route.ts', apiRoot), 'utf8');
    if (/^export \{[^}]*\} from '\.\.\//m.test(src)) continue; // re-export of a gated route
    if (exempt.test(rel)) continue;
    if (!src.includes('openBoard()')) continue;
    const opens = (src.match(/await openBoard\(\)/g) || []).length;
    const gates = (src.match(/sessionOwner\(/g) || []).length;
    if (gates < opens) missing.push(rel);
  }
  assert.deepEqual(missing, []);
  // The public booking page only talks to the public booking route.
  const book = readFileSync(new URL('../public/book.html', import.meta.url), 'utf8');
  assert.deepEqual([...new Set(book.match(/\/api\/[a-z-/]+/g) || [])], ['/api/book']);
  const bookRoute = readFileSync(new URL('book/route.ts', apiRoot), 'utf8');
  assert.equal(bookRoute.includes('openBoard'), false);
  // Signed person-specific documents are not served from public/.
  assert.equal(readdirSync(new URL('../public/documents/', import.meta.url)).includes('private'), false);
  const privateDoc = readFileSync(new URL('private-doc/route.ts', apiRoot), 'utf8');
  assert.match(privateDoc, /isRoomEmail\(email\)/);
  assert.match(privateDoc, /status: 403/);
});
