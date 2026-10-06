import { Router, json } from 'express';
import { getImage, jellyfin, JellyfinError } from '../jellyfin/client.js';
import { library } from '../jellyfin/library.js';
import { remote } from '../jellyfin/remote.js';
import { isBoolean, isItemId, isItemIds, isPlayCommand, isPlaystateAction, isPositionTicks, isSessionId, isVolume } from '../jellyfin/validation.js';

export const api = Router();

api.get('/server', async (_req, res) => {
  try {
    const info = await jellyfin.server();
    res.json({ name: info.ServerName || 'Jellyfin', version: info.Version || null, id: info.Id || null });
  } catch (error) { sendError(res, error); }
});

api.get('/sessions', async (_req, res) => {
  try { res.json(await jellyfin.sessions()); }
  catch (error) { sendError(res, error); }
});

api.get('/libraries', async (_req, res) => { try { res.json(await library.home()); } catch (error) { sendError(res, error); } });
api.get('/library/movies', async (_req, res) => { try { res.json(await library.list('Movie')); } catch (error) { sendError(res, error); } });
api.get('/library/shows', async (_req, res) => { try { res.json(await library.list('Series')); } catch (error) { sendError(res, error); } });
api.get('/movies/:id', async (req, res) => {
  if (!isItemId(req.params.id)) { res.status(400).json({ error: 'Invalid item ID.' }); return; }
  try { res.json(await library.details(req.params.id, 'Movie')); } catch (error) { sendError(res, error); }
});
api.get('/shows/:id', async (req, res) => {
  if (!isItemId(req.params.id)) { res.status(400).json({ error: 'Invalid item ID.' }); return; }
  try { res.json(await library.details(req.params.id, 'Series')); } catch (error) { sendError(res, error); }
});
api.get('/shows/:id/seasons', async (req, res) => {
  if (!isItemId(req.params.id)) { res.status(400).json({ error: 'Invalid show ID.' }); return; }
  try { res.json(await library.seasons(req.params.id)); } catch (error) { sendError(res, error); }
});
api.get('/seasons/:id/episodes', async (req, res) => {
  if (!isItemId(req.params.id)) { res.status(400).json({ error: 'Invalid season ID.' }); return; }
  try { res.json(await library.episodes(req.params.id)); } catch (error) { sendError(res, error); }
});

api.use(json({ limit: '8kb' }));

api.post('/sessions/:sessionId/play', async (req, res) => {
  if (!isSessionId(req.params.sessionId) || !isItemIds(req.body?.itemIds) || !isPlayCommand(req.body?.command)) {
    res.status(400).json({ error: 'Provide a valid session ID, nonempty item IDs, and PlayNow command.' }); return;
  }
  try { await remote.playItems(req.params.sessionId, req.body.itemIds, req.body.command); res.status(204).end(); }
  catch (error) { sendError(res, error, 'play', req.params.sessionId); }
});

api.post('/sessions/:sessionId/playstate', async (req, res) => {
  if (!isSessionId(req.params.sessionId) || !isPlaystateAction(req.body?.command)) {
    res.status(400).json({ error: 'Provide a valid session ID and playstate command.' }); return;
  }
  try { await remote.playstate(req.params.sessionId, req.body.command); res.status(204).end(); }
  catch (error) { sendError(res, error, 'playstate', req.params.sessionId); }
});

api.post('/sessions/:sessionId/seek', async (req, res) => {
  if (!isSessionId(req.params.sessionId) || !isPositionTicks(req.body?.positionTicks)) {
    res.status(400).json({ error: 'Provide a valid session ID and non-negative integer positionTicks.' }); return;
  }
  try { await remote.seek(req.params.sessionId, req.body.positionTicks); res.status(204).end(); }
  catch (error) { sendError(res, error, 'seek', req.params.sessionId); }
});

api.post('/sessions/:sessionId/volume', async (req, res) => {
  if (!isSessionId(req.params.sessionId) || !isVolume(req.body?.volume)) {
    res.status(400).json({ error: 'Provide a valid session ID and an integer volume from 0 to 100.' }); return;
  }
  try { await remote.volume(req.params.sessionId, req.body.volume); res.status(204).end(); }
  catch (error) { sendError(res, error, 'volume', req.params.sessionId); }
});

api.post('/sessions/:sessionId/mute', async (req, res) => {
  if (!isSessionId(req.params.sessionId) || !isBoolean(req.body?.muted)) {
    res.status(400).json({ error: 'Provide a valid session ID and boolean muted value.' }); return;
  }
  try { await remote.mute(req.params.sessionId, req.body.muted); res.status(204).end(); }
  catch (error) { sendError(res, error, 'mute', req.params.sessionId); }
});

api.get('/images/:id/:type', async (req, res) => {
  if (!isItemId(req.params.id)) {
    res.status(400).json({ error: 'Invalid item ID.' }); return;
  }
  if (!['Primary', 'Thumb', 'Backdrop'].includes(req.params.type)) { res.status(400).json({ error: 'Unsupported image type.' }); return; }
  try {
    const image = await getImage(req.params.id, req.params.type as 'Primary' | 'Thumb' | 'Backdrop');
    if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) {
      res.status(404).end(); return;
    }
    res.setHeader('Content-Type', image.headers.get('content-type')!);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(Buffer.from(await image.arrayBuffer()));
  } catch (error) { sendError(res, error); }
});

api.use((error: unknown, _req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: 'Malformed JSON request body.' }); return;
  }
  next(error);
});

function sendError(res: import('express').Response, error: unknown, action?: string, sessionId?: string) {
  const known = error instanceof JellyfinError ? error : new JellyfinError(500, 'An unexpected server error occurred.');
  if (action) console.warn(`Remote ${action} failed for session ${sessionId}: ${known.message}`);
  res.status(known.status).json({ error: known.message });
}
