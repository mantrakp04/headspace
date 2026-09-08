'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  playbackWindow,
  accessToken,
  api,
  disconnect,
  finishAuthorization,
  hasSession,
  list,
  object,
  parseDevice,
  parsePlayback,
  string,
  type Device,
  type Playback,
  type Track,
} from '@/lib/spotify';

type WebPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  addListener(name: string, callback: (data: unknown) => void): void;
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
const emptyPlayback = (): Playback => ({
  track: null,
  playing: false,
  progress: 0,
  shuffle: false,
  repeat: 'off',
  device: null,
  updatedAt: Date.now(),
});
let sdkLoading: Promise<void> | null = null;
function loadSDK() {
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
export function useSpotify() {
  const [connected, setConnected] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [playback, setPlayback] = useState<Playback>(emptyPlayback);
  const [browserDevice, setBrowserDevice] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<WebPlayer | null>(null);
  const commandRef = useRef(false);
  const refreshRef = useRef(false);
  const report = useCallback((e: unknown) => {
    setError(
      e instanceof Error
        ? e.message
        : 'Something went wrong. Please try again.',
    );
    if (!hasSession()) setConnected(false);
  }, []);
  const refresh = useCallback(async () => {
    if (refreshRef.current) return;
    refreshRef.current = true;
    try {
      const data = await api('/me/player');
      setPlayback(parsePlayback(data));
    } finally {
      refreshRef.current = false;
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    finishAuthorization()
      .then(async (ok) => {
        if (cancelled) return;
        setConnected(ok);
        if (ok) {
          const me = object(await api('/me'));
          if (!cancelled) setName(string(me.display_name));
        }
      })
      .catch((e) => {
        if (!cancelled) report(e);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report]);
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    loadSDK()
      .then(async () => {
        if (cancelled || !window.Spotify) return;
        const player = new window.Spotify.Player({
          name: 'Sunroom',
          getOAuthToken: (cb) => {
            accessToken().then(cb).catch(report);
          },
          volume: 0.5,
        });
        playerRef.current = player;
        player.addListener('ready', (d) => {
          if (!cancelled) setBrowserDevice(string(object(d).device_id));
        });
        player.addListener('not_ready', () => {
          if (!cancelled) setBrowserDevice('');
        });
        player.addListener('player_state_changed', () => {
          if (!cancelled) void refresh().catch(report);
        });
        for (const event of [
          'initialization_error',
          'authentication_error',
          'account_error',
          'playback_error',
        ])
          player.addListener(event, (d) => {
            if (!cancelled)
              setError(
                string(object(d).message) ||
                  'Spotify browser playback is unavailable. Choose another device.',
              );
          });
        player.addListener('autoplay_failed', () => {
          if (!cancelled)
            setError(
              'Your browser needs a click to allow audio. Press play again.',
            );
        });
        const ok = await player.connect();
        if (!ok && !cancelled)
          setError(
            'Browser audio is unavailable here. Open Sunroom in Chrome or Safari, or select your Spotify app in Devices.',
          );
      })
      .catch((e) => {
        if (!cancelled) report(e);
      });
    void refresh().catch(report);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh().catch(report);
    }, 15000);
    const onVisible = () => {
      if (!document.hidden) void refresh().catch(report);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      playerRef.current?.disconnect();
      playerRef.current = null;
      setBrowserDevice('');
    };
  }, [connected, refresh, report]);
  const command = useCallback(
    async (action: () => Promise<unknown>) => {
      if (commandRef.current) return false;
      commandRef.current = true;
      setBusy(true);
      setError('');
      try {
        await action();
        await refresh();
        return true;
      } catch (e) {
        report(e);
        return false;
      } finally {
        commandRef.current = false;
        setBusy(false);
      }
    },
    [refresh, report],
  );
  const target = playback.device?.id || browserDevice;
  const deviceQuery = target ? '?device_id=' + encodeURIComponent(target) : '';
  async function play(track?: Track, context?: string, trackList?: Track[]) {
    if (!connected) return false;
    if (track && !track.playable) {
      setError('This track is not available for playback on this account.');
      return false;
    }
    const activation =
      target === browserDevice
        ? playerRef.current?.activateElement()
        : undefined;
    return command(async () => {
      if (target === browserDevice) await activation;
      if (!target)
        throw new Error(
          'Choose an available Spotify device, or wait for the browser player to finish connecting.',
        );
      const body = context
        ? {
            context_uri: context,
            ...(track ? { offset: { uri: track.uri } } : {}),
          }
        : track
          ? {
              uris: playbackWindow(track, trackList),
              offset: { uri: track.uri },
            }
          : undefined;
      await api('/me/player/play' + deviceQuery, 'PUT', body);
    });
  }
  async function loadDevices() {
    try {
      const d = object(await api('/me/player/devices'));
      setDevices(
        list(d.devices).flatMap((v) => {
          const p = parseDevice(v);
          return p ? [p] : [];
        }),
      );
    } catch (e) {
      report(e);
    }
  }
  return {
    connected,
    initializing,
    name,
    error,
    setError,
    report,
    playback,
    browserDevice,
    devices,
    busy,
    refresh,
    play,
    command,
    toggle: () =>
      playback.playing
        ? command(() => api('/me/player/pause' + deviceQuery, 'PUT'))
        : play(),
    pause: () => command(() => api('/me/player/pause' + deviceQuery, 'PUT')),
    skip: (direction: 'next' | 'previous') =>
      command(() => api('/me/player/' + direction + deviceQuery, 'POST')),
    seek: (ms: number) =>
      command(() =>
        api(
          '/me/player/seek?position_ms=' +
            Math.round(ms) +
            (target ? '&device_id=' + encodeURIComponent(target) : ''),
          'PUT',
        ),
      ),
    shuffle: () =>
      command(() =>
        api(
          '/me/player/shuffle?state=' +
            !playback.shuffle +
            (target ? '&device_id=' + encodeURIComponent(target) : ''),
          'PUT',
        ),
      ),
    repeat: () =>
      command(() =>
        api(
          '/me/player/repeat?state=' +
            (playback.repeat === 'off'
              ? 'context'
              : playback.repeat === 'context'
                ? 'track'
                : 'off') +
            (target ? '&device_id=' + encodeURIComponent(target) : ''),
          'PUT',
        ),
      ),
    volume: (value: number) =>
      command(() =>
        target === browserDevice && playerRef.current
          ? playerRef.current.setVolume(value / 100)
          : api(
              '/me/player/volume?volume_percent=' +
                Math.round(value) +
                (target ? '&device_id=' + encodeURIComponent(target) : ''),
              'PUT',
            ),
      ),
    transfer: (id: string) =>
      command(async () => {
        if (id === browserDevice) await playerRef.current?.activateElement();
        await api('/me/player', 'PUT', {
          device_ids: [id],
          play: playback.playing,
        });
        await loadDevices();
      }),
    loadDevices,
    logout: () => {
      disconnect();
      setConnected(false);
      setName('');
      setPlayback(emptyPlayback());
      setDevices([]);
      setError('');
    },
  };
}
