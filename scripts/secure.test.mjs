import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { tokenOk, allowArea, allowPriority, allowStage, allowStatus, allowContactType, allowTier, allowNoteColor, isBriefHour, windowKey, CEILINGS, parseDue, visibleCalendarWindow } from '../lib/guard.mjs';
import { ROADMAP, ROAD_CATEGORIES } from '../lib/roadmap.mjs';
import { computeLamps, pickMoves, readProfileFacts } from '../lib/ceo-score.mjs';
import { organizeText } from '../lib/organize.mjs';
import { openSeal, seal } from '../lib/seal.mjs';
import { readState, signState } from '../lib/oauth-state.mjs';

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

test('zoom notes seed is a dated transcript library', () => {
  const notes = JSON.parse(readFileSync(new URL('../zoom_notes_seed.json', import.meta.url), 'utf8'));
  assert.equal(notes.length, 42);
  for (const note of notes) {
    assert.match(note.noteId, /^[A-Za-z0-9_-]+$/);
    assert.match(note.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(note.title.trim().length > 0, true);
    assert.equal(Array.isArray(note.attendees), true);
    assert.equal(Array.isArray(note.summary), true);
    assert.equal(Array.isArray(note.stats), true);
    assert.equal(Array.isArray(note.sources), true);
    assert.equal(/\bAI\b/.test(note.title), false);
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
  assert.equal(fromSunday.end.toISOString(), '2026-11-22T07:00:00.000Z');
  assert.equal(fromWednesday.start.toISOString(), fromSunday.start.toISOString());
});

test('cash of 100 lights runway and spend red and the three moves stay distinct', () => {
  const now = new Date('2026-10-12T18:00:00Z');
  const profile = readFileSync(new URL('../ceo/company-profile.md', import.meta.url), 'utf8');
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
  assert.equal(moves.length, 3);
  assert.equal(new Set(moves.map((move) => move.principle)).size, 3);
  assert.equal(moves.filter((move) => move.facing === 'internal').length <= 1, true);
  assert.equal(moves.some((move) => move.facing !== 'internal'), true);
  for (const move of moves) {
    assert.equal(move.text.length <= 90, true);
    assert.equal(/[\u2013\u2014]/.test(move.text + move.whyNow), false);
    assert.equal(/\bAI\b/.test(move.text + move.whyNow), false);
    assert.equal(/\bSign\b/.test(move.text), false);
    assert.equal(/Atherton/.test(move.text), false);
  }
});

test('the control room page does not carry secrets', () => {
  const page = readFileSync(new URL('../public/control-room.html', import.meta.url), 'utf8');
  assert.equal(page.includes('Connect Google'), true);
  assert.equal(page.includes('Connect GoHighLevel'), true);
  assert.equal(/DATABASE_URL|INGEST_TOKEN|CRON_SECRET|GOOGLE_|GHL_|refresh_token|client_secret/.test(page), false);
  assert.equal(page.includes('CEO - next three moves'), true);
  assert.equal(/Atherton/.test(page), false);
  assert.equal(/\/api\/(ingest|mcp|cron)/.test(page), false);
});
