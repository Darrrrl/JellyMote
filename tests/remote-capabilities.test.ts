import assert from 'node:assert/strict';
import test from 'node:test';
import type { JellyfinSession } from '../backend/src/jellyfin/types.js';

process.env.JELLYFIN_URL ||= 'http://127.0.0.1:8096';
process.env.JELLYFIN_API_KEY ||= 'test-only-key';

test('backend validates each remote action against the current session', async () => {
  const { jellyfin } = await import('../backend/src/jellyfin/client.js');
  const { remote } = await import('../backend/src/jellyfin/remote.js');
  const { library } = await import('../backend/src/jellyfin/library.js');
  const original = { rawSessions: jellyfin.rawSessions, sendPlaystate: jellyfin.sendPlaystate, sendGeneral: jellyfin.sendGeneral, playItems: jellyfin.playItems, playable: library.playable };
  const sent: string[] = [];
  let session: JellyfinSession = { Id: '0123456789abcdef0123456789abcdef', IsActive: true, NowPlayingItem: { RunTimeTicks: 100 }, PlayState: { IsMuted: false } };
  const id = session.Id!;
  jellyfin.rawSessions = async () => [session];
  jellyfin.sendPlaystate = async (_id, command) => { sent.push(command); };
  jellyfin.sendGeneral = async (_id, command) => { sent.push(command); };
  jellyfin.playItems = async () => { sent.push('PlayNow'); };
  library.playable = async () => {};
  try {
    session = { ...session, SupportsRemoteControl: false, SupportsMediaControl: true };
    await remote.playItems(id, ['item'], 'PlayNow');
    await remote.playstate(id, 'pause');
    session = { ...session, SupportsMediaControl: false, SupportedCommands: ['Play', 'Pause', 'SetVolume', 'ToggleMute'] };
    await remote.playItems(id, ['item'], 'PlayNow');
    await remote.playstate(id, 'pause');
    await remote.volume(id, 30);
    await remote.mute(id, true);
    await assert.rejects(remote.playstate(id, 'next'), { status: 409 });
    session = { ...session, SupportedCommands: [], PlayState: { CanSeek: true } };
    await remote.seek(id, 50);
    await assert.rejects(remote.playItems(id, ['item'], 'PlayNow'), { status: 409 });
    await assert.rejects(remote.volume(id, 30), { status: 409 });
    session = { ...session, PlayState: { CanSeek: false } };
    await assert.rejects(remote.seek(id, 50), { status: 409 });
    session = { ...session, IsActive: false, SupportsMediaControl: true, SupportedCommands: ['SetVolume'] };
    await assert.rejects(remote.playstate(id, 'play'), { status: 404 });
    assert.deepEqual(sent, ['PlayNow', 'Pause', 'PlayNow', 'Pause', 'SetVolume', 'ToggleMute', 'Seek']);
  } finally {
    Object.assign(jellyfin, { rawSessions: original.rawSessions, sendPlaystate: original.sendPlaystate, sendGeneral: original.sendGeneral, playItems: original.playItems });
    library.playable = original.playable;
  }
});
