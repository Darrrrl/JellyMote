import { useEffect, useRef, useState } from 'react';
import { Cast, ChevronRight, Music2, Pause, Play, SkipBack, SkipForward, Square, Volume2, VolumeX, RotateCcw, RotateCw } from 'lucide-react';
import { api, type PlaystateAction } from '../services/api';
import type { Playback, Session } from '../types/jellyfin';
import { formatSeconds, secondsToTicks, ticksToSeconds } from '../utils/time';
import { deviceDiagnostic } from '../utils/deviceCapabilities';

type Override = { sessionId: string; itemId: string | null; patch: Partial<Playback>; at: number };
interface Props { session: Session | null; updatedAt: number; unavailable: boolean; onRefresh: () => Promise<void>; onChooseDevice: () => void }

export function NowPlaying({ session, updatedAt, unavailable, onRefresh, onChooseDevice }: Props) {
  const playing = session?.playback;
  const [now, setNow] = useState(Date.now());
  const [override, setOverride] = useState<Override | null>(null);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seekDraftRef = useRef<number | null>(null);
  const volumeDraftRef = useRef<number | null>(null);
  const draggingSeek = useRef(false);
  const draggingVolume = useRef(false);
  const seekTimer = useRef<number | null>(null);
  const volumeTimer = useRef<number | null>(null);
  const sending = useRef(false);
  const currentTarget = useRef<{ id: string | null; available: boolean }>({ id: null, available: false });
  currentTarget.current = { id: session?.id || null, available: Boolean(session?.playback && session.isActive && !unavailable) };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!override || !playing || override.sessionId !== session?.id || override.itemId !== playing.itemId) return;
    const matches = Object.entries(override.patch).every(([key, value]) => {
      if (key === 'positionTicks') return Math.abs(playing.positionTicks - Number(value)) < secondsToTicks(2);
      return playing[key as keyof Playback] === value;
    });
    if (matches || Date.now() - override.at > 4000) setOverride(null);
  }, [updatedAt, session, playing, override, now]);

  useEffect(() => () => {
    if (seekTimer.current) window.clearTimeout(seekTimer.current);
    if (volumeTimer.current) window.clearTimeout(volumeTimer.current);
  }, []);

  const activeOverride = override && override.sessionId === session?.id && override.itemId === playing?.itemId ? override : null;
  const state = playing ? { ...playing, ...activeOverride?.patch } : null;
  const durationSeconds = state ? ticksToSeconds(state.durationTicks) : 0;
  const basePosition = state ? ticksToSeconds(state.positionTicks) : 0;
  const baseAt = activeOverride && ('positionTicks' in activeOverride.patch || 'isPaused' in activeOverride.patch) ? activeOverride.at : updatedAt;
  const positionSeconds = state ? Math.min(durationSeconds || Infinity, Math.max(0, basePosition + (state.isPaused ? 0 : Math.min(4, Math.max(0, now - baseAt) / 1000)))) : 0;
  const shownPosition = seekDraft ?? positionSeconds;
  const controlsDisabled = !session?.isActive || unavailable || busy !== null;
  const canSeek = !controlsDisabled && session?.canSeek === true && durationSeconds > 0;
  const canVolume = !controlsDisabled && session?.canSetVolume === true;
  const canMute = !controlsDisabled && session?.canMute === true;

  async function send(label: string, action: () => Promise<void>, patch?: Partial<Playback>) {
    if (!session || !playing || controlsDisabled || sending.current || currentTarget.current.id !== session.id || !currentTarget.current.available) return;
    sending.current = true;
    const target = session.id;
    const previous = override;
    setBusy(label);
    setError(null);
    if (patch) setOverride({
      sessionId: target,
      itemId: playing.itemId,
      patch: previous?.sessionId === target && previous.itemId === playing.itemId
        ? { ...previous.patch, ...(previous.patch.positionTicks !== undefined ? { positionTicks: secondsToTicks(positionSeconds) } : {}), ...patch }
        : patch,
      at: Date.now(),
    });
    try {
      await action();
      await onRefresh();
    } catch (cause) {
      setOverride(previous);
      setError(cause instanceof Error ? cause.message : 'The device rejected the command.');
    } finally { sending.current = false; setBusy(null); }
  }

  function playstate(command: PlaystateAction) {
    if (!session || !playing || controlsDisabled || !session.playstate[command]) return;
    const patch = command === 'pause' ? { isPaused: true, positionTicks: secondsToTicks(positionSeconds) }
      : command === 'play' ? { isPaused: false, positionTicks: secondsToTicks(positionSeconds) } : undefined;
    void send(command, () => api.playstate(session.id, command), patch);
  }

  function commitSeek(seconds: number | null) {
    if (seekTimer.current) window.clearTimeout(seekTimer.current);
    seekTimer.current = null;
    draggingSeek.current = false;
    seekDraftRef.current = null;
    setSeekDraft(null);
    if (!session || !canSeek || seconds === null) return;
    const bounded = Math.max(0, Math.min(durationSeconds, seconds));
    if (Math.abs(bounded - positionSeconds) < 1) return;
    void send('seek', () => api.seek(session.id, secondsToTicks(bounded)), { positionTicks: secondsToTicks(bounded) });
  }

  function updateSeek(value: number) {
    seekDraftRef.current = value;
    setSeekDraft(value);
    if (!draggingSeek.current) {
      if (seekTimer.current) window.clearTimeout(seekTimer.current);
      seekTimer.current = window.setTimeout(() => commitSeek(seekDraftRef.current), 500);
    }
  }

  function skip(seconds: number) {
    if (!canSeek) return;
    commitSeek(Math.max(0, Math.min(durationSeconds, positionSeconds + seconds)));
  }

  function commitVolume(value: number | null) {
    if (volumeTimer.current) window.clearTimeout(volumeTimer.current);
    volumeTimer.current = null;
    draggingVolume.current = false;
    volumeDraftRef.current = null;
    setVolumeDraft(null);
    if (!session || !canVolume || value === null || value === state?.volume) return;
    void send('volume', () => api.volume(session.id, value), { volume: value });
  }

  function updateVolume(value: number) {
    volumeDraftRef.current = value;
    setVolumeDraft(value);
    if (!draggingVolume.current) {
      if (volumeTimer.current) window.clearTimeout(volumeTimer.current);
      volumeTimer.current = window.setTimeout(() => commitVolume(volumeDraftRef.current), 500);
    }
  }

  if (!session) return <div className="empty-hero"><Cast size={35} /><h2>Choose a device</h2><p>Select an active Jellyfin session to see what’s playing.</p></div>;
  if (!state) return <div className="empty-hero"><Music2 size={35} /><h2>Ready when you are</h2><p>Nothing is playing on {session.deviceName} right now.</p>{!session.canStartPlayback && <p>{session.isActive ? "This Jellyfin client isn't advertising remote playback control." : deviceDiagnostic(session)}</p>}</div>;

  const episodeParts = state.type === 'Episode' ? state.subtitle?.split(' · ') || [] : [];
  const mediaTitle = episodeParts.length >= 3 ? episodeParts.slice(2).join(' · ') : state.title;
  const mediaKicker = episodeParts.length >= 3 ? `${state.title} · ${episodeParts[0]} ${episodeParts[1]}` : state.type === 'Movie' ? 'Movie' : state.type || 'Now Playing';

  return <div className="now-card">
    <div className="artwork-wrap">{state.imageUrl ? <img className="artwork" src={state.imageUrl} alt="" /> : <div className="artwork fallback"><Music2 size={80} strokeWidth={1} /></div>}</div>
    <div className="now-details"><div className="playing-info"><div className="eyebrow"><span className="live-dot" /> {mediaKicker}</div><h2>{mediaTitle}</h2>{episodeParts.length < 3 && state.subtitle && <p>{state.subtitle}</p>}</div>
    <div className="transport">
      <input className="seek-slider" type="range" min={0} max={Math.max(1, Math.floor(durationSeconds))} step={1} value={Math.min(Math.floor(durationSeconds || 1), Math.round(shownPosition))} style={{ '--progress': `${durationSeconds ? (shownPosition / durationSeconds) * 100 : 0}%` } as React.CSSProperties} aria-label="Seek position" disabled={!canSeek} onPointerDown={() => { draggingSeek.current = true; }} onPointerUp={() => commitSeek(seekDraftRef.current)} onPointerCancel={() => { draggingSeek.current = false; seekDraftRef.current = null; setSeekDraft(null); }} onChange={event => updateSeek(Number(event.target.value))} onKeyUp={() => commitSeek(seekDraftRef.current)} />
      <div className="time-row"><span>{formatSeconds(shownPosition)}</span><span>{formatSeconds(durationSeconds)}</span></div>
      <div className="control-row"><button type="button" className="control-button" title="Previous" aria-label="Previous" disabled={controlsDisabled || !session.playstate.previous} onClick={() => playstate('previous')}><SkipBack size={22} fill="currentColor" /></button><button type="button" className="control-button" title="Back 10 seconds" aria-label="Back 10 seconds" disabled={!canSeek} onClick={() => skip(-10)}><RotateCcw size={24} /><span className="skip-label">10</span></button><button type="button" className="control-button primary-control" title={state.isPaused ? 'Play' : 'Pause'} aria-label={state.isPaused ? 'Play' : 'Pause'} disabled={controlsDisabled || !session.playstate[state.isPaused ? 'play' : 'pause']} onClick={() => playstate(state.isPaused ? 'play' : 'pause')}>{state.isPaused ? <Play size={30} fill="currentColor" /> : <Pause size={30} fill="currentColor" />}</button><button type="button" className="control-button" title="Forward 10 seconds" aria-label="Forward 10 seconds" disabled={!canSeek} onClick={() => skip(10)}><RotateCw size={24} /><span className="skip-label">10</span></button><button type="button" className="control-button" title="Next" aria-label="Next" disabled={controlsDisabled || !session.playstate.next} onClick={() => playstate('next')}><SkipForward size={22} fill="currentColor" /></button></div>
      <div className="secondary-controls"><div className="volume-controls glass"><button type="button" className="small-control" title={state.isMuted ? 'Unmute' : 'Mute'} aria-label={state.isMuted ? 'Unmute' : 'Mute'} disabled={!canMute} onClick={() => { if (session) void send('mute', () => api.mute(session.id, !state.isMuted), { isMuted: !state.isMuted }); }}>{state.isMuted || (volumeDraft ?? state.volume) === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}</button><input className="volume-slider" type="range" min={0} max={100} step={1} value={volumeDraft ?? state.volume ?? 50} aria-label="Volume" disabled={!canVolume} onPointerDown={() => { draggingVolume.current = true; }} onPointerUp={() => commitVolume(volumeDraftRef.current)} onPointerCancel={() => { draggingVolume.current = false; volumeDraftRef.current = null; setVolumeDraft(null); }} onChange={event => updateVolume(Number(event.target.value))} onKeyUp={() => commitVolume(volumeDraftRef.current)} /><span className="volume-value">{volumeDraft ?? state.volume ?? '—'}{state.volume !== null ? '%' : ''}</span></div><button type="button" className="stop-button" disabled={controlsDisabled || !session.playstate.stop} onClick={() => playstate('stop')}><Square size={14} fill="currentColor" /> Stop</button></div>
      <button className="playing-target glass" type="button" onClick={onChooseDevice} aria-label={`Change playback device, currently ${session.deviceName}`}><Cast size={19} /><span><small>Playing on</small><strong>{session.deviceName}</strong></span><ChevronRight size={18} /></button>
      <div className="control-feedback" aria-live="polite">{error ? <span className="command-error">{error}</span> : busy ? <span>Sending {busy}…</span> : unavailable ? <span>Jellyfin is unavailable</span> : !session.canControl ? <span>{deviceDiagnostic(session)}</span> : null}</div>
    </div></div>
  </div>;
}
