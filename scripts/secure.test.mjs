import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { tokenOk, allowArea, allowStage, allowContactType, allowTier, allowNoteColor, isBriefHour, windowKey, CEILINGS, parseDue, visibleCalendarWindow } from '../lib/guard.mjs';
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

test('the control room page does not carry secrets', () => {
  const page = readFileSync(new URL('../public/control-room.html', import.meta.url), 'utf8');
  assert.equal(page.includes('Connect Google'), true);
  assert.equal(page.includes('Connect GoHighLevel'), true);
  assert.equal(/DATABASE_URL|INGEST_TOKEN|CRON_SECRET|GOOGLE_|GHL_|refresh_token|client_secret/.test(page), false);
});
