import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JELLYFIN_URL ||= 'http://127.0.0.1:8096';
process.env.JELLYFIN_API_KEY ||= 'test-only-key';
test('normalizes only library fields and constrained artwork URLs', async () => {
  const { normalizeItem } = await import('../backend/src/jellyfin/library.js');
  const item = normalizeItem({ Id: '0123456789abcdef0123456789abcdef', Name: 'Pilot', Type: 'Episode', IndexNumber: 1, ParentIndexNumber: 2, RunTimeTicks: 600_000_000, ImageTags: { Primary: 'tag', Thumb: 'tag' }, UserData: { Played: false, PlaybackPositionTicks: 30_000_000 }, Overview: 'The start', Path: '/private/media/Pilot.mkv' } as Parameters<typeof normalizeItem>[0]);
  assert.equal(item.title, 'Pilot');
  assert.equal(item.episodeNumber, 1);
  assert.equal(item.parentSeasonNumber, 2);
  assert.equal(item.progressTicks, 30_000_000);
  assert.equal(item.posterUrl, '/api/images/0123456789abcdef0123456789abcdef/Primary');
  assert.equal(item.thumbUrl, '/api/images/0123456789abcdef0123456789abcdef/Thumb');
  assert.equal('Path' in item, false);
});
