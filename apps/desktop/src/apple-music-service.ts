import {
  collectionPath,
  collectionRef,
  collections,
  editablePlaylists,
  isLibraryID,
  nextPath,
  pageOffset,
  parseCollection,
  parseSong,
  request,
  resolveSongQueue,
  searchPath,
  searchType,
  songs,
  trackID,
  type Credentials,
} from '@headspace/apple-music';
import {
  loadMusicKit,
  type MediaItem,
  type MusicKitInstance,
} from '@headspace/apple-music/musickit';
import {
  decodeResponseJson,
  list,
  object,
  string,
  type JsonValue,
  type Playback,
  type Track,
} from '@headspace/spotify';
import { nextRepeat } from '@headspace/spotify/selection';
import type { LocalPlayback } from './bridge';
import type { LibraryPage, MusicService } from './music-service';

// The site signs short-lived Apple Music developer tokens with Headspace's
// MusicKit key. The key never ships in the app.
export const tokenURL =
  import.meta.env?.VITE_APPLE_MUSIC_TOKEN_URL ||
  'https://hxc-p-53-si-870a3bb506b56ed0c0.fly.dev/api/apple-music/token';

let music: MusicKitInstance | null = null;
let configuring: Promise<MusicKitInstance> | null = null;
// Bumped by stop() so a play request still loading cannot start Apple Music
// after the user switched services.
let generation = 0;
// Rows loaded for each album and playlist, by position, so a clicked row can
// be found in MusicKit's queue even when the same song appears twice.
const collectionRows = new Map<string, Map<number, Track>>();

// MusicKit drops unplayable songs from the queue and matches string IDs to
// their first occurrence, so pass the number of playable rows before the
// selected one when every earlier row is known.
function queueIndex(uri: string, track: Track): number | string {
  const rows = collectionRows.get(uri);
  const position = track.contextPosition;
  if (!rows || position === undefined || rows.get(position)?.uri !== track.uri)
    return track.id;
  let index = 0;
  for (let row = 0; row < position; row += 1) {
    const earlier = rows.get(row);
    if (!earlier) return track.id;
    if (earlier.playable) index += 1;
  }
  return index;
}

function changed() {
  window.dispatchEvent(new Event('headspace-playback-changed'));
}

function playbackFailed() {
  window.dispatchEvent(
    new CustomEvent('headspace-player-error', {
      detail: 'Apple Music could not play this song.',
    }),
  );
}

function storedVolume() {
  return Math.max(
    0,
    Math.min(1, Number(localStorage.getItem('headspace.volume') ?? '0.5') || 0),
  );
}

const unreachable =
  'Headspace could not reach Apple Music. Check your connection and try again.';

async function developerToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(tokenURL);
  } catch {
    // WebKit reports CORS and network failures only as "Load failed".
    throw new Error(unreachable);
  }
  let data: JsonValue = null;
  try {
    data = await decodeResponseJson(response);
  } catch {
    /* The status check below explains the failure. */
  }
  const token = string(object(data).token);
  if (!response.ok || !token)
    throw new Error(
      response.status === 503
        ? 'Apple Music is not set up for Headspace yet.'
        : unreachable,
    );
  return token;
}

function configure(): Promise<MusicKitInstance> {
  if (music) return Promise.resolve(music);
  configuring ??= (async () => {
    const [token] = await Promise.all([developerToken(), loadMusicKit()]);
    if (!window.MusicKit) throw new Error('Apple Music did not load.');
    const instance = await window.MusicKit.configure({
      developerToken: token,
      app: { name: 'Headspace', build: '1.0' },
    });
    instance.volume = storedVolume();
    for (const name of [
      'playbackStateDidChange',
      'nowPlayingItemDidChange',
      'queueItemsDidChange',
      'shuffleModeDidChange',
      'repeatModeDidChange',
    ])
      instance.addEventListener(name, changed);
    instance.addEventListener('mediaPlaybackError', playbackFailed);
    music = instance;
    return instance;
  })().finally(() => {
    configuring = null;
  });
  return configuring;
}

async function session(): Promise<MusicKitInstance> {
  const instance = await configure();
  if (!instance.isAuthorized)
    throw new Error('Connect Apple Music to continue.');
  return instance;
}

function credentials(instance: MusicKitInstance): Credentials {
  return {
    developer: instance.developerToken,
    user: instance.musicUserToken,
  };
}

async function api(path: string, method = 'GET', body?: JsonValue) {
  return request(credentials(await session()), path, method, body);
}

function mediaTrack(item: MediaItem): Track | null {
  return parseSong({
    id: item.id,
    type: /video/i.test(item.type)
      ? 'music-videos'
      : isLibraryID(item.id)
        ? 'library-songs'
        : 'songs',
    attributes: item.attributes ?? {},
  });
}

