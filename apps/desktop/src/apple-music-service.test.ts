import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { songs } from '@headspace/apple-music';
import type {
  MediaItem,
  PlaybackQueue,
  QueueOptions,
} from '@headspace/apple-music/musickit';
import type { Collection, JsonValue } from '@headspace/spotify';
import {
  appleMusicService,
  resetAppleMusic,
  tokenURL,
} from './apple-music-service.ts';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const calls: string[] = [];
let stopFails = false;
const queues: QueueOptions[] = [];
const later: QueueOptions[] = [];
const listeners = new Map<string, () => void>();
let configuredToken = '';

class MusicKitFixture {
  isAuthorized = false;
  musicUserToken = '';
  developerToken = '';
  storefrontId = 'gb';
  isPlaying = false;
  currentPlaybackTime = 0;
  currentPlaybackDuration = 0;
  nowPlayingItem: MediaItem | undefined = undefined;
  queue: PlaybackQueue = { items: [], position: -1 };
  volume = 1;
  shuffleMode = 0;
  repeatMode = 0;
  async authorize() {
    this.isAuthorized = true;
    this.musicUserToken = 'user-token';
    return this.musicUserToken;
  }
  async unauthorize() {
    this.isAuthorized = false;
  }
  async setQueue(options: QueueOptions) {
    queues.push(options);
    return null;
  }
  async playLater(options: QueueOptions) {
    later.push(options);
  }
  async play() {
    calls.push('play');
    this.isPlaying = true;
  }
  async pause() {
    calls.push('pause');
    this.isPlaying = false;
  }
  async stop() {
    calls.push('stop');
    if (stopFails) throw new Error('stop failed');
  }
  async skipToNextItem() {
    calls.push('next');
  }
  async skipToPreviousItem() {
    calls.push('previous');
  }
  async seekToTime(seconds: number) {
    calls.push('seek ' + seconds);
  }
  addEventListener(name: string, callback: () => void) {
    listeners.set(name, callback);
  }
  removeEventListener(name: string) {
    listeners.delete(name);
  }
}

let instance: MusicKitFixture;
const original = new Map<string, PropertyDescriptor | undefined>();
const requests: { url: URL; method: string; body: JsonValue }[] = [];
let tokenStatus = 200;
let apiResponse: JsonValue = { data: [] };

function song(id: string): JsonValue {
  return {
    id,
    type: id.startsWith('i.') ? 'library-songs' : 'songs',
    attributes: {
      name: 'Song ' + id,
      artistName: 'Artist',
      albumName: 'Album',
      durationInMillis: 200000,
      playParams: { id, kind: 'song' },
    },
  };
}

beforeEach(() => {
  calls.length = 0;
  stopFails = false;
  queues.length = 0;
  later.length = 0;
  requests.length = 0;
  listeners.clear();
  tokenStatus = 200;
  apiResponse = { data: [] };
  instance = new MusicKitFixture();
  const windowFixture = Object.assign(new EventTarget(), {
    setTimeout,
    clearTimeout,
    MusicKit: {
      async configure(options: { developerToken: string }) {
        configuredToken = options.developerToken;
        instance.developerToken = options.developerToken;
        return instance;
      },
      getInstance: () => instance,
    },
  });
  const storage = new MemoryStorage();
  storage.setItem('headspace.volume', '0.25');
  for (const [key, value] of Object.entries({
    window: windowFixture,
    localStorage: storage,
  })) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.href === tokenURL && tokenStatus === 0)
        throw new TypeError('Load failed');
      if (url.href === tokenURL)
        return tokenStatus === 200
          ? new Response(JSON.stringify({ token: 'developer-token' }))
          : new Response(JSON.stringify({ error: 'missing' }), {
              status: tokenStatus,
            });
      const body = init?.body;
      requests.push({
        url,
        method: init?.method ?? 'GET',
        body:
          body === undefined ||
          body === null ||
          body instanceof URLSearchParams ||
          body instanceof Blob ||
          body instanceof FormData ||
          body instanceof ArrayBuffer ||
          ArrayBuffer.isView(body) ||
          body instanceof ReadableStream
            ? null
            : JSON.parse(body),
      });
      return new Response(JSON.stringify(apiResponse), { status: 200 });
    },
  );
});

afterEach(() => {
  resetAppleMusic();
  mock.restoreAll();
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  original.clear();
});

async function connect() {
  assert.equal(await appleMusicService.restore(), false);
  assert.deepEqual(await appleMusicService.connect(), {
    connected: true,
    authURL: '',
  });
}

