import type { LibraryHome, MediaItem } from '../types/library';
import type { ServerInfo, Session } from '../types/jellyfin';

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

async function post(path: string, body: object): Promise<void> {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error || `Command failed (${response.status}).`);
  }
}

export type PlaystateAction = 'play' | 'pause' | 'stop' | 'next' | 'previous';

export const api = {
  libraries: () => get<LibraryHome>('/libraries'),
  movies: () => get<MediaItem[]>('/library/movies'),
  shows: () => get<MediaItem[]>('/library/shows'),
  movie: (id: string) => get<MediaItem>(`/movies/${encodeURIComponent(id)}`),
  show: (id: string) => get<MediaItem>(`/shows/${encodeURIComponent(id)}`),
  seasons: (id: string) => get<MediaItem[]>(`/shows/${encodeURIComponent(id)}/seasons`),
  episodes: (id: string) => get<MediaItem[]>(`/seasons/${encodeURIComponent(id)}/episodes`),
  playItems: (sessionId: string, itemIds: string[]) => post(`/sessions/${encodeURIComponent(sessionId)}/play`, { itemIds, command: 'PlayNow' }),
  server: () => get<ServerInfo>('/server'),
  sessions: () => get<Session[]>('/sessions'),
  playstate: (id: string, command: PlaystateAction) => post(`/sessions/${encodeURIComponent(id)}/playstate`, { command }),
  seek: (id: string, positionTicks: number) => post(`/sessions/${encodeURIComponent(id)}/seek`, { positionTicks }),
  volume: (id: string, volume: number) => post(`/sessions/${encodeURIComponent(id)}/volume`, { volume }),
  mute: (id: string, muted: boolean) => post(`/sessions/${encodeURIComponent(id)}/mute`, { muted }),
};
