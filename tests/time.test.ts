import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSeconds, secondsToTicks, ticksToSeconds } from '../frontend/src/utils/time.ts';

test('Jellyfin ticks and seconds convert in both directions', () => {
  assert.equal(ticksToSeconds(10_000_000), 1);
  assert.equal(secondsToTicks(42.5), 425_000_000);
  assert.equal(ticksToSeconds(secondsToTicks(113.25)), 113.25);
});

test('playback times display minutes and hours', () => {
  assert.equal(formatSeconds(42), '0:42');
  assert.equal(formatSeconds(2533), '42:13');
  assert.equal(formatSeconds(6807), '1:53:27');
  assert.equal(formatSeconds(-10), '0:00');
});
