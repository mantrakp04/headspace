import {
  api,
  authorize,
  clientKey,
  finishAuthorization,
  hasSession,
  scopes,
  type JsonValue,
  type Playback,
} from '@headspace/spotify';
export const CLIENT_ID = '05ac56334649404c8878e72b6aefac9a';
const hexclave = {
  projectId:
    import.meta.env?.VITE_HEXCLAVE_PROJECT_ID ||
    'e9d6159c-8a5c-4c2e-8a87-930b204e14ec',
  publishableClientKey:
    import.meta.env?.VITE_HEXCLAVE_PUBLISHABLE_CLIENT_KEY ||
    '__stack_public_client__',
};
const sessionKey = 'sunroom.spotify.session';
export type LocalPlayback = {
  running: boolean;
  playing: boolean;
  volume: number;
  position: number;
  shuffle: boolean;
  repeat: Playback['repeat'];
  name: string;
  artist: string;
  album: string;
  uri: string;
  duration: number;
  image: string;
};
export type PlaybackCommandArgs = {
  uri?: string;
  value?: number;
};
export type NativeRequestArgs = {
  value?: string;
  url?: string;
};
export type NativeResult = string | boolean | null;
declare global {
  interface Window {
    headspaceNative?: {
      request(method: string, args?: NativeRequestArgs): Promise<NativeResult>;
      openAuth(url: string): Promise<void>;
    };
  }
  interface WindowEventMap {
    'headspace-oauth': CustomEvent<string>;
    'headspace-player-error': CustomEvent<string>;
    'headspace-playback-changed': Event;
  }
}
export async function native(method: string, args?: NativeRequestArgs) {
  if (!window.headspaceNative)
    throw new Error('This control requires the Headspace desktop app.');
  return window.headspaceNative.request(method, args);
}
export function nativeText(value: NativeResult): string {
  return value === true || value === false || value === null ? '' : value;
}
let lastSaved = '';
export async function persistSession() {
  if (!window.headspaceNative) return;
  const data = sessionStorage.getItem(sessionKey);
  if (data && data !== lastSaved) {
    await native('saveSession', { value: data });
    lastSaved = data;
  }
}
export async function initializeSession() {
  localStorage.setItem(clientKey, CLIENT_ID);
  if (!window.headspaceNative) return finishAuthorization();
  const saved = nativeText(await native('loadSession'));
  if (saved) {
    sessionStorage.setItem(sessionKey, saved);
    lastSaved = saved;
  }
  return hasSession();
}
export async function connectSpotify() {
  return authorize(CLIENT_ID, {
    redirect: window.headspaceNative
      ? 'http://127.0.0.1:4382/callback'
      : window.location.origin + window.location.pathname,
    scope: scopes,
    hexclave,
    open: window.headspaceNative
      ? (url) => native('openAuth', { url }).then(() => {})
      : undefined,
  });
}
export async function completeSignIn(callback: string) {
  const url = new URL(callback);
  if (url.origin !== 'http://127.0.0.1:4382' || url.pathname !== '/callback')
    throw new Error('Unexpected sign-in callback.');
  const connected = await finishAuthorization(url);
  await persistSession();
  return connected;
}
export async function spotifyAPI(
  path: string,
  method = 'GET',
  body?: JsonValue,
) {
  const result = await api(path, method, body);
  await persistSession();
  return result;
}
