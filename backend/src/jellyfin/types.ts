export interface JellyfinSystemInfo {
  ServerName?: string | null;
  Version?: string | null;
  Id?: string | null;
}

export interface JellyfinItem {
  Id?: string;
  Name?: string | null;
  Type?: string;
  SeriesName?: string | null;
  ParentIndexNumber?: number | null;
  IndexNumber?: number | null;
  RunTimeTicks?: number | null;
  ImageTags?: { Primary?: string };
  ParentBackdropItemId?: string | null;
  ParentBackdropImageTags?: string[];
}

export interface JellyfinPlayState {
  PositionTicks?: number | null;
  CanSeek?: boolean;
  IsPaused?: boolean;
  IsMuted?: boolean;
  VolumeLevel?: number | null;
}

export interface JellyfinSession {
  Id?: string | null;
  DeviceName?: string | null;
  Client?: string | null;
  UserName?: string | null;
  IsActive?: boolean;
  LastActivityDate?: string;
  SupportsRemoteControl?: boolean;
  SupportsMediaControl?: boolean;
  SupportedCommands?: string[] | null;
  NowPlayingItem?: JellyfinItem;
  PlayState?: JellyfinPlayState;
}

export interface SessionView {
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
  playback: {
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
  } | null;
}
