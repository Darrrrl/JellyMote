export interface ServerInfo { name: string; version: string | null; id: string | null }
export interface Playback {
  itemId: string | null;
  title: string;
  subtitle: string | null;
  type: string | null;
  positionTicks: number;
  durationTicks: number;
  isPaused: boolean;
  volume: number | null;
  isMuted: boolean;
  imageUrl: string | null;
}
export interface Session {
  id: string;
  deviceName: string;
  client: string;
  userName: string;
  canControl: boolean;
  supportsRemoteControl: boolean | null;
  supportsMediaControl: boolean | null;
  supportedCommands: string[];
  canStartPlayback: boolean;
  playstate: Record<'play' | 'pause' | 'stop' | 'next' | 'previous', boolean>;
  canSeek: boolean;
  canSetVolume: boolean;
  canMute: boolean;
  isActive: boolean;
  lastActivityDate: string | null;
  playback: Playback | null;
}
