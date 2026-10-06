import { useEffect, useState } from 'react';
import { Cast, Disc3, LibraryBig, Radio, RefreshCw } from 'lucide-react';
import { DeviceList } from '../components/DeviceList';
import { Library } from '../components/Library';
import { NowPlaying } from '../components/NowPlaying';
import { useJellyfin } from '../hooks/useJellyfin';

type Tab = 'playing' | 'library' | 'devices';
const STORAGE_KEY = 'jellymote:selected-session';

export function App() {
  const { server, sessions, loading, error, sessionsUpdatedAt, refresh } = useJellyfin();
  const [tab, setTab] = useState<Tab>('playing');
  const [returnToLibrary, setReturnToLibrary] = useState(false);
  const [pendingPlay, setPendingPlay] = useState<{ title: string; itemId: string } | null>(null);
  const [playNotice, setPlayNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const selected = sessions.find(session => session.id === selectedId) || null;
  const selectedDisconnected = Boolean(selectedId && !selected && !loading && !error);

  useEffect(() => {
    if (!loading && !selectedId && sessions.length) {
      setSelectedId(sessions.find(session => session.canControl)?.id || sessions[0].id);
    }
  }, [loading, selectedId, sessions]);

  useEffect(() => { if (pendingPlay && selected?.playback?.itemId === pendingPlay.itemId) { setPlayNotice(`Playing ${pendingPlay.title} on ${selected.deviceName}.`); setPendingPlay(null); } }, [pendingPlay, selected]);
  useEffect(() => { if (!pendingPlay) return; const timer = window.setTimeout(() => { setPlayNotice(`Jellyfin accepted ${pendingPlay.title}, but the device has not reported playback yet. Check the player.`); setPendingPlay(null); }, 12000); return () => window.clearTimeout(timer); }, [pendingPlay]);

  const select = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
    setTab(returnToLibrary ? 'library' : 'playing');
    setReturnToLibrary(false);
  };

  const startPlaying = (title: string, itemId: string) => {
    setPlayNotice(null);
    setPendingPlay({ title, itemId });
    setTab('playing');
    void refresh();
    window.setTimeout(() => { void refresh(); }, 900);
    window.setTimeout(() => { void refresh(); }, 2400);
    window.setTimeout(() => { void refresh(); }, 5000);
  };

  return <div className={`app-shell ${tab === 'playing' && selected?.playback?.imageUrl ? 'has-artwork' : ''}`} style={tab === 'playing' && selected?.playback?.imageUrl ? { '--page-art': `url("${selected.playback.imageUrl}")` } as React.CSSProperties : undefined}>
    <header className="topbar"><div className="topbar-inner"><div className="brand"><div className="brand-mark"><Disc3 size={19} strokeWidth={2} /></div><span>jelly<span>mote</span></span></div><nav className="main-nav glass-nav" aria-label="Main navigation"><button type="button" className={tab === 'playing' ? 'active' : ''} aria-current={tab === 'playing' ? 'page' : undefined} onClick={() => setTab('playing')}><Radio size={19} /><span>Now Playing</span></button><button type="button" className={tab === 'library' ? 'active' : ''} aria-current={tab === 'library' ? 'page' : undefined} onClick={() => setTab('library')}><LibraryBig size={19} /><span>Library</span></button><button type="button" className={tab === 'devices' ? 'active' : ''} aria-current={tab === 'devices' ? 'page' : undefined} onClick={() => setTab('devices')}><Cast size={19} /><span>Devices</span></button></nav><div className={`connection ${error ? 'offline' : ''}`}><span className="connection-dot" />{error ? 'Offline' : loading ? 'Connecting' : server?.name || 'Connected'}</div></div></header>
    <main className="content">
      <div className="intro"><h1>{tab === 'playing' ? 'Now Playing' : tab === 'library' ? 'Library' : 'Devices'}</h1>{tab !== 'playing' && <p>{tab === 'library' ? 'Find something to play.' : 'Choose where to play.'}</p>}</div>
      {error && <div className="error-banner" role="alert"><RefreshCw size={19} /><div><strong>Can’t connect to Jellyfin</strong><span>{error}</span></div></div>}
      {selectedDisconnected && <div className="notice" role="status">Your selected device disconnected. Open Devices to choose another.</div>}
      <div hidden={tab !== 'library'}><Library selected={selected} disconnected={selectedDisconnected} onChooseDevice={() => { setReturnToLibrary(true); setTab('devices'); }} onPlaying={startPlaying} /></div>
      {tab === 'playing' && (loading ? <div className="skeleton-stack"><div className="skeleton skeleton-art" /><div className="skeleton skeleton-line" /></div> : <>
        {(pendingPlay || playNotice) && <div className="notice" role="status">{pendingPlay ? `Jellyfin accepted ${pendingPlay.title}. Waiting for ${selected?.deviceName || 'the device'} to report playback…` : playNotice}</div>}
        <NowPlaying key={selectedId || 'none'} session={selected} updatedAt={sessionsUpdatedAt} unavailable={Boolean(error)} onRefresh={refresh} onChooseDevice={() => setTab('devices')} />
      </>)}
      {tab === 'devices' && (loading ? <div className="skeleton-stack"><div className="skeleton skeleton-line" /></div> : <><div className="device-summary"><Cast size={20} /><span>{sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}</span></div><DeviceList sessions={sessions} selectedId={selectedId} onSelect={select} /></>)}
    </main>
  </div>;
}
