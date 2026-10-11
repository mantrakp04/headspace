import {
  collections,
  disconnect,
  isFiniteNumber,
  isJsonString,
  list,
  object,
  pagePath,
  parseCollection,
  parseTrack,
  tracks,
} from '@headspace/spotify';
import {
  connectSpotify,
  initializeSession,
  native,
  nativeText,
  spotifyAPI,
} from './bridge';
import {
  disconnectPlayer,
  playbackCommand,
  playSelection,
  readPlayback,
  startPlayer,
} from './player';
import type { MusicService } from './music-service';

export const spotifyService: MusicService = {
  provider: 'spotify',
  name: 'Spotify',
  likedLabel: 'Liked Songs',
  requirement: 'Spotify Premium required.',
  podcasts: true,
  devices: true,
  retriesPlayer: true,
  queueURL: 'https://open.spotify.com/queue',
  restore: initializeSession,
  async connect() {
    await connectSpotify();
    const url = window.headspaceNative ? await native('authURL') : '';
    return { connected: false, authURL: nativeText(url) };
  },
  async disconnect() {
    disconnectPlayer();
    disconnect();
    if (window.headspaceNative) await native('clearSession');
  },
  async start() {
    await startPlayer();
  },
  stop: disconnectPlayer,
  async profile() {
    const p = object(await spotifyAPI('/me'));
    return {
      name: isJsonString(p.display_name) ? p.display_name : 'Spotify',
      playlists: collections(
        object(await spotifyAPI('/me/playlists?limit=50')).items,
        'playlist',
      ),
    };
  },
  async library(selected, search, type, collection, more) {
    let path = more || '';
    if (!path) {
      switch (selected) {
        case 'playlists':
          path = '/me/playlists?limit=50';
          break;
        case 'albums':
          path = '/me/albums?limit=50';
          break;
        case 'artists':
          path = '/me/following?type=artist&limit=50';
          break;
        case 'shows':
          path = '/me/shows?limit=50';
          break;
        case 'liked':
          path = '/me/tracks?limit=50';
          break;
        case 'recent':
          path = '/me/player/recently-played?limit=50';
          break;
        case 'search':
          path =
            '/search?' + new URLSearchParams({ q: search, type, limit: '10' });
          break;
        case 'collection':
          if (!collection)
            return {
              songs: [],
              collections: [],
              context: null,
              continuation: null,
              next: null,
            };
          path =
            collection.kind === 'playlist'
              ? `/playlists/${collection.id}/items?limit=50`
              : collection.kind === 'album'
                ? `/albums/${collection.id}/tracks?limit=50`
                : collection.kind === 'artist'
                  ? `/artists/${collection.id}/albums?limit=50`
                  : `/shows/${collection.id}/episodes?limit=50`;
          break;
      }
    }
    const raw = object(await spotifyAPI(path));
    const page =
      selected === 'search'
        ? object(raw[type === 'show' ? 'shows' : type + 's'])
        : selected === 'artists'
          ? object(raw.artists)
          : raw;
    const kind =
      selected === 'playlists'
        ? 'playlist'
        : selected === 'albums'
          ? 'album'
          : selected === 'artists'
            ? 'artist'
            : selected === 'shows'
              ? 'show'
              : selected === 'search' && type !== 'track'
                ? type
                : selected === 'collection' && collection?.kind === 'artist'
                  ? 'album'
                  : null;
    return {
      songs: kind
        ? []
        : tracks(page.items, isFiniteNumber(page.offset) ? page.offset : 0),
      collections: kind ? collections(page.items, kind) : [],
      context:
        selected === 'collection' &&
        collection &&
        (collection.kind === 'album' || collection.kind === 'playlist')
          ? collection.uri
          : null,
      continuation:
        selected === 'liked' ||
        (selected === 'collection' && collection?.kind === 'show')
          ? pagePath(page.next)
          : null,
      next: selected === 'recent' ? null : pagePath(page.next),
    };
  },
  play: playSelection,
  command: playbackCommand,
  readPlayback,
  async queue() {
    const data = object(await spotifyAPI('/me/player/queue'));
    return {
      current: parseTrack(data.currently_playing),
      items: tracks(data.queue),
    };
  },
  async listDevices() {
    return list(object(await spotifyAPI('/me/player/devices')).devices).flatMap(
      (v) => {
        const d = object(v);
        return isJsonString(d.id) && isJsonString(d.name)
          ? [{ id: d.id, name: d.name, active: d.is_active === true }]
          : [];
      },
    );
  },
  async transfer(device, play) {
    await spotifyAPI('/me/player', 'PUT', { device_ids: [device], play });
  },
  async toggleSaved(t, saved) {
    const wasSaved =
      saved ||
      list(
        await spotifyAPI(
          '/me/library/contains?uris=' + encodeURIComponent(t.uri),
        ),
      )[0] === true;
    await spotifyAPI(
      '/me/library?uris=' + encodeURIComponent(t.uri),
      wasSaved ? 'DELETE' : 'PUT',
    );
    return !wasSaved;
  },
  async saveCollection(collection) {
    await spotifyAPI(
      '/me/library?uris=' + encodeURIComponent(collection.uri),
      'PUT',
    );
  },
  async createPlaylist(name) {
    return parseCollection(
      await spotifyAPI('/me/playlists', 'POST', { name, public: false }),
      'playlist',
    );
  },
  async addToPlaylist(playlist, track) {
    await spotifyAPI(`/playlists/${playlist.id}/items`, 'POST', {
      uris: [track.uri],
    });
  },
};
