import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JELLYFIN_URL ||= 'http://127.0.0.1:8096';
process.env.JELLYFIN_API_KEY ||= 'test-only-key';

test('all Jellyfin request paths send MediaBrowser authorization without legacy token headers', async () => {
  const { config } = await import('../backend/src/config/index.js');
  const { jellyfin } = await import('../backend/src/jellyfin/client.js');
  const { getImage } = await import('../backend/src/jellyfin/client.js');
  const { library } = await import('../backend/src/jellyfin/library.js');
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), `MediaBrowser Token="${config.apiKey}"`);
    assert.equal(headers.has('X-Emby-Token'), false);
    assert.equal(headers.has('X-MediaBrowser-Token'), false);
    paths.push(`${init?.method || 'GET'} ${url.pathname}`);
    if (url.pathname === '/System/Info') return Response.json({ ServerName: 'Jellyfin' });
    if (url.pathname === '/Sessions') return Response.json([]);
    if (url.pathname === '/Users') return Response.json([{ Id: 'user', Name: 'User' }]);
    if (url.pathname === '/Users/user/Views') return Response.json({ Items: [] });
    if (url.pathname.endsWith('/Command')) {
      assert.equal(headers.get('Content-Type'), 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body)), { Name: 'SetVolume', Arguments: { Volume: '30' } });
    }
    if (url.pathname.includes('/Images/')) return new Response('image', { headers: { 'Content-Type': 'image/png' } });
    return new Response(null, { status: 204 });
  };
  try {
    assert.equal((await jellyfin.server()).ServerName, 'Jellyfin');
    assert.deepEqual(await jellyfin.sessions(), []);
    await jellyfin.playItems('session', ['item'], 'PlayNow');
    await jellyfin.sendPlaystate('session', 'Pause');
    await jellyfin.sendGeneral('session', 'SetVolume', { Volume: '30' });
    assert.equal((await getImage('item', 'Primary')).status, 200);
    assert.equal((await library.home()).userName, 'User');
    assert.deepEqual(paths, [
      'GET /System/Info', 'GET /Sessions', 'POST /Sessions/session/Playing',
      'POST /Sessions/session/Playing/Pause', 'POST /Sessions/session/Command',
      'GET /Items/item/Images/Primary', 'GET /Users', 'GET /Users/user/Views',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Jellyfin request error handling remains unchanged', async () => {
  const { jellyfin, JellyfinError } = await import('../backend/src/jellyfin/client.js');
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(jellyfin.server(), (error: unknown) => error instanceof JellyfinError && error.status === 502 && error.message === 'Jellyfin rejected the configured API key.');
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(jellyfin.sendPlaystate('session', 'Pause'), (error: unknown) => error instanceof JellyfinError && error.status === 404 && error.message === 'The selected device is no longer connected.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
