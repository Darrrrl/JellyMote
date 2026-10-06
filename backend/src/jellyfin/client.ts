import { config } from '../config/index.js';
import type { JellyfinSession, JellyfinSystemInfo, SessionView } from './types.js';
import { sessionCapabilities } from './capabilities.js';
import { jellyfinHeaders } from './headers.js';

export class JellyfinError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.jellyfinUrl}${path}`, {
      headers: jellyfinHeaders(),
      ...init,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new JellyfinError(502, 'Jellyfin is unavailable. Check its URL and network connection.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new JellyfinError(502, 'Jellyfin rejected the configured API key.');
  }
  if (init?.method === 'POST' && response.status === 404) {
    throw new JellyfinError(404, 'The selected device is no longer connected.');
  }
  if (init?.method === 'POST' && response.status >= 400 && response.status < 500) {
    throw new JellyfinError(409, `Jellyfin rejected the command (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new JellyfinError(502, `Jellyfin returned HTTP ${response.status}.`);
  }
  if (init?.method === 'POST' || response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new JellyfinError(502, 'Jellyfin returned an invalid response.'); }
}

export const jellyfin = {
  server: () => request<JellyfinSystemInfo>('/System/Info'),
  sessions: async (): Promise<SessionView[]> => {
    const sessions = await request<JellyfinSession[]>('/Sessions?activeWithinSeconds=300');
    return sessions.filter((session): session is JellyfinSession & { Id: string } => Boolean(session.Id)).map(session => {
      const item = session.NowPlayingItem;
      const episode = item?.Type === 'Episode';
      const seasonEpisode = episode && item.ParentIndexNumber != null && item.IndexNumber != null
        ? `S${String(item.ParentIndexNumber).padStart(2, '0')} · E${String(item.IndexNumber).padStart(2, '0')}` : null;
      return {
        id: session.Id,
        deviceName: session.DeviceName || 'Unnamed device',
        client: session.Client || 'Unknown app',
        userName: session.UserName || 'Unknown user',
        ...sessionCapabilities(session),
        isActive: session.IsActive !== false,
        lastActivityDate: session.LastActivityDate || null,
        playback: item ? {
          itemId: item.Id || null,
          title: episode ? item.SeriesName || item.Name || 'Unknown episode' : item.Name || 'Unknown title',
          subtitle: episode ? [seasonEpisode, item.Name].filter(Boolean).join(' · ') : null,
          type: item.Type || null,
          positionTicks: session.PlayState?.PositionTicks || 0,
          durationTicks: item.RunTimeTicks || 0,
          isPaused: session.PlayState?.IsPaused === true,
          volume: session.PlayState?.VolumeLevel ?? null,
          isMuted: session.PlayState?.IsMuted === true,
          imageUrl: item.Id && item.ImageTags?.Primary ? `/api/images/${encodeURIComponent(item.Id)}/Primary` : null,
        } : null,
      };
    });
  },
  playItems: (sessionId: string, itemIds: string[], command: 'PlayNow' | 'PlayNext' | 'PlayLast') =>
    request<void>(`/Sessions/${encodeURIComponent(sessionId)}/Playing?${new URLSearchParams({ itemIds: itemIds.join(','), playCommand: command })}`, { method: 'POST' }),
  rawSessions: () => request<JellyfinSession[]>('/Sessions?activeWithinSeconds=300'),
  sendPlaystate: (sessionId: string, command: string, seekPositionTicks?: number) => {
    const query = seekPositionTicks === undefined ? '' : `?seekPositionTicks=${seekPositionTicks}`;
    return request<void>(`/Sessions/${encodeURIComponent(sessionId)}/Playing/${command}${query}`, { method: 'POST' });
  },
  sendGeneral: (sessionId: string, name: 'SetVolume' | 'Mute' | 'Unmute' | 'ToggleMute', args?: Record<string, string>) =>
    request<void>(`/Sessions/${encodeURIComponent(sessionId)}/Command`, {
      method: 'POST',
      headers: jellyfinHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ Name: name, Arguments: args || {} }),
    }),
};

export async function getImage(id: string, type: 'Primary' | 'Thumb' | 'Backdrop'): Promise<Response> {
  try {
    return await fetch(`${config.jellyfinUrl}/Items/${id}/Images/Primary?maxWidth=720&maxHeight=720&quality=85`, {
      headers: jellyfinHeaders(),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new JellyfinError(502, 'Artwork is unavailable.');
  }
}
