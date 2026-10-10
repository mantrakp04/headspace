import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import type { JsonValue } from '@headspace/spotify';
import {
  AppleMusicError,
  collectionPath,
  collectionRef,
  collections,
  editablePlaylists,
  nextPath,
  pageOffset,
  parseCollection,
  parseSong,
  queueAfter,
  queueBefore,
  resolveSongQueue,
  request,
  searchPath,
  songs,
  trackID,
  trackURI,
} from './apple-music.ts';
import { readDeveloperKey, signDeveloperToken } from './developer-token.ts';

const credentials = { developer: 'developer-token', user: 'user-token' };

afterEach(() => mock.restoreAll());

function song(id: string, type = 'songs', playable = true): JsonValue {
  const attributes = {
    name: 'Song ' + id,
    artistName: 'Artist',
    albumName: 'Album',
    durationInMillis: 180000,
    artwork: {
      url: 'https://is1-ssl.mzstatic.com/image/thumb/a/{w}x{h}bb.jpg',
    },
    url: 'https://music.apple.com/us/song/' + id,
  };
  return {
    id,
    type,
    attributes: playable
      ? { ...attributes, playParams: { id, kind: 'song' } }
      : attributes,
  };
}

void test('songs parse catalog and library items with list positions', () => {
  const parsed = songs(
    [song('100'), song('i.abc', 'library-songs'), { id: 'x' }],
    50,
  );
  assert.deepEqual(
    parsed.map((t) => [t.uri, t.contextPosition, t.playable]),
    [
      ['apple-music:songs:100', 50, true],
      ['apple-music:library-songs:i.abc', 51, true],
    ],
  );
  assert.equal(
    parsed[0].image,
    'https://is1-ssl.mzstatic.com/image/thumb/a/300x300bb.jpg',
  );
  assert.equal(parsed[0].duration, 180000);
});

void test('unavailable songs and music videos are not playable', () => {
  assert.equal(parseSong(song('1', 'songs', false))?.playable, false);
  const video = parseSong(song('2', 'music-videos'));
  assert.equal(video?.playable, false);
  assert.equal(video?.uri, 'apple-music:music-videos:2');
});

void test('untrusted artwork and links are dropped', () => {
  const parsed = parseSong({
    id: '1',
    type: 'songs',
    attributes: {
      name: 'One',
      artwork: { url: 'http://example.com/{w}x{h}.jpg' },
      url: 'https://example.com/song',
    },
  });
  assert.equal(parsed?.image, '');
  assert.equal(parsed?.url, '');
});

void test('collections keep library and catalog types in their URI', () => {
  const parsed = collections([
    {
      id: 'p.abc',
      type: 'library-playlists',
      attributes: { name: 'Mine', canEdit: true },
    },
    {
      id: 'pl.xyz',
      type: 'playlists',
      attributes: { name: 'Hits', curatorName: 'Apple Music' },
    },
    {
      id: '42',
      type: 'albums',
      attributes: { name: 'Record', artistName: 'Band' },
    },
    { id: 's', type: 'stations', attributes: { name: 'Radio' } },
  ]);
  assert.deepEqual(
    parsed.map((c) => [c.uri, c.kind, c.subtitle]),
    [
      ['apple-music:library-playlists:p.abc', 'playlist', 'Playlist'],
      ['apple-music:playlists:pl.xyz', 'playlist', 'Apple Music'],
      ['apple-music:albums:42', 'album', 'Band'],
    ],
  );
});

void test('only editable library playlists are offered for adding songs', () => {
  const items = [
    {
      id: 'p.one',
      type: 'library-playlists',
      attributes: { name: 'Mine', canEdit: true },
    },
    {
      id: 'p.two',
      type: 'library-playlists',
      attributes: { name: 'Shared', canEdit: false },
    },
    {
      id: 'pl.three',
      type: 'playlists',
      attributes: { name: 'Catalog', canEdit: true },
    },
  ];
  assert.deepEqual(
    editablePlaylists(items).map((c) => c.id),
    ['p.one'],
  );
});

void test('URIs round-trip to IDs and paths', () => {
  assert.equal(trackURI('123'), 'apple-music:songs:123');
  assert.equal(trackURI('i.abc'), 'apple-music:library-songs:i.abc');
  assert.equal(trackID('apple-music:library-songs:i.abc'), 'i.abc');
  assert.equal(trackID('spotify:track:abc'), null);
  const library = collectionRef('apple-music:library-playlists:p.abc');
  const catalog = collectionRef('apple-music:albums:42');
  assert.deepEqual(library, { type: 'playlists', library: true, id: 'p.abc' });
  assert.equal(collectionRef('apple-music:stations:1'), null);
  assert.equal(
    library && collectionPath(library, 'us'),
    '/v1/me/library/playlists/p.abc/tracks?limit=100',
  );
  assert.equal(
    catalog && collectionPath(catalog, 'gb'),
    '/v1/catalog/gb/albums/42/tracks?limit=100',
  );
  assert.equal(
    collectionPath({ type: 'artists', library: false, id: '9' }, 'us'),
    '/v1/catalog/us/artists/9/albums?limit=25',
  );
  assert.equal(
    searchPath('us', 'daft punk', 'track'),
    '/v1/catalog/us/search?term=daft+punk&types=songs&limit=25',
  );
});

