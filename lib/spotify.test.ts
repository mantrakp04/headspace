import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
const original = new Map<string, PropertyDescriptor | undefined>();
let destination = '';
let location: {
  origin: string;
  pathname: string;
  search: string;
  assign: (url: string) => void;
};
let moduleNumber = 0;
async function fresh(): Promise<typeof import('./spotify.ts')> {
  return import(`./spotify.ts?test=${moduleNumber++}`);
}
function session(expires = Date.now() + 3600000) {
  sessionStorage.setItem(
    'sunroom.spotify.session',
    JSON.stringify({ access: 'test-access', refresh: 'test-refresh', expires }),
  );
  localStorage.setItem(
    'sunroom.spotify.client',
    '0123456789abcdef0123456789abcdef',
  );
}
function response(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), { status, headers });
}
const trackFixture = {
  id: 'sample',
  uri: 'spotify:track:sample',
  name: 'Sample song',
  duration_ms: 180000,
  artists: [{ name: 'Sample artist' }],
  album: {
    name: 'Sample album',
    images: [{ url: 'https://i.scdn.co/image/sample' }],
  },
  external_urls: { spotify: 'https://open.spotify.com/track/sample' },
  is_playable: true,
};
beforeEach(() => {
  destination = '';
  location = {
    origin: 'http://127.0.0.1:4382',
    pathname: '/',
    search: '',
    assign: (url) => {
      destination = url;
    },
  };
  for (const [key, value] of Object.entries({
    sessionStorage: new MemoryStorage(),
    localStorage: new MemoryStorage(),
    window: { location },
    history: {
      replaceState: () => {
        location.search = '';
      },
    },
  })) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected external network request');
  });
});
afterEach(() => {
  mock.restoreAll();
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  original.clear();
});

