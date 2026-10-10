import type { Collection, Track } from '@headspace/spotify';
import type { PlaybackSelection } from '@headspace/spotify/selection';
import type { LocalPlayback, PlaybackCommandArgs } from './bridge';

export type Provider = 'spotify' | 'apple-music';
export type LibraryMode =
  | 'playlists'
  | 'albums'
  | 'artists'
  | 'shows'
  | 'liked'
  | 'recent'
  | 'search'
  | 'collection';
export type SearchKind = 'track' | 'album' | 'artist' | 'playlist' | 'show';
export type LibraryPage = {
  songs: Track[];
  collections: Collection[];
  // Collection URI that song rows play within, when the service supports it.
  context: string | null;
  // Remaining pages that song-list playback should include.
  continuation: string | null;
  // Page loaded by the library's More button.
  next: string | null;
};
export type QueueSnapshot = { current: Track | null; items: Track[] };
export type DeviceOption = { id: string; name: string; active: boolean };

export type MusicService = {
  provider: Provider;
  name: string;
  likedLabel: string;
  requirement: string;
  podcasts: boolean;
  devices: boolean;
  queueURL: string;
  restore(): Promise<boolean>;
  // Resolves connected=false when sign-in continues in the browser.
  connect(): Promise<{ connected: boolean; authURL: string }>;
  // Signs out and forgets the saved session.
  disconnect(): Promise<void>;
  start(): Promise<void>;
  // Releases the player without signing out, before switching services.
  stop(): void;
  profile(): Promise<{ name: string; playlists: Collection[] }>;
  library(
    mode: LibraryMode,
    search: string,
    kind: SearchKind,
    collection: Collection | null,
    more?: string,
  ): Promise<LibraryPage>;
  play(selection: PlaybackSelection): Promise<void>;
  command(method: string, args?: PlaybackCommandArgs): Promise<void>;
  readPlayback(): Promise<LocalPlayback>;
  queue(): Promise<QueueSnapshot>;
  listDevices(): Promise<DeviceOption[]>;
  transfer(device: string, play: boolean): Promise<void>;
  // Returns whether the track is saved afterwards.
  toggleSaved(track: Track, saved: boolean): Promise<boolean>;
  saveCollection(collection: Collection): Promise<void>;
  createPlaylist(name: string): Promise<Collection | null>;
  addToPlaylist(playlist: Collection, track: Track): Promise<void>;
};

const providerKey = 'headspace.provider';

export function storedProvider(): Provider {
  return localStorage.getItem(providerKey) === 'apple-music'
    ? 'apple-music'
    : 'spotify';
}

export function storeProvider(provider: Provider) {
  localStorage.setItem(providerKey, provider);
}
