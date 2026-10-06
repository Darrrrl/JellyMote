import { jellyfin, JellyfinError } from './client.js';
import { library } from './library.js';
import type { JellyfinSession } from './types.js';
import type { PlaystateAction } from './validation.js';
import { sessionCapabilities } from './capabilities.js';

const playstateCommands: Record<PlaystateAction, string> = {
  play: 'Unpause', pause: 'Pause', stop: 'Stop', next: 'NextTrack', previous: 'PreviousTrack',
};

async function controllableSession(sessionId: string): Promise<JellyfinSession> {
  const session = (await jellyfin.rawSessions()).find(item => item.Id === sessionId);
  if (!session) throw new JellyfinError(404, 'The selected device is no longer connected.');
  if (session.IsActive === false) throw new JellyfinError(404, 'The selected device is no longer active.');
  if (!session.NowPlayingItem) throw new JellyfinError(409, 'Nothing is playing on this device.');
  return session;
}

export const remote = {
  async playItems(sessionId: string, itemIds: string[], command: 'PlayNow'): Promise<void> {
    const session = (await jellyfin.rawSessions()).find(item => item.Id === sessionId);
    if (!session || session.IsActive === false) throw new JellyfinError(404, 'Selected playback device disconnected.');
    if (!sessionCapabilities(session).canStartPlayback) throw new JellyfinError(409, "This Jellyfin client isn't advertising remote playback control.");
    await Promise.all(itemIds.map(id => library.playable(id)));
    await jellyfin.playItems(sessionId, itemIds, command);
  },
  async playstate(sessionId: string, action: PlaystateAction): Promise<void> {
    const session = await controllableSession(sessionId);
    if (!sessionCapabilities(session).playstate[action]) throw new JellyfinError(409, `This Jellyfin client isn't advertising ${action} control.`);
    await jellyfin.sendPlaystate(sessionId, playstateCommands[action]);
  },

  async seek(sessionId: string, positionTicks: number): Promise<void> {
    const session = await controllableSession(sessionId);
    if (!sessionCapabilities(session).canSeek) throw new JellyfinError(409, 'This device cannot seek the current media.');
    const duration = session.NowPlayingItem?.RunTimeTicks;
    if (duration && positionTicks > duration) throw new JellyfinError(422, 'Seek position exceeds the media duration.');
    await jellyfin.sendPlaystate(sessionId, 'Seek', positionTicks);
  },

  async volume(sessionId: string, volume: number): Promise<void> {
    const session = await controllableSession(sessionId);
    if (!sessionCapabilities(session).canSetVolume) throw new JellyfinError(409, 'This device does not support volume control.');
    await jellyfin.sendGeneral(sessionId, 'SetVolume', { Volume: String(volume) });
  },

  async mute(sessionId: string, muted: boolean): Promise<void> {
    const session = await controllableSession(sessionId);
    if (!sessionCapabilities(session).canMute) throw new JellyfinError(409, 'This device does not support the requested mute action.');
    const supported = session.SupportedCommands || [];
    const exact = muted ? 'Mute' : 'Unmute';
    if (supported.includes(exact)) {
      await jellyfin.sendGeneral(sessionId, exact);
    } else if (supported.includes('ToggleMute') && session.PlayState?.IsMuted !== undefined) {
      if (session.PlayState.IsMuted !== muted) await jellyfin.sendGeneral(sessionId, 'ToggleMute');
    } else {
      throw new JellyfinError(409, 'This device does not support the requested mute action.');
    }
  },
};
