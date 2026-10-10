import {
  isFiniteNumber,
  isJsonString,
  list,
  object,
  string,
  tryDecodeJson,
  type Collection,
  type JsonValue,
  type Track,
} from '@headspace/spotify';

export const apiOrigin = 'https://api.music.apple.com';

export type Credentials = { developer: string; user: string };
export type CollectionType = 'albums' | 'playlists' | 'artists';
export type CollectionRef = {
  type: CollectionType;
  library: boolean;
  id: string;
};
export type SearchKind = 'track' | 'album' | 'artist' | 'playlist';

// MusicKit treats IDs such as i.abc (song), l.abc (album) and p.abc (playlist)
// as library items. Library artists use r.abc.
export function isLibraryID(id: string) {
  return /^[ailpr]\.[A-Za-z0-9]+$/.test(id);
}

export function trackURI(id: string) {
  return `apple-music:${isLibraryID(id) ? 'library-songs' : 'songs'}:${id}`;
}

export function trackID(uri: string): string | null {
  const match = /^apple-music:(?:library-)?songs:([A-Za-z0-9.]+)$/.exec(uri);
  return match ? match[1] : null;
}

export function collectionRef(uri: string): CollectionRef | null {
  const match =
    /^apple-music:(library-)?(albums|playlists|artists):([A-Za-z0-9.]+)$/.exec(
      uri,
    );
  if (!match) return null;
  const type = match[2];
  if (type !== 'albums' && type !== 'playlists' && type !== 'artists')
    return null;
  return { type, library: match[1] !== undefined, id: match[3] };
}

export function artwork(value: JsonValue | undefined, size = 300): string {
  const url = string(object(value).url)
    .replace('{w}', String(size))
    .replace('{h}', String(size))
    .replace('{f}', 'jpg');
  return url.startsWith('https://') ? url : '';
}

function link(value: JsonValue | undefined): string {
  const url = string(value);
  return url.startsWith('https://music.apple.com/') ? url : '';
}

export function parseSong(value: JsonValue | undefined): Track | null {
  const resource = object(value),
    attributes = object(resource.attributes);
  const id = string(resource.id),
    type = string(resource.type),
    name = string(attributes.name);
  if (!id || !name) return null;
  const song = type === 'songs' || type === 'library-songs';
  if (!song && type !== 'music-videos' && type !== 'library-music-videos')
    return null;
  return {
    id,
    uri: song ? trackURI(id) : `apple-music:${type}:${id}`,
    name,
    artist: string(attributes.artistName),
    image: artwork(attributes.artwork),
    album: string(attributes.albumName),
    duration: isFiniteNumber(attributes.durationInMillis)
      ? attributes.durationInMillis
      : 0,
    // Songs missing from the user's storefront arrive without playParams.
    playable: song && attributes.playParams !== undefined,
    url: link(attributes.url),
  };
}

export function parseCollection(
  value: JsonValue | undefined,
): Collection | null {
  const resource = object(value),
    attributes = object(resource.attributes);
  const id = string(resource.id),
    type = string(resource.type),
    name = string(attributes.name);
  if (!id || !name) return null;
  const library = type.startsWith('library-');
  const base = library ? type.slice('library-'.length) : type;
  if (base !== 'albums' && base !== 'playlists' && base !== 'artists')
    return null;
  const kind =
    base === 'albums' ? 'album' : base === 'playlists' ? 'playlist' : 'artist';
  return {
    id,
    uri: `apple-music:${type}:${id}`,
    name,
    subtitle:
      kind === 'playlist'
        ? string(attributes.curatorName) || 'Playlist'
        : kind === 'album'
          ? string(attributes.artistName) || 'album'
          : 'artist',
    image: artwork(attributes.artwork),
    kind,
    url: link(attributes.url),
  };
}

export function songs(value: JsonValue | undefined, offset = 0): Track[] {
  return list(value).flatMap((item, index) => {
    const track = parseSong(item);
    return track ? [{ ...track, contextPosition: offset + index }] : [];
  });
}

export function collections(value: JsonValue | undefined): Collection[] {
  return list(value).flatMap((item) => {
    const collection = parseCollection(item);
    return collection ? [collection] : [];
  });
}