void test('sign-in configures MusicKit with the signed developer token', async () => {
  await connect();
  assert.equal(configuredToken, 'developer-token');
  assert.equal(instance.volume, 0.25);
  assert.equal(await appleMusicService.restore(), true);
  await appleMusicService.profile();
  assert.equal(
    requests[0].url.href,
    'https://api.music.apple.com/v1/me/library/playlists?limit=100',
  );
});

void test('a missing token key explains that Apple Music is not set up', async () => {
  tokenStatus = 503;
  await assert.rejects(appleMusicService.restore(), /not set up/);
});

void test('an unreachable token endpoint gets a readable error', async () => {
  tokenStatus = 0;
  await assert.rejects(
    appleMusicService.restore(),
    /could not reach Apple Music/,
  );
});

void test('library requests need an Apple Music sign-in', async () => {
  await assert.rejects(
    appleMusicService.library('liked', '', 'track', null),
    /Connect Apple Music/,
  );
});

void test('albums and playlists play as MusicKit containers starting at the chosen song', async () => {
  await connect();
  const [track] = songs([song('42')]);
  await appleMusicService.play({
    kind: 'context',
    uri: 'apple-music:albums:900',
    track,
  });
  await appleMusicService.play({
    kind: 'context',
    uri: 'apple-music:library-playlists:p.abc',
  });
  assert.deepEqual(queues, [
    { album: '900', startWith: '42', startPlaying: false },
    { playlist: 'p.abc', startWith: undefined, startPlaying: false },
  ]);
  assert.deepEqual(
    calls.filter((call) => call === 'play'),
    ['play', 'play'],
  );
  await assert.rejects(
    appleMusicService.play({ kind: 'context', uri: 'apple-music:artists:1' }),
    /album or playlist/,
  );
});

void test('song lists queue the following songs and start on the selection', async () => {
  await connect();
  const items = songs([song('1'), song('i.two'), song('3')]);
  apiResponse = { data: [song('4')] };
  await appleMusicService.play({
    kind: 'tracks',
    items,
    index: 1,
    next: '/v1/me/library/songs?offset=3',
  });
  assert.deepEqual(queues, [
    { songs: ['1', 'i.two', '3', '4'], startWith: 1, startPlaying: false },
  ]);
  assert.equal(requests[0].url.searchParams.get('offset'), '3');
});

void test('a repeated song in a playlist starts at the clicked row', async () => {
  await connect();
  const playlist: Collection = {
    id: 'pl.u-shared',
    uri: 'apple-music:playlists:pl.u-shared',
    name: 'Shared',
    subtitle: '',
    image: '',
    kind: 'playlist',
    url: '',
  };
  apiResponse = {
    data: [
      song('1'),
      { id: '9', type: 'songs', attributes: { name: 'Gone' } },
      song('2'),
      song('1'),
    ],
  };
  const page = await appleMusicService.library(
    'collection',
    '',
    'track',
    playlist,
  );
  assert.equal(page.context, playlist.uri);
  await appleMusicService.play({
    kind: 'context',
    uri: playlist.uri,
    track: page.songs[3],
  });
  assert.deepEqual(queues, [
    { playlist: 'pl.u-shared', startWith: 2, startPlaying: false },
  ]);
});

void test('switching services while a queue loads does not start Apple Music', async () => {
  await connect();
  const items = songs([song('1'), song('2')]);
  apiResponse = { data: [song('3')] };
  const playing = appleMusicService.play({
    kind: 'tracks',
    items,
    index: 0,
    next: '/v1/me/library/songs?offset=2',
  });
  appleMusicService.stop();
  await playing;
  assert.deepEqual(queues, []);
  assert.ok(!calls.includes('play'));
});

void test('transport, seek, volume, shuffle and repeat drive MusicKit', async () => {
  await connect();
  await appleMusicService.command('toggle');
  await appleMusicService.command('toggle');
  await appleMusicService.command('next');
  await appleMusicService.command('previous');
  await appleMusicService.command('seek', { value: 61 });
  await appleMusicService.command('stop');
  assert.deepEqual(calls, [
    'play',
    'pause',
    'next',
    'previous',
    'seek 61',
    'stop',
  ]);
  await appleMusicService.command('volume', { value: 80 });
  assert.equal(instance.volume, 0.8);
  assert.equal(localStorage.getItem('headspace.volume'), '0.8');
  for (const expected of ['context', 'track', 'off']) {
    await appleMusicService.command('repeat');
    assert.equal((await appleMusicService.readPlayback()).repeat, expected);
  }
  await appleMusicService.command('shuffle');
  assert.equal((await appleMusicService.readPlayback()).shuffle, true);
});

