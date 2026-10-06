import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionCapabilities } from '../backend/src/jellyfin/capabilities.js';
import type { JellyfinSession } from '../backend/src/jellyfin/types.js';

const playing: JellyfinSession = { Id: '0123456789abcdef0123456789abcdef', IsActive: true, NowPlayingItem: { Id: 'item', RunTimeTicks: 100 }, PlayState: { IsMuted: false } };

test('media control enables playback and transport without remote control flag', () => {
  const capabilities = sessionCapabilities({ ...playing, SupportsRemoteControl: false, SupportsMediaControl: true });
  assert.equal(capabilities.canStartPlayback, true);
  assert.deepEqual(capabilities.playstate, { play: true, pause: true, stop: true, next: true, previous: true });
  assert.equal(capabilities.supportsRemoteControl, false);
});

test('useful commands enable only their corresponding actions', () => {
  const capabilities = sessionCapabilities({ ...playing, SupportsMediaControl: false, SupportedCommands: ['Play', 'Pause', 'Stop', 'SkipNext', 'SkipPrevious'] });
  assert.equal(capabilities.canStartPlayback, true);
  assert.deepEqual(capabilities.playstate, { play: true, pause: true, stop: true, next: true, previous: true });
  assert.equal(capabilities.canSeek, false);
});

test('both flags false and no commands stays view only', () => {
  const capabilities = sessionCapabilities({ ...playing, SupportsRemoteControl: false, SupportsMediaControl: false });
  assert.equal(capabilities.canControl, false);
  assert.equal(capabilities.canStartPlayback, false);
  assert.equal(Object.values(capabilities.playstate).some(Boolean), false);
});

test('seek is independent of media control and does not imply other actions', () => {
  const capabilities = sessionCapabilities({ ...playing, PlayState: { CanSeek: true } });
  assert.equal(capabilities.canSeek, true);
  assert.equal(capabilities.canControl, true);
  assert.equal(capabilities.canStartPlayback, false);
  assert.equal(capabilities.playstate.pause, false);
});

test('volume and mute follow supported commands and current mute state', () => {
  const volume = sessionCapabilities({ ...playing, SupportedCommands: ['SetVolume', 'Mute'] });
  assert.equal(volume.canSetVolume, true);
  assert.equal(volume.canMute, true);
  assert.equal(sessionCapabilities({ ...playing, PlayState: { IsMuted: true }, SupportedCommands: ['Mute'] }).canMute, false);
  assert.equal(sessionCapabilities({ ...playing, PlayState: { IsMuted: true }, SupportedCommands: ['Unmute'] }).canMute, true);
  assert.equal(sessionCapabilities({ ...playing, SupportedCommands: ['ToggleMute'] }).canMute, true);
  assert.equal(sessionCapabilities({ ...playing, PlayState: {}, SupportedCommands: ['ToggleMute'] }).canMute, false);
});

test('inactive clients stay view only even when they advertise commands', () => {
  const capabilities = sessionCapabilities({ ...playing, IsActive: false, SupportsMediaControl: true, SupportedCommands: ['SetVolume'], PlayState: { CanSeek: true } });
  assert.equal(capabilities.canControl, false);
  assert.equal(capabilities.canSetVolume, false);
  assert.equal(capabilities.canSeek, false);
});
