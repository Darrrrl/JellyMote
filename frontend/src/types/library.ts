export interface MediaItem {
  id: string; title: string; type: string; year: number | null; overview: string | null;
  runtimeTicks: number | null; seasonNumber: number | null; episodeNumber: number | null;
  parentSeasonNumber: number | null; seriesId: string | null; seriesName: string | null;
  posterUrl: string | null; thumbUrl: string | null; backdropUrl: string | null;
  played: boolean; progressTicks: number;
}
export interface LibraryHome { userName: string; libraries: { id: string; title: string; type: 'movies' | 'shows'; imageUrl: string | null }[] }
