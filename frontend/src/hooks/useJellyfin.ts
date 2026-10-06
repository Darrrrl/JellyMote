import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { ServerInfo, Session } from '../types/jellyfin';

export function useJellyfin() {
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionsUpdatedAt, setSessionsUpdatedAt] = useState(Date.now());
  const active = useRef(false);
  const pending = useRef(false);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const [serverInfo, sessionList] = await Promise.all([api.server(), api.sessions()]);
      if (!active.current) return;
      setServer(serverInfo);
      setSessions(sessionList);
      setSessionsUpdatedAt(Date.now());
      setError(null);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Could not reach Jellyfin.');
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 4000);
    return () => { active.current = false; window.clearInterval(timer); };
  }, [refresh]);

  return { server, sessions, loading, error, sessionsUpdatedAt, refresh };
}
