import type { JellyfinSession } from './types.js';
import type { PlaystateAction } from './validation.js';

const actionCommands: Record<PlaystateAction, string[]> = {
  play: ['Play', 'Unpause', 'PlayPause'],
  pause: ['Pause', 'PlayPause'],
  stop: ['Stop'],
  next: ['NextTrack', 'SkipNext'],
  previous: ['PreviousTrack', 'SkipPrevious'],
};

export function sessionCapabilities(session: JellyfinSession) {
  const isActive = session.IsActive !== false;
  const supportsMediaControl = session.SupportsMediaControl === true;
  const supportedCommands = Array.isArray(session.SupportedCommands)
    ? [...new Set(session.SupportedCommands.filter((command): command is string => typeof command === 'string'))]
    : [];
  const has = (...commands: string[]) => commands.some(command => supportedCommands.includes(command));
  const playstate = Object.fromEntries(Object.entries(actionCommands).map(([action, commands]) =>
    [action, isActive && (supportsMediaControl || has(...commands))])) as Record<PlaystateAction, boolean>;
  const canStartPlayback = isActive && (supportsMediaControl || has('Play', 'PlayNow', 'PlayMediaSource'));
  const canSeek = isActive && session.PlayState?.CanSeek === true;
  const canSetVolume = isActive && has('SetVolume');
  const canMute = isActive && (session.PlayState?.IsMuted === true
    ? has('Unmute') || (has('ToggleMute') && session.PlayState.IsMuted !== undefined)
    : has('Mute') || (has('ToggleMute') && session.PlayState?.IsMuted !== undefined));
  return {
    supportsRemoteControl: session.SupportsRemoteControl ?? null,
    supportsMediaControl: session.SupportsMediaControl ?? null,
    supportedCommands,
    canStartPlayback,
    playstate,
    canSeek,
    canSetVolume,
    canMute,
    canControl: canStartPlayback || Object.values(playstate).some(Boolean) || canSeek || canSetVolume || canMute,
  };
}