void test('queue additions need a playing song and use MusicKit’s queue', async () => {
  await connect();
  await assert.rejects(
    appleMusicService.command('enqueue', { uri: 'apple-music:songs:7' }),
    /Play a song in Headspace/,
  );
  instance.nowPlayingItem = { id: '1', type: 'songs', attributes: {} };
  await appleMusicService.command('enqueue', { uri: 'apple-music:songs:7' });
  assert.deepEqual(later, [{ songs: ['7'] }]);
  await assert.rejects(
    appleMusicService.command('enqueue', { uri: 'spotify:track:7' }),
    /Invalid track/,
  );
});

void test('now playing and the upcoming queue come from MusicKit', async () => {
  await connect();
  const now = {
    id: 'i.now',
    type: 'library-songs',
    attributes: {
      name: 'Now',
      artistName: 'Band',
      albumName: 'Record',
      durationInMillis: 1000,
    },
  };
  instance.nowPlayingItem = now;
  instance.isPlaying = true;
  instance.currentPlaybackTime = 12.5;
  instance.currentPlaybackDuration = 200;
  instance.queue = {
    items: [now, { id: '5', type: 'songs', attributes: { name: 'Next' } }],
    position: 0,
  };
  const playback = await appleMusicService.readPlayback();
  assert.equal(playback.uri, 'apple-music:library-songs:i.now');
  assert.equal(playback.name, 'Now');
  assert.equal(playback.position, 12500);
  assert.equal(playback.duration, 200000);
  assert.equal(playback.playing, true);
  const queue = await appleMusicService.queue();
  assert.equal(queue.current?.name, 'Now');
  assert.deepEqual(
    queue.items.map((t) => t.uri),
    ['apple-music:songs:5'],
  );
  let changes = 0;
  window.addEventListener('headspace-playback-changed', () => {
    changes += 1;
  });
  listeners.get('nowPlayingItemDidChange')?.();
  assert.equal(changes, 1);
});

void test('library pages use the storefront and keep song-list continuations', async () => {
  await connect();
  apiResponse = {
    data: [song('i.one')],
    next: '/v1/me/library/songs?offset=100',
  };
  const liked = await appleMusicService.library('liked', '', 'track', null);
  assert.equal(liked.continuation, '/v1/me/library/songs?offset=100');
  assert.equal(liked.next, '/v1/me/library/songs?offset=100');
  apiResponse = {
    results: {
      albums: {
        data: [{ id: '9', type: 'albums', attributes: { name: 'Record' } }],
      },
    },
  };
  const found = await appleMusicService.library(
    'search',
    'record',
    'album',
    null,
  );
  assert.equal(
    requests[1].url.pathname + requests[1].url.search,
    '/v1/catalog/gb/search?term=record&types=albums&limit=25',
  );
  assert.deepEqual(
    found.collections.map((c) => c.uri),
    ['apple-music:albums:9'],
  );
  const shows = await appleMusicService.library('search', 'x', 'show', null);
  assert.deepEqual(shows.songs, []);
  assert.equal(requests.length, 2);
});

void test('songs join the library, and only songs, albums and playlists can be saved', async () => {
  await connect();
  const [catalog, library] = songs([song('7'), song('i.mine')]);
  assert.equal(await appleMusicService.toggleSaved(catalog, false), true);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].url.searchParams.get('ids[songs]'), '7');
  await assert.rejects(
    appleMusicService.toggleSaved(library, true),
    /remove it in the Music app/,
  );
  await assert.rejects(
    appleMusicService.saveCollection({
      id: 'p.abc',
      uri: 'apple-music:library-playlists:p.abc',
      name: 'Mine',
      subtitle: '',
      image: '',
      kind: 'playlist',
      url: '',
    }),
    /already in your library/,
  );
});

void test('songs are added to editable library playlists by type', async () => {
  await connect();
  const [catalog] = songs([song('7')]);
  const playlist: Collection = {
    id: 'p.abc',
    uri: 'apple-music:library-playlists:p.abc',
    name: 'Mine',
    subtitle: '',
    image: '',
    kind: 'playlist',
    url: '',
  };
  await appleMusicService.addToPlaylist(playlist, catalog);
  assert.equal(
    requests[0].url.pathname,
    '/v1/me/library/playlists/p.abc/tracks',
  );
  assert.deepEqual(requests[0].body, { data: [{ id: '7', type: 'songs' }] });
  const [library] = songs([song('i.8')]);
  await appleMusicService.addToPlaylist(playlist, library);
  assert.deepEqual(requests[1].body, {
    data: [{ id: 'i.8', type: 'library-songs' }],
  });
  await assert.rejects(
    appleMusicService.addToPlaylist(
      { ...playlist, uri: 'apple-music:playlists:pl.x' },
      catalog,
    ),
    /your own playlists/,
  );
});

void test('signing out still happens when playback cannot stop', async () => {
  await connect();
  stopFails = true;
  await appleMusicService.disconnect();
  assert.equal(await appleMusicService.restore(), false);
});
