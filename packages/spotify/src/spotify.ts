import {
  connectedSpotifyToken,
  hexclaveAPI,
  parseHexclaveConnection,
  type HexclaveConnection,
} from './hexclave.ts';
import {
  decodeJson,
  decodeResponseJson,
  isFiniteNumber,
  isJsonString,
  list,
  object,
  string,
  tryDecodeJson,
  type JsonValue,
} from './json.ts';

export {
  decodeJson,
  decodeResponseJson,
  isFiniteNumber,
  isJsonBoolean,
  isJsonObject,
  isJsonString,
  list,
  object,
  string,
  tryDecodeJson,
  type JsonObject,
  type JsonValue,
} from './json.ts';

export const scopes =
  'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-library-read user-library-modify user-follow-read user-follow-modify';
const tokenKey = 'sunroom.spotify.session';
const pendingKey = 'sunroom.spotify.pending';
export const clientKey = 'sunroom.spotify.client';
export type Track = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  image: string;
  album: string;
  duration: number;
  playable: boolean;
  contextPosition?: number;
  url: string;
};
export type Collection = {
  id: string;
  uri: string;
  name: string;
  subtitle: string;
  image: string;
  kind: 'playlist' | 'album' | 'artist' | 'show';
  url: string;
};
export type Device = {
  id: string;
  name: string;
  active: boolean;
  volume: number | null;
  restricted: boolean;
};
export type Playback = {
  track: Track | null;
  playing: boolean;
  progress: number;
  shuffle: boolean;
  repeat: 'off' | 'context' | 'track';
  device: Device | null;
  updatedAt: number;
};
let sessionGeneration = 0;
type Tokens = { access: string; refresh: string; expires: number } & (
  | { issuer?: 'spotify' }
  | { issuer: 'hexclave'; hexclave: HexclaveConnection }
);
function number(value: JsonValue | undefined): number {
  return isFiniteNumber(value) ? value : 0;
}
function picture(value: JsonValue | undefined): string {
  const url = string(object(list(value)[0]).url);
  return url.startsWith('https://') ? url : '';
}
function external(value: JsonValue | undefined): string {
  const url = string(object(value).spotify);
  return url.startsWith('https://open.spotify.com/') ? url : '';
}
export function parseTrack(value: JsonValue | undefined): Track | null {
  const t = object(value),
    album = object(t.album),
    show = object(t.show);
  if (!string(t.uri) || !string(t.name)) return null;
  return {
    id: string(t.id),
    uri: string(t.uri),
    name: string(t.name),
    artist:
      list(t.artists)
        .map((a) => string(object(a).name))
        .filter(Boolean)
        .join(', ') ||
      string(show.publisher) ||
      'Podcast',
    image: picture(album.images) || picture(t.images),
    album: string(album.name) || string(show.name),
    duration: number(t.duration_ms),
    playable: t.is_playable !== false && t.is_local !== true,
    url: external(t.external_urls),
  };
}
export function parseCollection(
  value: JsonValue | undefined,
  kind: Collection['kind'],
): Collection | null {
  const c = object(value);
  if (!string(c.id) || !string(c.name)) return null;
  return {
    id: string(c.id),
    uri: string(c.uri),
    name: string(c.name),
    subtitle:
      kind === 'playlist'
        ? string(object(c.owner).display_name) || 'Playlist'
        : list(c.artists)
            .map((a) => string(object(a).name))
            .join(', ') ||
          string(c.publisher) ||
          kind,
    image: picture(c.images),
    kind,
    url: external(c.external_urls),
  };
}
export function parseDevice(value: JsonValue | undefined): Device | null {
  const d = object(value);
  if (!string(d.id)) return null;
  return {
    id: string(d.id),
    name: string(d.name),
    active: d.is_active === true,
    volume: isFiniteNumber(d.volume_percent) ? d.volume_percent : null,
    restricted: d.is_restricted === true,
  };
}
export function parsePlayback(value: JsonValue | undefined): Playback {
  const p = object(value);
  return {
    track: parseTrack(p.item),
    playing: p.is_playing === true,
    progress: number(p.progress_ms),
    shuffle: p.shuffle_state === true,
    repeat:
      p.repeat_state === 'track' || p.repeat_state === 'context'
        ? p.repeat_state
        : 'off',
    device: parseDevice(p.device),
    updatedAt: Date.now(),
  };
}
export function tracks(value: JsonValue | undefined, offset = 0): Track[] {
  return list(value).flatMap((v, index) => {
    const o = object(v);
    const t = parseTrack(o.track ?? o.item ?? v);
    return t ? [{ ...t, contextPosition: offset + index }] : [];
  });
}
export function collections(
  value: JsonValue | undefined,
  kind: Collection['kind'],
): Collection[] {
  return list(value).flatMap((v) => {
    const o = object(v);
    const c = parseCollection(o.album ?? o.show ?? v, kind);
    return c ? [c] : [];
  });
}
function readTokens(): Tokens | null {
  try {
    const t = object(decodeJson(sessionStorage.getItem(tokenKey) || 'null'));
    if (
      !(
        isJsonString(t.access) &&
        isJsonString(t.refresh) &&
        isFiniteNumber(t.expires)
      )
    )
      return null;
    const tokens = { access: t.access, refresh: t.refresh, expires: t.expires };
    if (t.issuer === 'hexclave') {
      const hexclave = parseHexclaveConnection(t.hexclave);
      return hexclave ? { ...tokens, issuer: 'hexclave', hexclave } : null;
    }
    return t.issuer === undefined || t.issuer === 'spotify' ? tokens : null;
  } catch {
    return null;
  }
}
export function hasSession() {
  return readTokens() !== null;
}
export function disconnect() {
  sessionGeneration++;
  callbackRequest = null;
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(pendingKey);
}
export function redirectUri() {
  return window.location.origin + '/';
}
function random() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function authorize(
  clientId: string,
  options: {
    redirect?: string;
    open?: (url: string) => void | Promise<void>;
    scope?: string;
    hexclave?: HexclaveConnection;
  } = {},
) {
  callbackRequest = null;
  const callback = options.redirect ?? redirectUri();
  if (!/^[a-f0-9]{32}$/i.test(clientId.trim()))
    throw new Error('Enter the 32-character Client ID from your Spotify app.');
  const verifier = random(),
    state = random();
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  );
  const challenge = btoa(String.fromCharCode(...digest))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  localStorage.setItem(clientKey, clientId.trim());
  sessionStorage.setItem(
    pendingKey,
    JSON.stringify({
      verifier,
      state,
      redirect: callback,
      created: Date.now(),
      hexclave: options.hexclave,
    }),
  );
  const query = new URLSearchParams({
    client_id: clientId.trim(),
    response_type: 'code',
    redirect_uri: callback,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: options.scope ?? scopes,
  });
  if (options.hexclave) {
    query.set('client_id', options.hexclave.projectId);
    query.set('client_secret', options.hexclave.publishableClientKey);
    query.set('scope', 'legacy');
    query.set('provider_scope', options.scope ?? scopes);
    query.set('type', 'authenticate');
    query.set('grant_type', 'authorization_code');
    query.set('error_redirect_url', callback);
  }
  const url =
    (options.hexclave
      ? `${hexclaveAPI}/auth/oauth/authorize/spotify?`
      : 'https://accounts.spotify.com/authorize?') + query;
  if (options.open) await options.open(url);
  else window.location.assign(url);
}
async function exchange(
  body: URLSearchParams,
  previousRefresh = '',
  hexclave?: HexclaveConnection,
) {
  const generation = sessionGeneration;
  if (hexclave) {
    body.set('client_id', hexclave.projectId);
    body.set('client_secret', hexclave.publishableClientKey);
  }
  const response = await fetch(
    hexclave
      ? `${hexclaveAPI}/auth/oauth/token`
      : 'https://accounts.spotify.com/api/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  const data = object(await decodeResponseJson(response));
  if (!response.ok || !string(data.access_token)) {
    if (response.status === 400 || response.status === 401) disconnect();
    throw new Error(
      'Spotify sign-in expired or was rejected. Please connect again.',
    );
  }
  const base = {
    access: hexclave
      ? await connectedSpotifyToken(hexclave, string(data.access_token), scopes)
      : string(data.access_token),
    refresh: string(data.refresh_token) || previousRefresh,
    expires: Date.now() + (hexclave ? 300000 : number(data.expires_in) * 1000),
  };
  const tokens: Tokens = hexclave
    ? { ...base, issuer: 'hexclave', hexclave }
    : base;
  if (generation !== sessionGeneration)
    throw new Error('Spotify was disconnected. Please connect again.');
  sessionStorage.setItem(tokenKey, JSON.stringify(tokens));
  return tokens.access;
}
let callbackRequest: Promise<boolean> | null = null;
export function finishAuthorization(callback?: URL): Promise<boolean> {
  if (callbackRequest) return callbackRequest;
  const initialParams = new URLSearchParams(
    callback?.search ?? window.location.search,
  );
  if (!initialParams.has('code') && !initialParams.has('error'))
    return Promise.resolve(hasSession());
  callbackRequest = (async () => {
    const params = initialParams;
    if (!callback) history.replaceState(null, '', window.location.pathname);
    const raw = sessionStorage.getItem(pendingKey);
    sessionStorage.removeItem(pendingKey);
    if (params.has('error'))
      throw new Error(
        'Spotify connection was cancelled. You can try again whenever you like.',
      );
    const pending = object(decodeJson(raw || 'null'));
    if (
      !string(pending.state) ||
      params.get('state') !== pending.state ||
      !string(pending.verifier) ||
      Date.now() - number(pending.created) > 600000
    )
      throw new Error(
        'This sign-in link expired or did not match this tab. Please connect again.',
      );
    const hexclave = parseHexclaveConnection(pending.hexclave);
    if (pending.hexclave !== undefined && !hexclave)
      throw new Error(
        'This Hexclave sign-in is invalid. Please connect again.',
      );
    await exchange(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.get('code') || '',
        redirect_uri: string(pending.redirect),
        client_id: localStorage.getItem(clientKey) || '',
        code_verifier: string(pending.verifier),
      }),
      '',
      hexclave ?? undefined,
    );
    return true;
  })().finally(() => {
    callbackRequest = null;
  });
  return callbackRequest;
}
let refreshRequest: Promise<string> | null = null;
export async function accessToken(force = false): Promise<string> {
  const t = readTokens();
  if (!t) throw new Error('Connect your Spotify account to continue.');
  if (!force && t.expires > Date.now() + 60000) return t.access;
  if (!refreshRequest)
    refreshRequest = exchange(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: t.refresh,
        client_id: localStorage.getItem(clientKey) || '',
      }),
      t.refresh,
      t.issuer === 'hexclave' ? t.hexclave : undefined,
    ).finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}
