import assert from 'node:assert/strict';
import test from 'node:test';
import { isBoolean, isPlaystateAction, isPositionTicks, isSessionId, isVolume } from '../backend/src/jellyfin/validation.js';

test('session IDs accept Jellyfin GUID forms only', () => {
  assert.equal(isSessionId('0123456789abcdef0123456789abcdef'), true);
  assert.equal(isSessionId('01234567-89ab-cdef-0123-456789abcdef'), true);
  assert.equal(isSessionId('../Sessions'), false);
  assert.equal(isSessionId(''), false);
});

test('playstate command allowlist rejects unknown actions', () => {
  for (const action of ['play', 'pause', 'stop', 'next', 'previous']) assert.equal(isPlaystateAction(action), true);
  for (const action of ['Seek', 'Shutdown', '', 1]) assert.equal(isPlaystateAction(action), false);
});

test('seek ticks must be finite, non-negative safe integers', () => {
  for (const ticks of [0, 10_000_000, Number.MAX_SAFE_INTEGER]) assert.equal(isPositionTicks(ticks), true);
  for (const ticks of [-1, 1.5, Infinity, NaN, '100', Number.MAX_SAFE_INTEGER + 1]) assert.equal(isPositionTicks(ticks), false);
});

test('volume is an integer from zero through one hundred', () => {
  for (const volume of [0, 50, 100]) assert.equal(isVolume(volume), true);
  for (const volume of [-1, 101, 30.5, '50', null]) assert.equal(isVolume(volume), false);
  assert.equal(isBoolean(true), true);
  assert.equal(isBoolean('true'), false);
});

import { isItemId, isItemIds, isPlayCommand } from '../backend/src/jellyfin/validation.js';

test('PlayNow inputs reject malformed sessions, items, empty arrays and unsupported commands', () => {
  const valid = '0123456789abcdef0123456789abcdef';
  assert.equal(isSessionId(valid), true);
  assert.equal(isSessionId('bad/session'), false);
  assert.equal(isItemId(valid), true);
  assert.equal(isItemId('../items'), false);
  assert.equal(isItemIds([valid]), true);
  for (const value of [[], ['bad/item'], [valid, 'not-an-id'], 'string', null]) assert.equal(isItemIds(value), false);
  assert.equal(isPlayCommand('PlayNow'), true);
  for (const value of ['PlayNext', 'PlayLast', 'Shutdown', 'playNow', null]) assert.equal(isPlayCommand(value), false);
});
