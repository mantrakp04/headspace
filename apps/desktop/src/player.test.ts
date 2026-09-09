import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { tracks, type JsonValue } from '@headspace/spotify';
import {
  playSelection,
  playbackCommand,
  disconnectPlayer,
  readPlayback,
} from './player.ts';

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
const listeners = new Map<string, (data: JsonValue) => void>();
let repeat = 0;
let shuffle = false;
let active = false;
const sdkCalls: string[] = [];
class SpotifyPlayerFixture {
  addListener(name: string, callback: (data: JsonValue) => void) {
    listeners.set(name, callback);
  }
  async connect() {
    listeners.get('ready')?.({ device_id: 'headspace-device' });
    return true;
  }
  disconnect() {}
  async activateElement() {
    sdkCalls.push('activate');
  }
  async getCurrentState() {
    return active
      ? {
          repeat_mode: repeat,
          shuffle,
          paused: false,
          track_window: {
            current_track: { uri: 'spotify:track:one', name: 'One' },
          },
        }
      : null;
  }
  async getVolume() {
    return 0.5;
  }
  async setVolume() {}
  async pause() {
    sdkCalls.push('pause');
  }
  async resume() {
    sdkCalls.push('resume');
  }
  async togglePlay() {
    sdkCalls.push('toggle');
  }
  async seek() {
    sdkCalls.push('seek');
  }
  async previousTrack() {
    sdkCalls.push('previous');
  }
  async nextTrack() {
    sdkCalls.push('next');
  }
}
const original = new Map<string, PropertyDescriptor | undefined>();
const requests: { url: URL; method: string; body: JsonValue }[] = [];
const items = tracks(
  ['one', 'two', 'three'].map((name) => ({
    name,
    uri: `spotify:track:${name}`,
  })),
);

beforeEach(() => {
  repeat = 0;
  shuffle = false;
  active = false;
  sdkCalls.length = 0;
  requests.length = 0;
  listeners.clear();
  const session = new MemoryStorage();
  session.setItem(
    'sunroom.spotify.session',
    JSON.stringify({
      access: 'test-access',
      refresh: 'test-refresh',
      expires: Date.now() + 3600000,
    }),
  );
  const windowFixture = Object.assign(new EventTarget(), {
    Spotify: { Player: SpotifyPlayerFixture },
    setTimeout,
    clearTimeout,
    headspaceNative: { request: async () => null },
  });
  for (const [key, value] of Object.entries({
    window: windowFixture,
    sessionStorage: session,
    localStorage: new MemoryStorage(),
  })) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
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
      if (url.pathname.endsWith('/play')) active = true;
      if (url.pathname.endsWith('/repeat'))
        repeat =
          url.searchParams.get('state') === 'context'
            ? 1
            : url.searchParams.get('state') === 'track'
              ? 2
              : 0;
      if (url.pathname.endsWith('/shuffle'))
        shuffle = url.searchParams.get('state') === 'true';
      return new Response(null, { status: 204 });
    },
  );
});
afterEach(() => {
  disconnectPlayer();
  mock.restoreAll();
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  original.clear();
});

void test('native album/playlist rows and collection Play send context to the embedded device', async () => {
  await playSelection({
    kind: 'context',
    uri: 'spotify:album:example',
    track: items[1],
  });
  assert.deepEqual(requests[0].body, {
    context_uri: 'spotify:album:example',
    offset: { position: 1 },
    position_ms: 0,
  });
  assert.equal(
    requests[0].url.searchParams.get('device_id'),
    'headspace-device',
  );
  await playSelection({ kind: 'context', uri: 'spotify:playlist:example' });
  assert.deepEqual(requests[1].body, {
    context_uri: 'spotify:playlist:example',
    position_ms: 0,
  });
});

void test('native song-list playback supplies following songs and transport does not replace the context', async () => {
  await playSelection({ kind: 'tracks', items, index: 1, next: null });
  assert.deepEqual(requests[0].body, {
    uris: items.map((t) => t.uri),
    offset: { position: 1 },
    position_ms: 0,
  });
  await playbackCommand('pause');
  await playbackCommand('play');
  await playbackCommand('next');
  await playbackCommand('previous');
  assert.equal(requests.length, 1);
  assert.ok(sdkCalls.includes('next'));
  assert.ok(sdkCalls.includes('resume'));
});

void test('manual queue additions target Headspace and leave the existing playback source intact', async () => {
  await playSelection({
    kind: 'context',
    uri: 'spotify:album:example',
    track: items[0],
  });
  await playbackCommand('enqueue', { uri: items[2].uri });
  assert.equal(requests[1].method, 'POST');
  assert.equal(requests[1].url.pathname, '/v1/me/player/queue');
  assert.equal(
    requests[1].url.searchParams.get('device_id'),
    'headspace-device',
  );
  assert.equal(requests[1].url.searchParams.get('uri'), items[2].uri);
  assert.equal(
    requests.filter((r) => r.url.pathname.endsWith('/play')).length,
    1,
  );
});

void test('repeat cycles off, all, one, off and shuffle reflects the SDK state', async () => {
  await playSelection({ kind: 'tracks', items, index: 0, next: null });
  for (const expected of ['context', 'track', 'off']) {
    await playbackCommand('repeat');
    assert.equal((await readPlayback()).repeat, expected);
  }
  await playbackCommand('shuffle');
  assert.equal((await readPlayback()).shuffle, true);
  await playbackCommand('shuffle');
  assert.equal((await readPlayback()).shuffle, false);
});

void test('SDK track transitions notify the live queue and playback view', async () => {
  await playSelection({ kind: 'tracks', items, index: 0, next: null });
  let events = 0;
  window.addEventListener('headspace-playback-changed', () => {
    events += 1;
  });
  listeners.get('player_state_changed')?.({ paused: false });
  assert.equal(events, 1);
});

void test('enqueue without Headspace playback cannot accidentally modify another device queue', async () => {
  await assert.rejects(
    playbackCommand('enqueue', { uri: items[0].uri }),
    /Play a song in Headspace/,
  );
  assert.equal(requests.length, 0);
});
