import type { JsonObject, JsonValue } from '@headspace/spotify';

export type MediaItem = {
  id: string;
  type: string;
  attributes?: JsonObject;
};

export type PlaybackQueue = {
  readonly items: readonly MediaItem[];
  readonly position: number;
};

export type QueueOptions = {
  album?: string;
  playlist?: string;
  songs?: string[];
  // Queue index, or a song ID within an album or playlist.
  startWith?: number | string;
  startPlaying?: boolean;
};

export type MusicKitInstance = {
  readonly isAuthorized: boolean;
  readonly musicUserToken: string;
  readonly developerToken: string;
  readonly storefrontId: string;
  readonly isPlaying: boolean;
  readonly currentPlaybackTime: number;
  readonly currentPlaybackDuration: number;
  readonly nowPlayingItem: MediaItem | undefined;
  readonly queue: PlaybackQueue;
  volume: number;
  // 0 off, 1 songs.
  shuffleMode: number;
  // 0 none, 1 one, 2 all.
  repeatMode: number;
  authorize(): Promise<string>;
  unauthorize(): Promise<void>;
  setQueue(options: QueueOptions): Promise<JsonValue>;
  playLater(options: QueueOptions): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  skipToNextItem(): Promise<void>;
  skipToPreviousItem(): Promise<void>;
  seekToTime(seconds: number): Promise<void>;
  addEventListener(name: string, callback: () => void): void;
  removeEventListener(name: string, callback: () => void): void;
};

declare global {
  interface Window {
    MusicKit?: {
      configure(options: {
        developerToken: string;
        app: { name: string; build: string };
      }): Promise<MusicKitInstance>;
      getInstance(): MusicKitInstance | undefined;
    };
  }
}

export const scriptURL =
  'https://js-cdn.music.apple.com/musickit/v3/musickit.js';

let loading: Promise<void> | null = null;
export function loadMusicKit(): Promise<void> {
  if (window.MusicKit) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const fail = (message: string) => {
      window.clearTimeout(timer);
      script.remove();
      loading = null;
      reject(new Error(message));
    };
    const timer = window.setTimeout(
      () => fail('Apple Music could not load. Check your connection.'),
      15000,
    );
    document.addEventListener(
      'musickitloaded',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    const script = document.createElement('script');
    script.src = scriptURL;
    script.async = true;
    script.onerror = () =>
      fail('Apple Music failed to load. Check your connection and try again.');
    document.head.appendChild(script);
  });
  return loading;
}
