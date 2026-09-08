import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlayback } from './playback-selection.ts';
import { tracks } from './spotify.ts';

const song = (id: string, playable = true) => ({
  uri: `spotify:track:${id}`,
  name: id,
  is_playable: playable,
  artists: [{ name: 'Example artist' }],
  duration_ms: 180000,
});
const noRequest = async () => {
  throw new Error('Context playback must not fetch track pages.');
};

void test('album and playlist selections keep the full Spotify context and exact duplicate occurrence', async () => {
  const items = tracks(
    [song('first'), { item: null }, song('duplicate'), song('duplicate')],
    50,
  );
  for (const kind of ['album', 'playlist']) {
    const body = await resolvePlayback(
      { kind: 'context', uri: `spotify:${kind}:example`, track: items[2] },
      noRequest,
    );
    assert.deepEqual(body, {
      context_uri: `spotify:${kind}:example`,
      offset: { position: 53 },
      position_ms: 0,
    });
  }
});

void test('collection Play accepts albums, playlists and artist contexts without a track URI', async () => {
  for (const kind of ['album', 'playlist', 'artist']) {
    assert.deepEqual(
      await resolvePlayback(
        { kind: 'context', uri: `spotify:${kind}:example` },
        noRequest,
      ),
      { context_uri: `spotify:${kind}:example`, position_ms: 0 },
    );
  }
});

void test('Liked Songs loads the rest of the library instead of stopping at the loaded page or 100 tracks', async () => {
  const items = tracks([
    song('first'),
    song('unavailable', false),
    song('selected'),
  ]);
  const paths: string[] = [];
  const body = await resolvePlayback(
    { kind: 'tracks', items, index: 2, next: '/me/tracks?offset=3' },
    async (path) => {
      paths.push(path);
      return paths.length === 1
        ? {
            items: Array.from({ length: 100 }, (_, i) => ({
              track: song(`next${i}`),
            })),
            next: 'https://api.spotify.com/v1/me/tracks?offset=103',
          }
        : { items: [{ track: song('last') }], next: null };
    },
  );
  assert.ok('uris' in body);
  assert.equal(body.uris.length, 103);
  assert.deepEqual(body.offset, { position: 1 });
  assert.equal(body.uris[1], 'spotify:track:selected');
  assert.equal(body.uris.at(-1), 'spotify:track:last');
  assert.deepEqual(paths, ['/me/tracks?offset=3', '/me/tracks?offset=103']);
});

void test('search and recent song lists retain duplicates and start at the clicked occurrence', async () => {
  const items = tracks([
    song('repeat'),
    song('unavailable', false),
    song('repeat'),
    song('following'),
  ]);
  const body = await resolvePlayback(
    { kind: 'tracks', items, index: 2, next: null },
    noRequest,
  );
  assert.deepEqual(body, {
    uris: [
      'spotify:track:repeat',
      'spotify:track:repeat',
      'spotify:track:following',
    ],
    offset: { position: 1 },
    position_ms: 0,
  });
});

void test('search pagination unwraps tracks and podcasts continue through the episode list', async () => {
  const body = await resolvePlayback(
    {
      kind: 'tracks',
      items: tracks([song('first')]),
      index: 0,
      next: '/search?offset=10',
    },
    async () => ({ tracks: { items: [song('second')], next: null } }),
  );
  assert.ok('uris' in body);
  assert.equal(body.uris[1], 'spotify:track:second');
  const episodes = tracks([
    { ...song('episode1'), uri: 'spotify:episode:one' },
    { ...song('episode2'), uri: 'spotify:episode:two' },
  ]);
  assert.deepEqual(
    await resolvePlayback(
      { kind: 'tracks', items: episodes, index: 0, next: null },
      noRequest,
    ),
    {
      uris: ['spotify:episode:one', 'spotify:episode:two'],
      offset: { position: 0 },
      position_ms: 0,
    },
  );
});

void test('unavailable selections and failed pagination never silently start a partial queue', async () => {
  await assert.rejects(
    resolvePlayback(
      {
        kind: 'tracks',
        items: tracks([song('blocked', false)]),
        index: 0,
        next: null,
      },
      noRequest,
    ),
    /unavailable/,
  );
  await assert.rejects(
    resolvePlayback(
      {
        kind: 'tracks',
        items: tracks([song('first')]),
        index: 0,
        next: '/me/tracks?offset=50',
      },
      async () => {
        throw new Error('Rate limited');
      },
    ),
    /Rate limited/,
  );
});
