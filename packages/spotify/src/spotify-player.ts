import type { JsonValue } from './json.ts';

export type WebPlayer = {
  getCurrentState(): Promise<JsonValue>;
  getVolume(): Promise<number>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(position: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  addListener(name: string, callback: (data: JsonValue) => void): void;
};
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume: number;
      }) => WebPlayer;
    };
  }
}
let sdkLoading: Promise<void> | null = null;
export function loadSDK() {
  if (window.Spotify) return Promise.resolve();
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      sdkLoading = null;
      reject(
        new Error(
          'The browser player could not load. You can still use an available Spotify device.',
        ),
      );
    }, 15000);
    window.onSpotifyWebPlaybackSDKReady = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      sdkLoading = null;
      reject(
        new Error(
          'The Spotify player failed to load. Check your connection or choose another device.',
        ),
      );
    };
    document.head.appendChild(script);
  });
  return sdkLoading;
}