function repeatMode(instance: MusicKitInstance): Playback['repeat'] {
  return instance.repeatMode === 1
    ? 'track'
    : instance.repeatMode === 2
      ? 'context'
      : 'off';
}

const emptyPage: LibraryPage = {
  songs: [],
  collections: [],
  context: null,
  continuation: null,
  next: null,
};

export function resetAppleMusic() {
  music = null;
  configuring = null;
  collectionRows.clear();
}

export const appleMusicService: MusicService = {
  provider: 'apple-music',
  name: 'Apple Music',
  likedLabel: 'Songs',
  requirement: 'An Apple Music subscription is required.',
  podcasts: false,
  devices: false,
  retriesPlayer: false,
  queueURL: '',
  async restore() {
    return (await configure()).isAuthorized;
  },
  async connect() {
    const instance = await configure();
    try {
      await instance.authorize();
    } catch {
      // MusicKit reports every failure, including a closed window, as
      // "Unauthorized", so there is no better detail to show.
      throw new Error(
        'Apple Music sign-in did not finish. You can try again whenever you like.',
      );
    }
    return { connected: instance.isAuthorized, authURL: '' };
  },
  async disconnect() {
    const instance = music;
    if (!instance) return;
    try {
      await instance.stop();
    } catch {
      /* Sign out even if playback cannot stop. */
    }
    await instance.unauthorize();
    changed();
  },
  async start() {
    await configure();
  },
  stop() {
    generation += 1;
    collectionRows.clear();
    const instance = music;
    if (instance)
      void Promise.resolve()
        .then(() => instance.pause())
        .catch(() => {});
  },
  async profile() {
    const data = object(await api('/v1/me/library/playlists?limit=100'));
    return { name: 'Apple Music', playlists: editablePlaylists(data.data) };
  },
  async library(selected, search, kind, collection, more) {
    const instance = await session();
    const storefront = instance.storefrontId || 'us';
    const ref = collection ? collectionRef(collection.uri) : null;
    let path = more || '';
    if (!path) {
      switch (selected) {
        case 'playlists':
          path = '/v1/me/library/playlists?limit=100';
          break;
        case 'albums':
          path = '/v1/me/library/albums?limit=100';
          break;
        case 'artists':
          path = '/v1/me/library/artists?limit=100';
          break;
        case 'liked':
          path = '/v1/me/library/songs?limit=100';
          break;
        case 'recent':
          path = '/v1/me/recent/played/tracks?limit=30';
          break;
        case 'search':
          if (kind === 'show' || !search.trim()) return emptyPage;
          path = searchPath(storefront, search, kind);
          break;
        case 'collection':
          if (!ref) return emptyPage;
          path = collectionPath(ref, storefront);
          break;
        case 'shows':
          return emptyPage;
      }
    }
    const raw = object(await request(credentials(instance), path));
    const page =
      selected === 'search' && kind !== 'show'
        ? object(object(raw.results)[searchType(kind)])
        : raw;
    const grouped =
      selected === 'playlists' ||
      selected === 'albums' ||
      selected === 'artists' ||
      (selected === 'search' && kind !== 'track') ||
      (selected === 'collection' && ref?.type === 'artists');
    const songList = grouped ? [] : songs(page.data, pageOffset(more));
    const context =
      selected === 'collection' && collection && ref?.type !== 'artists'
        ? collection.uri
        : null;
    if (context) {
      const rows = (more && collectionRows.get(context)) || new Map();
      // Only the open album or playlist can be played by row.
      collectionRows.clear();
      for (const song of songList)
        if (song.contextPosition !== undefined)
          rows.set(song.contextPosition, song);
      collectionRows.set(context, rows);
    }
    return {
      songs: songList,
      collections: grouped ? collections(page.data) : [],
      context,
      continuation: selected === 'liked' ? nextPath(page.next) : null,
      next: selected === 'recent' ? null : nextPath(page.next),
    };
  },
  async play(selection) {
    const current = generation;
    const instance = await session();
    if (selection.kind === 'context') {
      const ref = collectionRef(selection.uri);
      if (!ref || ref.type === 'artists')
        throw new Error('Choose an album or playlist to play.');
      const track = selection.track;
      if (track && !track.playable)
        throw new Error('This track is unavailable.');
      const startWith = track ? queueIndex(selection.uri, track) : undefined;
      await instance.setQueue(
        ref.type === 'albums'
          ? { album: ref.id, startWith, startPlaying: false }
          : { playlist: ref.id, startWith, startPlaying: false },
      );
    } else {
      const queue = await resolveSongQueue(
        selection.items,
        selection.index,
        selection.next,
        (path) => request(credentials(instance), path),
      );
      if (current !== generation) return;
      await instance.setQueue({
        songs: queue.songs,
        startWith: queue.startWith,
        startPlaying: false,
      });
    }
    if (current !== generation) return;
    await instance.play();
    changed();
  },
  async command(method, args = {}) {
    const instance = await session();
    switch (method) {
      case 'enqueue': {
        const id = args.uri === undefined ? null : trackID(args.uri);
        if (!id) throw new Error('Invalid track.');
        if (!instance.nowPlayingItem)
          throw new Error(
            'Play a song in Headspace before adding to its queue.',
          );
        await instance.playLater({ songs: [id] });
        changed();
        return;
      }
      case 'play':
        return instance.play();
      case 'pause':
        return instance.pause();
      case 'toggle':
        return instance.isPlaying ? instance.pause() : instance.play();
      case 'stop':
        return instance.stop();
      case 'previous':
        return instance.skipToPreviousItem();
      case 'next':
        return instance.skipToNextItem();
      case 'volume':
      case 'seek': {
        if (args.value === undefined || !Number.isFinite(args.value))
          throw new Error('Invalid playback value.');
        if (method === 'seek')
          return instance.seekToTime(Math.max(0, args.value));
        const volume = Math.min(100, Math.max(0, args.value)) / 100;
        instance.volume = volume;
        localStorage.setItem('headspace.volume', String(volume));
        return;
      }
      case 'shuffle':
        instance.shuffleMode = instance.shuffleMode === 1 ? 0 : 1;
        changed();
        return;
      case 'repeat': {
        const next = nextRepeat(repeatMode(instance));
        instance.repeatMode = next === 'track' ? 1 : next === 'context' ? 2 : 0;
        changed();
        return;
      }
      default:
        throw new Error('Unknown playback command.');
    }
  },
  async readPlayback(): Promise<LocalPlayback> {
    const instance = music;
    const track =
      instance?.nowPlayingItem && mediaTrack(instance.nowPlayingItem);
    return {
      running: instance?.isAuthorized === true,
      playing: instance?.isPlaying === true,
      volume: Math.round((instance?.volume ?? storedVolume()) * 100),
      position: Math.round((instance?.currentPlaybackTime ?? 0) * 1000),
      shuffle: instance?.shuffleMode === 1,
      repeat: instance ? repeatMode(instance) : 'off',
      name: track ? track.name : '',
      artist: track ? track.artist : '',
      album: track ? track.album : '',
      uri: track ? track.uri : '',
      duration:
        instance && instance.currentPlaybackDuration > 0
          ? Math.round(instance.currentPlaybackDuration * 1000)
          : track
            ? track.duration
            : 0,
      image: track ? track.image : '',
    };
  },
  async queue() {
    const instance = await session();
    return {
      current: instance.nowPlayingItem
        ? mediaTrack(instance.nowPlayingItem)
        : null,
      items: instance.queue.items
        .slice(instance.queue.position + 1)
        .flatMap((item) => {
          const track = mediaTrack(item);
          return track ? [track] : [];
        }),
    };
  },
  async listDevices() {
    return [];
  },
  async transfer() {
    throw new Error('Apple Music plays only inside Headspace.');
  },
  async toggleSaved(track, saved) {
    const id = trackID(track.uri);
    if (!id) throw new Error('Only songs can be added to your library.');
    if (saved || isLibraryID(id))
      throw new Error(
        'This song is in your library. Apple Music only lets you remove it in the Music app.',
      );
    await api(
      '/v1/me/library?' + new URLSearchParams({ 'ids[songs]': id }),
      'POST',
    );
    return true;
  },
  async saveCollection(collection) {
    const ref = collectionRef(collection.uri);
    if (!ref || ref.type === 'artists')
      throw new Error(
        'Apple Music can add albums and playlists to your library.',
      );
    if (ref.library) throw new Error('This is already in your library.');
    await api(
      '/v1/me/library?' + new URLSearchParams({ [`ids[${ref.type}]`]: ref.id }),
      'POST',
    );
  },
  async createPlaylist(name) {
    return parseCollection(
      list(
        object(
          await api('/v1/me/library/playlists', 'POST', {
            attributes: { name },
          }),
        ).data,
      )[0],
    );
  },
  async addToPlaylist(playlist, track) {
    const ref = collectionRef(playlist.uri);
    const id = trackID(track.uri);
    if (!ref?.library || ref.type !== 'playlists')
      throw new Error('Choose one of your own playlists.');
    if (!id) throw new Error('Only songs can be added to playlists.');
    await api(
      `/v1/me/library/playlists/${encodeURIComponent(ref.id)}/tracks`,
      'POST',
      { data: [{ id, type: isLibraryID(id) ? 'library-songs' : 'songs' }] },
    );
  },
};
