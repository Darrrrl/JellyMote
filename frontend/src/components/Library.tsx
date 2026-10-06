import { useEffect, useState } from 'react';
import { ArrowLeft, Cast, ChevronRight, Film, Play, Search } from 'lucide-react';
import { api } from '../services/api';
import type { LibraryHome, MediaItem } from '../types/library';
import type { Session } from '../types/jellyfin';

type View =
  | { kind: 'home' }
  | { kind: 'movies' | 'shows' }
  | { kind: 'movie' | 'show' | 'season'; id: string; label?: string };
interface Props {
  selected: Session | null;
  disconnected: boolean;
  onChooseDevice: () => void;
  onPlaying: (title: string, itemId: string) => void;
}

const duration = (ticks: number | null) => ticks ? `${Math.round(ticks / 600_000_000)} min` : null;

function Art({ src, kind = 'poster' }: { src: string | null; kind?: 'poster' | 'thumb' | 'backdrop' }) {
  return <div className={`library-art ${kind}`}>
    <Film size={32} aria-hidden="true" />
    {src && <img src={src} loading="lazy" alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />}
  </div>;
}

function MediaCard({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  return <button type="button" className="media-card" onClick={onOpen}>
    <Art src={item.posterUrl} />
    <strong>{item.title}</strong>
    <span>{item.year || ' '}</span>
  </button>;
}

export function Library({ selected, disconnected, onChooseDevice, onPlaying }: Props) {
  const [stack, setStack] = useState<View[]>([{ kind: 'home' }]);
  const view = stack[stack.length - 1];
  const [home, setHome] = useState<LibraryHome | null>(null);
  const [homeShows, setHomeShows] = useState<MediaItem[]>([]);
  const [homeMovies, setHomeMovies] = useState<MediaItem[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const open = (next: View) => { setStack(current => [...current, next]); setPlayError(null); };
  const back = () => { setStack(current => current.slice(0, -1)); setPlayError(null); };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setItems([]);
    setDetail(null);
    const fetchData = async () => {
      if (view.kind === 'home') {
        const [home, shows, movies] = await Promise.all([api.libraries(), api.shows(), api.movies()]);
        return { home, shows, movies };
      }
      if (view.kind === 'movies' || view.kind === 'shows') {
        return { items: await (view.kind === 'movies' ? api.movies() : api.shows()) };
      }
      if (view.kind === 'movie') return { detail: await api.movie(view.id) };
      if (view.kind === 'show') {
        const [detail, items] = await Promise.all([api.show(view.id), api.seasons(view.id)]);
        return { detail, items };
      }
      if (view.kind === 'season') return { items: await api.episodes(view.id) };
      return {};
    };
    void fetchData().then(data => {
      if (!active) return;
      if (data.home) setHome(data.home);
      if (data.shows) setHomeShows(data.shows);
      if (data.movies) setHomeMovies(data.movies);
      if (data.items) setItems(data.items);
      if (data.detail) setDetail(data.detail);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load the library.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view.kind, 'id' in view ? view.id : null, retry]);

  async function play(item: MediaItem) {
    setPlayError(null);
    if (!selected) {
      setPlayError(disconnected ? 'Selected playback device disconnected.' : 'Choose a playback device first.');
      return;
    }
    if (!selected.canControl) {
      setPlayError('This device does not support remote playback.');
      return;
    }
    setPlayingId(item.id);
    try { await api.playItems(selected.id, [item.id]); onPlaying(item.title, item.id); }
    catch (cause) { setPlayError(cause instanceof Error ? cause.message : 'Could not start playback.'); }
    finally { setPlayingId(null); }
  }

  const filtered = view.kind === 'shows'
    ? items.filter(item => item.title.toLowerCase().includes(search.trim().toLowerCase()))
    : items;
  const title = view.kind === 'movies' ? 'Movies' : view.kind === 'shows' ? 'Shows'
    : view.kind === 'season' ? view.label || 'Episodes'
    : view.kind === 'home' ? '' : detail?.title || 'Loading…';

  return <div className="library-page">
    {view.kind !== 'home' && <div className="library-heading">
      <button className="back-button" onClick={back} type="button" aria-label="Go back"><ArrowLeft size={19} /> Back</button>
      {(view.kind === 'movies' || view.kind === 'shows' || view.kind === 'season') && <h2>{title}</h2>}
    </div>}
    <div className="target-bar glass">
      <Cast size={19} />
      <span><small>Playback target</small><strong>{selected?.deviceName || (disconnected ? 'Disconnected device' : 'No device selected')}</strong></span>
      <button type="button" onClick={onChooseDevice} aria-label="Change playback device"><ChevronRight size={20} /></button>
    </div>
    {playError && <div className="notice" role="alert">{playError} <button type="button" onClick={onChooseDevice}>Choose device</button></div>}
    {error && <div className="error-banner" role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
    {loading && <div className="media-grid">{Array.from({ length: 8 }, (_, index) => <div className="media-card" key={index}><div className="skeleton poster-skeleton" /><div className="skeleton text-skeleton" /></div>)}</div>}

    {!loading && !error && view.kind === 'home' && <>
      <p className="library-subtitle">Browsing as {home?.userName}</p>
      <section className="home-section" aria-labelledby="home-shows"><div className="home-section-heading"><h2 id="home-shows">Shows</h2><button type="button" onClick={() => open({ kind: 'shows' })}>See all <ChevronRight size={17} /></button></div>
        {homeShows.length ? <div className="media-grid preview-grid">{homeShows.slice(0, 6).map(item => <MediaCard key={item.id} item={item} onOpen={() => open({ kind: 'show', id: item.id })} />)}</div> : <p className="library-empty">No shows found</p>}
      </section>
      <section className="home-section" aria-labelledby="home-movies"><div className="home-section-heading"><h2 id="home-movies">Movies</h2><button type="button" onClick={() => open({ kind: 'movies' })}>See all <ChevronRight size={17} /></button></div>
        {homeMovies.length ? <div className="media-grid preview-grid">{homeMovies.slice(0, 6).map(item => <MediaCard key={item.id} item={item} onOpen={() => open({ kind: 'movie', id: item.id })} />)}</div> : <p className="library-empty">No movies found</p>}
      </section>
    </>}

    {!loading && !error && (view.kind === 'movies' || view.kind === 'shows') && <>
      {view.kind === 'shows' && <label className="show-search glass"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search shows…" aria-label="Search shows" /></label>}
      {filtered.length ? <div className="media-grid">{filtered.map(item => <MediaCard key={item.id} item={item} onOpen={() => open({ kind: view.kind === 'movies' ? 'movie' : 'show', id: item.id })} />)}</div>
        : <p className="library-empty">{search && view.kind === 'shows' ? 'No matching shows' : view.kind === 'shows' ? 'No shows found' : 'No movies found'}</p>}
    </>}

    {!loading && !error && (view.kind === 'movie' || view.kind === 'show') && detail && <>
      <div className="media-detail">
        <Art src={detail.backdropUrl || detail.posterUrl} kind="backdrop" />
        <div className="detail-copy"><p className="detail-kind">{view.kind === 'movie' ? 'Movie' : 'Series'}</p><h3>{detail.title}</h3><p className="detail-meta">{[detail.year, view.kind === 'movie' ? duration(detail.runtimeTicks) : null].filter(Boolean).join(' · ')}</p><p className="overview">{detail.overview || 'No description available.'}</p>
          {view.kind === 'movie' && <button className="play-item" type="button" disabled={playingId !== null} onClick={() => void play(detail)}><Play size={18} fill="currentColor" /> {playingId === detail.id ? 'Sending…' : `Play${selected ? ` on ${selected.deviceName}` : ''}`}</button>}
        </div>
      </div>
      {view.kind === 'show' && <section><h3 className="list-heading">Seasons</h3>{items.length ? <div className="season-list">{items.map(item => <button key={item.id} type="button" onClick={() => open({ kind: 'season', id: item.id, label: item.title })}><Art src={item.posterUrl} /><span>{item.title || `Season ${item.seasonNumber ?? ''}`}</span><ChevronRight size={18} /></button>)}</div> : <p className="library-empty">No seasons available</p>}</section>}
    </>}

    {!loading && !error && view.kind === 'season' && (items.length ? <div className="episode-list">{items.map(item => <article className="episode-card" key={item.id}>
      <Art src={item.thumbUrl || item.posterUrl} kind="thumb" />
      <div className="episode-info"><span className="episode-index">S{String(item.parentSeasonNumber ?? 0).padStart(2, '0')}E{String(item.episodeNumber ?? 0).padStart(2, '0')}</span><h3>{item.title}</h3><p>{[duration(item.runtimeTicks), item.played ? 'Watched' : item.progressTicks > 0 ? 'In progress' : null].filter(Boolean).join(' · ')}</p>{item.progressTicks > 0 && !item.played && item.runtimeTicks && <div className="episode-progress"><span style={{ width: `${Math.min(100, item.progressTicks / item.runtimeTicks * 100)}%` }} /></div>}</div>
      <button className="play-item episode-play" type="button" disabled={playingId !== null} onClick={() => void play(item)} aria-label={`Play ${item.title}${selected ? ` on ${selected.deviceName}` : ''}`} title={selected ? `Play on ${selected.deviceName}` : 'Choose a playback device'}><Play size={17} fill="currentColor" /><span>{playingId === item.id ? 'Sending…' : 'Play'}</span></button>
    </article>)}</div> : <p className="library-empty">This season has no episodes</p>)}
  </div>;
}
