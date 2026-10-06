import { config } from '../config/index.js';
import { JellyfinError } from './client.js';

interface RawItem {
  Id?: string; Name?: string; Type?: string; CollectionType?: string; ProductionYear?: number; Overview?: string;
  RunTimeTicks?: number; IndexNumber?: number; ParentIndexNumber?: number; SeriesId?: string; SeriesName?: string;
  ImageTags?: { Primary?: string; Thumb?: string }; BackdropImageTags?: string[];
  ParentThumbItemId?: string; ParentThumbImageTag?: string;
  UserData?: { Played?: boolean; PlaybackPositionTicks?: number; PlayedPercentage?: number };
}
interface RawUser { Id?: string; Name?: string; Policy?: { IsDisabled?: boolean } }
interface QueryResult { Items?: RawItem[]; TotalRecordCount?: number }

async function get<T>(path: string): Promise<T> {
  let response: Response;
  try { response = await fetch(`${config.jellyfinUrl}${path}`, { headers: { 'X-Emby-Token': config.apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new JellyfinError(502, 'Jellyfin is unavailable.'); }
  if (response.status === 404) throw new JellyfinError(404, 'Library item was not found.');
  if (!response.ok) throw new JellyfinError(502, `Jellyfin library request failed (HTTP ${response.status}).`);
  try { return await response.json() as T; } catch { throw new JellyfinError(502, 'Jellyfin returned an invalid library response.'); }
}

let userCache: { id: string; name: string } | null = null;
async function libraryUser() {
  if (userCache) return userCache;
  const users = (await get<RawUser[]>('/Users')).filter(user => user.Id && !user.Policy?.IsDisabled);
  const preferred = config.libraryUserName;
  const user = preferred ? users.find(user => user.Name?.toLowerCase() === preferred.toLowerCase()) : users.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))[0];
  if (!user?.Id) throw new JellyfinError(502, preferred ? `Jellyfin user "${preferred}" was not found or is disabled.` : 'No enabled Jellyfin user is available for library browsing.');
  userCache = { id: user.Id, name: user.Name || 'Jellyfin user' };
  return userCache;
}
function image(id: string | undefined, type: 'Primary' | 'Thumb' | 'Backdrop', available: boolean) {
  return id && available ? `/api/images/${encodeURIComponent(id)}/${type}` : null;
}
export function normalizeItem(item: RawItem) {
  const id = item.Id || '';
  return {
    id, title: item.Name || 'Untitled', type: item.Type || '', year: item.ProductionYear ?? null,
    overview: item.Overview || null, runtimeTicks: item.RunTimeTicks ?? null,
    seasonNumber: item.IndexNumber ?? null, episodeNumber: item.IndexNumber ?? null,
    parentSeasonNumber: item.ParentIndexNumber ?? null, seriesId: item.SeriesId || null, seriesName: item.SeriesName || null,
    posterUrl: image(id, 'Primary', Boolean(item.ImageTags?.Primary)),
    thumbUrl: image(id, 'Thumb', Boolean(item.ImageTags?.Thumb)) || image(item.ParentThumbItemId, 'Thumb', Boolean(item.ParentThumbImageTag)),
    backdropUrl: image(id, 'Backdrop', Boolean(item.BackdropImageTags?.length)),
    played: item.UserData?.Played === true, progressTicks: item.UserData?.PlaybackPositionTicks ?? 0,
  };
}
export type MediaItem = ReturnType<typeof normalizeItem>;
async function item(id: string): Promise<RawItem> {
  const { id: userId } = await libraryUser();
  return get<RawItem>(`/Users/${userId}/Items/${encodeURIComponent(id)}`);
}
async function query(path: string): Promise<RawItem[]> { return (await get<QueryResult>(path)).Items || []; }
function params(values: Record<string, string>) { return new URLSearchParams(values).toString(); }

export const library = {
  async home() {
    const user = await libraryUser();
    const views = await query(`/Users/${user.id}/Views`);
    return { userName: user.name, libraries: views.filter(view => view.Id && ['movies', 'tvshows', 'mixed'].includes(view.CollectionType || '')).flatMap(view => (view.CollectionType === 'mixed' ? ['movies', 'shows'] as const : [view.CollectionType === 'movies' ? 'movies' : 'shows'] as const).map(type => ({ id: view.Id!, title: view.Name || 'Library', type, imageUrl: image(view.Id, 'Primary', Boolean(view.ImageTags?.Primary)) }))) };
  },
  async list(type: 'Movie' | 'Series'): Promise<MediaItem[]> {
    const home = await this.home();
    const user = await libraryUser();
    const ids = home.libraries.filter(view => view.type === (type === 'Movie' ? 'movies' : 'shows')).map(view => view.id);
    const pages = await Promise.all(ids.map(async id => {
      const all: RawItem[] = [];
      for (let start = 0; ; start += 200) {
        const page = await query(`/Items?${params({ userId: user.id, parentId: id, recursive: 'true', includeItemTypes: type, sortBy: 'SortName', sortOrder: 'Ascending', startIndex: String(start), limit: '200', enableUserData: 'true' })}`);
        all.push(...page);
        if (page.length < 200) break;
      }
      return all;
    }));
    return [...new Map(pages.flat().filter(entry => entry.Id && entry.Type === type).map(entry => [entry.Id!, normalizeItem(entry)])).values()];
  },
  async details(id: string, type: 'Movie' | 'Series'): Promise<MediaItem> {
    const found = await item(id);
    if (found.Type !== type) throw new JellyfinError(404, 'Library item was not found.');
    return normalizeItem(found);
  },
  async seasons(showId: string): Promise<MediaItem[]> {
    await this.details(showId, 'Series');
    const user = await libraryUser();
    return (await query(`/Shows/${encodeURIComponent(showId)}/Seasons?${params({ userId: user.id, enableUserData: 'true' })}`)).filter(entry => entry.Id).map(normalizeItem);
  },
  async episodes(seasonId: string): Promise<MediaItem[]> {
    const season = await item(seasonId);
    if (season.Type !== 'Season' || !season.SeriesId) throw new JellyfinError(404, 'Season was not found.');
    const user = await libraryUser();
    const all: RawItem[] = [];
    for (let start = 0; ; start += 200) {
      const page = await query(`/Shows/${encodeURIComponent(season.SeriesId)}/Episodes?${params({ userId: user.id, seasonId, startIndex: String(start), limit: '200', enableUserData: 'true' })}`);
      all.push(...page);
      if (page.length < 200) break;
    }
    return all.filter(entry => entry.Id && entry.Type === 'Episode').map(normalizeItem);
  },
  async playable(id: string) {
    const found = await item(id);
    if (found.Type !== 'Movie' && found.Type !== 'Episode') throw new JellyfinError(422, 'Only movies and episodes can be played from the library.');
  },
};
