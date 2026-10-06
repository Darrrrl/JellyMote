import { Cast, CircleOff, Headphones, MonitorPlay } from 'lucide-react';
import type { Session } from '../types/jellyfin';
import { deviceDiagnostic } from '../utils/deviceCapabilities';

interface Props { sessions: Session[]; selectedId: string | null; onSelect: (id: string) => void }

export function DeviceList({ sessions, selectedId, onSelect }: Props) {
  if (!sessions.length) return <div className="empty-block"><CircleOff size={27} /><h3>No active devices</h3><p>Open Jellyfin on a TV, browser, or player. Active sessions will appear here.</p></div>;
  return <div className="device-list">{sessions.map(session => <button
    className={`device-card ${selectedId === session.id ? 'selected' : ''}`}
    key={session.id} onClick={() => onSelect(session.id)} type="button"
    aria-pressed={selectedId === session.id}
    title={deviceDiagnostic(session)}
  >
    <span className="device-icon">{session.playback?.type === 'Audio' ? <Headphones size={23} /> : <MonitorPlay size={23} />}</span>
    <span className="device-main"><strong>{session.deviceName}</strong><small>{session.client} · {session.userName}</small><span className="device-media">{session.playback ? `${session.playback.isPaused ? 'Paused' : 'Playing'} · ${session.playback.title}` : 'Nothing playing'}</span></span>
    <span className="device-end">{selectedId === session.id ? <Cast size={19} /> : <span className="radio" />}<small>{session.canControl ? 'Controls available' : 'View only'}</small></span>
  </button>)}</div>;
}
