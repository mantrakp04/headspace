import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import {
  completeSignIn,
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
