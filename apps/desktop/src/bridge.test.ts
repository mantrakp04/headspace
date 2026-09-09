import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import {
  completeSignIn,
  connectSpotify,
  initializeSession,
  native,
  persistSession,
} from './bridge.ts';

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
const sessionKey = 'sunroom.spotify.session';
const session = JSON.stringify({
  access: 'test-access',
  refresh: 'test-refresh',
  expires: Date.now() + 3600000,
});

beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: { location: { search: '', origin: 'http://127.0.0.1:4383' } },
    configurable: true,
  });
});
afterEach(() => mock.restoreAll());

void test('browser initialization and token persistence work without a native bridge', async () => {
  sessionStorage.setItem(sessionKey, session);
  assert.equal(await initializeSession(), true);
  await persistSession();
  assert.equal(sessionStorage.getItem(sessionKey), session);
  await assert.rejects(
    native('minimize'),
    /requires the Headspace desktop app/,
  );
});

void test('native initialization restores Keychain data and persists a refreshed session', async () => {
  const calls: string[] = [];
  window.headspaceNative = {
    async request(method, args) {
      calls.push(method);
      if (method === 'loadSession') return session;
      assert.equal(method, 'saveSession');
      assert.equal(args?.value, sessionStorage.getItem(sessionKey));
      return true;
    },
    async openAuth() {},
  };
  assert.equal(await initializeSession(), true);
  await persistSession();
  assert.deepEqual(calls, ['loadSession']);
  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({
      access: 'refreshed',
      refresh: 'test-refresh',
      expires: Date.now() + 3600000,
    }),
  );
  await persistSession();
  assert.deepEqual(calls, ['loadSession', 'saveSession']);
});

void test('native OAuth rejects a foreign origin or non-callback path before consuming state', async () => {
  for (const url of [
    'https://example.com/callback?code=test',
    'http://127.0.0.1:4383/callback?code=test',
    'http://127.0.0.1:4382/?code=test',
  ]) {
    await assert.rejects(completeSignIn(url), /Unexpected sign-in callback/);
  }
});

void test('native connection opens Hexclave with the loopback callback and streaming scope', async () => {
  let destination = '';
  window.headspaceNative = {
    async request(method, args) {
      assert.equal(method, 'openAuth');
      if (args?.url === undefined) throw new Error('Missing authorization URL');
      destination = args.url;
      return true;
    },
    async openAuth() {},
  };
  await connectSpotify();
  const url = new URL(destination);
  assert.equal(url.origin, 'https://api.hexclave.com');
  assert.equal(url.pathname, '/api/v1/auth/oauth/authorize/spotify');
  assert.equal(
    url.searchParams.get('redirect_uri'),
    'http://127.0.0.1:4382/callback',
  );
  assert.ok(
    url.searchParams.get('provider_scope')?.split(' ').includes('streaming'),
  );
});

void test('native callback exchanges the code without exposing it to page history or analytics', async () => {
  let authorization = '';
  window.headspaceNative = {
    async request(method, args) {
      if (method === 'openAuth' && args?.url !== undefined)
        authorization = args.url;
      return true;
    },
    async openAuth() {},
  };
  Object.defineProperty(globalThis, 'history', {
    value: {
      replaceState() {
        assert.fail('Native callback must not change the browser URL');
      },
    },
    configurable: true,
  });
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const request = new Request(input);
    return Response.json(
      request.url.endsWith('/auth/oauth/token')
        ? {
            access_token: 'identity-token',
            refresh_token: 'hex-refresh',
            expires_in: 3600,
          }
        : { access_token: 'spotify-playback-token' },
    );
  });
  await connectSpotify();
  const state = new URL(authorization).searchParams.get('state');
  assert.equal(
    await completeSignIn(
      `http://127.0.0.1:4382/callback?code=private-code&state=${state}`,
    ),
    true,
  );
  const saved = sessionStorage.getItem(sessionKey) ?? '';
  assert.ok(saved.includes('spotify-playback-token'));
  assert.ok(!saved.includes('identity-token'));
  assert.ok(!saved.includes('private-code'));
});