let blockedUntil = 0;
export class SpotifyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api(
  path: string,
  method = 'GET',
  body?: JsonValue,
  retry = true,
): Promise<JsonValue> {
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new Error('Invalid Spotify request.');
  if (Date.now() < blockedUntil)
    throw new SpotifyError(
      'Spotify is limiting requests. Please wait a moment before trying again.',
      429,
    );
  const token = await accessToken();
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const request: RequestInit = { method, headers };
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    if (method !== 'GET') request.body = JSON.stringify(body);
  }
  const response = await fetch('https://api.spotify.com/v1' + path, request);
  if (response.status === 401 && retry) {
    await accessToken(true);
    return api(path, method, body, false);
  }
  if (
    response.status === 404 &&
    method === 'GET' &&
    /^\/playlists\/[^/]+\/items(?:\?|$)/.test(path)
  )
    return api(path.replace('/items', '/tracks'), method, body, retry);
  if (response.status === 204) return null;
  const data = tryDecodeJson(await response.text());
  if (!response.ok) {
    const error = object(object(data).error);
    if (response.status === 429)
      blockedUntil =
        Date.now() +
        Math.max(30, Number(response.headers.get('Retry-After')) || 30) * 1000;
    const playlistRead =
      method === 'GET' &&
      /^\/playlists\/[^/]+\/(items|tracks)(?:\?|$)/.test(path);
    const message =
      playlistRead && (response.status === 403 || response.status === 404)
        ? 'Spotify could not load this playlist’s songs. Check playlist access. Spotify development apps can only read playlists you own or collaborate on.'
        : response.status === 403
          ? 'Spotify did not allow this action. Check your Premium subscription, app access list, and granted permissions.'
          : response.status === 404
            ? 'Spotify could not find this item or an active player. Choose a device and try again.'
            : response.status === 429
              ? error.reason === 'QUOTA_EXCEEDED'
                ? 'Your Spotify developer account has reached its API quota. Try again after the quota resets.'
                : 'Spotify is limiting requests. Please wait before trying again.'
              : string(error.message) ||
                'Spotify could not complete the request. Please try again.';
    throw new SpotifyError(message, response.status);
  }
  return data;
}
export function pagePath(value: JsonValue | undefined): string | null {
  if (!isJsonString(value)) return null;
  const url = new URL(value, 'https://api.spotify.com');
  return url.origin === 'https://api.spotify.com' &&
    url.pathname.startsWith('/v1/')
    ? url.pathname.slice(3) + url.search
    : null;
}
export function formatTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