void test('pagination stays on the Apple Music API', () => {
  assert.equal(
    nextPath('/v1/me/library/songs?offset=100'),
    '/v1/me/library/songs?offset=100',
  );
  assert.equal(nextPath('https://evil.example/v1/me'), null);
  assert.equal(nextPath('//evil.example/v1/me'), null);
  assert.equal(nextPath(null), null);
  assert.equal(pageOffset('/v1/me/library/songs?offset=100'), 100);
  assert.equal(pageOffset(undefined), 0);
});

void test('requests send both tokens and JSON bodies', async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ data: [] }), { status: 201 });
  });
  await request(credentials, '/v1/me/library/playlists', 'POST', {
    attributes: { name: 'New' },
  });
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(
    calls[0].url,
    'https://api.music.apple.com/v1/me/library/playlists',
  );
  assert.equal(headers.get('Authorization'), 'Bearer developer-token');
  assert.equal(headers.get('Music-User-Token'), 'user-token');
  assert.equal(calls[0].init?.body, '{"attributes":{"name":"New"}}');
  await assert.rejects(request(credentials, '//evil.example/v1'), {
    message: 'Invalid Apple Music request.',
  });
});

void test('API errors explain subscription and service problems', async () => {
  mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({ errors: [{ title: 'Bad', detail: 'Bad term' }] }),
        { status: 400 },
      ),
  );
  await assert.rejects(request(credentials, '/v1/catalog/us/search'), {
    message: 'Bad term',
  });
  mock.restoreAll();
  mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 403 }),
  );
  await assert.rejects(
    request(credentials, '/v1/me/library/songs'),
    (error: Error) =>
      error instanceof AppleMusicError &&
      error.status === 403 &&
      error.message.includes('subscription'),
  );
});

void test('developer tokens are ES256 JWTs restricted to Headspace origins', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const key = readDeveloperKey({
    APPLE_MUSIC_TEAM_ID: 'ABCDE12345',
    APPLE_MUSIC_KEY_ID: 'KEY1234567',
    APPLE_MUSIC_PRIVATE_KEY: pem.replace(/\n/g, '\\n'),
  });
  assert.ok(key);
  const token = signDeveloperToken(key, ['http://127.0.0.1:4382'], 3600, 1000);
  const [header, payload, signature] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), {
    alg: 'ES256',
    kid: 'KEY1234567',
  });
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString()), {
    iss: 'ABCDE12345',
    iat: 1000,
    exp: 4600,
    origin: ['http://127.0.0.1:4382'],
  });
  assert.ok(
    verify(
      'sha256',
      Buffer.from(`${header}.${payload}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'base64url'),
    ),
  );
  assert.throws(() => signDeveloperToken(key, [], 60 * 60 * 24 * 365));
  assert.equal(readDeveloperKey({ APPLE_MUSIC_TEAM_ID: 'ABCDE12345' }), null);
});

void test('parseCollection rejects incomplete resources', () => {
  assert.equal(parseCollection({ id: '1', type: 'albums' }), null);
});

void test('song queues load following pages and start on the selected song', async () => {
  const first = songs([song('1'), song('2', 'songs', false), song('3')]);
  const loaded: string[] = [];
  const queue = await resolveSongQueue(
    first,
    2,
    '/v1/me/library/songs?offset=3',
    async (path) => {
      loaded.push(path);
      return { data: [song('4'), song('5')] };
    },
  );
  assert.deepEqual(loaded, ['/v1/me/library/songs?offset=3']);
  assert.deepEqual(queue, { songs: ['1', '3', '4', '5'], startWith: 1 });
  await assert.rejects(
    resolveSongQueue(first, 1, null, async () => null),
    /unavailable/,
  );
});

void test('long song lists are trimmed around the selected song', async () => {
  const many = songs(
    Array.from({ length: queueBefore + queueAfter + 100 }, (_, i) =>
      song(String(i)),
    ),
  );
  const index = queueBefore + 20;
  const queue = await resolveSongQueue(many, index, null, async () => null);
  assert.equal(queue.songs.length, queueBefore + queueAfter + 1);
  assert.equal(queue.songs[queue.startWith], String(index));
});

void test('unavailable songs do not count toward the queue', async () => {
  const items = songs([
    song('0'),
    ...Array.from({ length: queueAfter }, (_, i) =>
      song('gone' + i, 'songs', false),
    ),
  ]);
  const loaded: string[] = [];
  const queue = await resolveSongQueue(
    items,
    0,
    '/v1/me/library/songs?offset=251',
    async (path) => {
      loaded.push(path);
      return { data: [song('1')] };
    },
  );
  assert.deepEqual(loaded, ['/v1/me/library/songs?offset=251']);
  assert.deepEqual(queue, { songs: ['0', '1'], startWith: 0 });
});

void test('repeated pages stop song queue loading', async () => {
  await assert.rejects(
    resolveSongQueue(
      songs([song('1')]),
      0,
      '/v1/me/library/songs?offset=1',
      async () => ({ data: [], next: '/v1/me/library/songs?offset=1' }),
    ),
    /repeated page/,
  );
});