// Apple Music only lets apps add songs to library playlists the user can edit.
export function editablePlaylists(value: JsonValue | undefined): Collection[] {
  return list(value).flatMap((item) => {
    const collection = parseCollection(item);
    return collection &&
      collection.uri.startsWith('apple-music:library-playlists:') &&
      object(object(item).attributes).canEdit === true
      ? [collection]
      : [];
  });
}

export function collectionPath(ref: CollectionRef, storefront: string) {
  const base = ref.library
    ? `/v1/me/library/${ref.type}/${encodeURIComponent(ref.id)}`
    : `/v1/catalog/${encodeURIComponent(storefront)}/${ref.type}/${encodeURIComponent(ref.id)}`;
  return ref.type === 'artists'
    ? `${base}/albums?limit=25`
    : `${base}/tracks?limit=100`;
}

export function searchPath(storefront: string, term: string, kind: SearchKind) {
  return (
    `/v1/catalog/${encodeURIComponent(storefront)}/search?` +
    new URLSearchParams({ term, types: searchType(kind), limit: '25' })
  );
}

export function searchType(kind: SearchKind) {
  return kind === 'track' ? 'songs' : kind + 's';
}

export function nextPath(value: JsonValue | undefined): string | null {
  if (!isJsonString(value)) return null;
  const url = new URL(value, apiOrigin);
  return url.origin === apiOrigin && url.pathname.startsWith('/v1/')
    ? url.pathname + url.search
    : null;
}

export function pageOffset(path: string | undefined): number {
  if (!path) return 0;
  const offset = Number(new URL(path, apiOrigin).searchParams.get('offset'));
  return Number.isInteger(offset) && offset > 0 ? offset : 0;
}

export class AppleMusicError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let blockedUntil = 0;
export async function request(
  credentials: Credentials,
  path: string,
  method = 'GET',
  body?: JsonValue,
): Promise<JsonValue> {
  if (!path.startsWith('/v1/')) throw new Error('Invalid Apple Music request.');
  if (Date.now() < blockedUntil)
    throw new AppleMusicError(
      'Apple Music is limiting requests. Please wait a moment before trying again.',
      429,
    );
  const headers = new Headers({
    Authorization: `Bearer ${credentials.developer}`,
    'Music-User-Token': credentials.user,
  });
  const init: RequestInit = { method, headers };
  if (body !== undefined && method !== 'GET') {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(body);
  }
  const response = await fetch(apiOrigin + path, init);
  if (response.status === 204 || response.status === 202) return null;
  const data = tryDecodeJson(await response.text());
  if (!response.ok) {
    if (response.status === 429)
      blockedUntil =
        Date.now() +
        Math.max(30, Number(response.headers.get('Retry-After')) || 30) * 1000;
    const detail = object(list(object(data).errors)[0]);
    const message =
      response.status === 401
        ? 'Apple Music rejected Headspace’s developer token. Try again later.'
        : response.status === 403
          ? 'Apple Music did not allow this action. Check your Apple Music subscription, or reconnect Apple Music in Account.'
          : response.status === 404
            ? 'Apple Music could not find this item.'
            : response.status === 429
              ? 'Apple Music is limiting requests. Please wait before trying again.'
              : string(detail.detail) ||
                string(detail.title) ||
                'Apple Music could not complete the request. Please try again.';
    throw new AppleMusicError(message, response.status);
  }
  return data;
}

// MusicKit fetches every queued song before playback starts, so long song lists
// are trimmed to a window around the selected song.
export const queueBefore = 50;
export const queueAfter = 250;

export async function resolveSongQueue(
  items: readonly Track[],
  index: number,
  next: string | null,
  load: (path: string) => Promise<JsonValue>,
): Promise<{ songs: string[]; startWith: number }> {
  const selected = items[index];
  if (!selected?.playable) throw new Error('This track is unavailable.');
  const all = [...items];
  const visited = new Set<string>();
  let page = next;
  const following = () => all.slice(index + 1).filter((t) => t.playable).length;
  while (page && following() < queueAfter) {
    if (visited.has(page))
      throw new Error('Apple Music returned a repeated page. Retry playback.');
    visited.add(page);
    const data = object(await load(page));
    all.push(...songs(data.data, all.length));
    page = nextPath(data.next);
  }
  const position = all.slice(0, index).filter((t) => t.playable).length;
  const start = Math.max(0, position - queueBefore);
  return {
    songs: all
      .filter((t) => t.playable)
      .slice(start, position + queueAfter + 1)
      .map((t) => t.id),
    startWith: position - start,
  };
}
