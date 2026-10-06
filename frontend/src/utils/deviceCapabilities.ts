import type { Session } from '../types/jellyfin';

export function deviceDiagnostic(session: Session): string {
  if (!session.isActive) return 'This Jellyfin client is inactive.';
  if (!session.canControl) return "This Jellyfin client isn't advertising remote playback control.";
  const available = [
    session.canStartPlayback && 'start playback',
    ...Object.entries(session.playstate).filter(([, enabled]) => enabled).map(([action]) => action),
    session.canSeek && 'seek',
    session.canSetVolume && 'volume',
    session.canMute && 'mute',
  ].filter(Boolean);
  return `Available controls: ${available.join(', ')}.`;
}