void test('PKCE sign-in returns through the same tab and stores only session tokens', async () => {
  const spotify = await fresh();
  await spotify.authorize('0123456789abcdef0123456789abcdef');
  const url = new URL(destination);
  assert.equal(url.origin, 'https://accounts.spotify.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  const pending = JSON.parse(
    sessionStorage.getItem('sunroom.spotify.pending') || '{}',
  );
  assert.equal(
    url.searchParams.get('code_challenge'),
    createHash('sha256').update(pending.verifier).digest('base64url'),
  );
  location.search = `?code=test-code&state=${pending.state}`;
  const network = mock.method(
    globalThis,
    'fetch',
    async (
      _url: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      assert.equal(
        new URLSearchParams(
          init?.body instanceof URLSearchParams ? init.body.toString() : '',
        ).get('code_verifier'),
        pending.verifier,
      );
      return response({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
    },
  );
  assert.equal(await spotify.finishAuthorization(), true);
  assert.equal(network.mock.callCount(), 1);
  assert.equal(await spotify.accessToken(), 'new-access');
  assert.equal(sessionStorage.getItem('sunroom.spotify.pending'), null);
  assert.equal(localStorage.getItem('sunroom.spotify.session'), null);
  assert.equal(location.search, '');
});
void test('forged OAuth state is rejected before any token exchange', async () => {
  const spotify = await fresh();
  await spotify.authorize('0123456789abcdef0123456789abcdef');
  location.search = '?code=test-code&state=wrong-state';
  await assert.rejects(spotify.finishAuthorization(), /did not match/);
  assert.equal(spotify.hasSession(), false);
});
void test('cancelled and expired sign-ins do not create a session', async () => {
  let spotify = await fresh();
  location.search = '?error=access_denied';
  await assert.rejects(spotify.finishAuthorization(), /cancelled/);
  spotify = await fresh();
  await spotify.authorize('0123456789abcdef0123456789abcdef');
  const pending = JSON.parse(
    sessionStorage.getItem('sunroom.spotify.pending') || '{}',
  );
  pending.created = Date.now() - 700000;
  sessionStorage.setItem('sunroom.spotify.pending', JSON.stringify(pending));
  location.search = '?code=test-code&state=' + pending.state;
  await assert.rejects(spotify.finishAuthorization(), /expired/);
});
void test('concurrent requests refresh an expired token once', async () => {
  const spotify = await fresh();
  session(0);
  const network = mock.method(globalThis, 'fetch', async () =>
    response({ access_token: 'refreshed', expires_in: 3600 }),
  );
  assert.deepEqual(
    await Promise.all([
      spotify.accessToken(),
      spotify.accessToken(),
      spotify.accessToken(),
    ]),
    ['refreshed', 'refreshed', 'refreshed'],
  );
  assert.equal(network.mock.callCount(), 1);
  assert.equal(
    JSON.parse(sessionStorage.getItem('sunroom.spotify.session') || '{}')
      .refresh,
    'test-refresh',
  );
});
void test('disconnect cannot be undone by an in-flight refresh', async () => {
  const spotify = await fresh();
  session(0);
  let release: (response: Response) => void = () => {
    throw new Error('Request not started');
  };
  mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const pending = spotify.accessToken();
  spotify.disconnect();
  release(
    response({
      access_token: 'late-access',
      refresh_token: 'late-refresh',
      expires_in: 3600,
    }),
  );
  await assert.rejects(pending, /disconnected/);
  assert.equal(spotify.hasSession(), false);
});
void test('expired access is retried once with a fresh token and GET has no request body', async () => {
  const spotify = await fresh();
  session();
  let count = 0;
  mock.method(
    globalThis,
    'fetch',
    async (
      url: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      if (typeof url === 'string' && url.includes('/api/token'))
        return response({ access_token: 'renewed', expires_in: 3600 });
      assert.equal(init?.body, undefined);
      count++;
      if (count === 1) return response({ error: { message: 'Expired' } }, 401);
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer renewed',
      );
      return response({ display_name: 'Listener' });
    },
  );
  assert.deepEqual(await spotify.api('/me'), { display_name: 'Listener' });
  assert.equal(count, 2);
});
void test('quota errors back off instead of repeatedly sending requests', async () => {
  const spotify = await fresh();
  session();
  const network = mock.method(globalThis, 'fetch', async () =>
    response({ error: { reason: 'QUOTA_EXCEEDED' } }, 429, {
      'Retry-After': '60',
    }),
  );
  await assert.rejects(spotify.api('/me'), /quota/);
  await assert.rejects(spotify.api('/me'), /limiting requests/);
  assert.equal(network.mock.callCount(), 1);
});
void test('playback commands support empty responses and descriptive permission errors', async () => {
  const spotify = await fresh();
  session();
  mock.method(
    globalThis,
    'fetch',
    async (
      _url: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      assert.equal(init?.method, 'PUT');
      assert.deepEqual(
        JSON.parse(typeof init?.body === 'string' ? init.body : 'null'),
        {
          uris: [trackFixture.uri],
        },
      );
      return new Response(null, { status: 204 });
    },
  );
  assert.equal(
    await spotify.api('/me/player/play', 'PUT', { uris: [trackFixture.uri] }),
    null,
  );
  mock.method(globalThis, 'fetch', async () =>
    response({ error: { message: 'Forbidden' } }, 403),
  );
  await assert.rejects(
    spotify.api('/me/library?uris=spotify:track:sample', 'PUT'),
    /Premium subscription/,
  );
});
void test('catalog parsing accepts current and legacy playlist fields and unavailable items', async () => {
  const spotify = await fresh();
  const parsed = spotify.tracks([
    { item: trackFixture },
    { track: { ...trackFixture, is_playable: false } },
    { item: null },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].artist, 'Sample artist');
  assert.equal(parsed[1].playable, false);
  assert.equal(spotify.parsePlayback(null).track, null);
  assert.equal(
    spotify.parsePlayback({
      item: trackFixture,
      is_playing: true,
      progress_ms: 12000,
    }).playing,
    true,
  );
  assert.equal(spotify.pagePath('https://untrusted.example/v1/me'), null);
  assert.equal(
    spotify.pagePath('https://api.spotify.com/v1/me/tracks?offset=50'),
    '/me/tracks?offset=50',
  );
  assert.equal(spotify.formatTime(185000), '3:05');
});

void test('desktop authorization opens externally and exchanges the registered loopback callback', async () => {
  const spotify = await fresh();
  let external = '';
  await spotify.authorize('0123456789abcdef0123456789abcdef', {
    redirect: 'http://127.0.0.1:4382/callback',
    scope: 'user-library-read',
    open: (url) => {
      external = url;
    },
  });
  assert.equal(destination, '');
  const auth = new URL(external);
  assert.equal(
    auth.searchParams.get('redirect_uri'),
    'http://127.0.0.1:4382/callback',
  );
  assert.equal(auth.searchParams.get('scope'), 'user-library-read');
  location.search =
    '?code=desktop-code&state=' + auth.searchParams.get('state');
  mock.method(
    globalThis,
    'fetch',
    async (
      _url: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      assert.ok(init?.body instanceof URLSearchParams);
      assert.equal(
        init.body.get('redirect_uri'),
        'http://127.0.0.1:4382/callback',
      );
      assert.equal(init.body.get('code'), 'desktop-code');
      assert.equal(init.body.has('client_secret'), false);
      return response({
        access_token: 'desktop-access',
        refresh_token: 'desktop-refresh',
        expires_in: 3600,
      });
    },
  );
  assert.equal(await spotify.finishAuthorization(), true);
  assert.equal(await spotify.accessToken(), 'desktop-access');
});

void test('a cancelled desktop sign-in can be retried in the same app process', async () => {
  const spotify = await fresh();
  location.search = '?error=access_denied';
  await assert.rejects(spotify.finishAuthorization(), /cancelled/);
  let external = '';
  await spotify.authorize('0123456789abcdef0123456789abcdef', {
    open: (url) => {
      external = url;
    },
  });
  location.search =
    '?code=retry&state=' + new URL(external).searchParams.get('state');
  mock.method(globalThis, 'fetch', async () =>
    response({
      access_token: 'retry-access',
      refresh_token: 'retry-refresh',
      expires_in: 3600,
    }),
  );
  assert.equal(await spotify.finishAuthorization(), true);
});
