import {
  accessToken,
  hasSession,
  list,
  object,
  string,
} from '../../lib/spotify.ts';
import { loadSDK, type WebPlayer } from '../../lib/spotify-player.ts';
import {
  resolvePlayback,
  nextRepeat,
  sdkRepeat,
  type PlaybackSelection,
} from '../../lib/playback-selection.ts';
import { persistSession, spotifyAPI, type LocalPlayback } from './bridge.ts';

let player: WebPlayer | null = null;
let connecting: Promise<WebPlayer> | null = null;
let deviceId = '';
let generation = 0;
let cancelConnection: (() => void) | null = null;

function report(message: string) {
  window.dispatchEvent(
    new CustomEvent('headspace-player-error', { detail: message }),
  );
}

export function disconnectPlayer() {
  generation += 1;
  cancelConnection?.();
  cancelConnection = null;
  const previous = player;
  player = null;
  previous?.disconnect();
  player = null;
  connecting = null;
  deviceId = '';
}

export function startPlayer(): Promise<WebPlayer> {
  if (player && deviceId) return Promise.resolve(player);
  if (connecting) return connecting;
  if (!hasSession())
    return Promise.reject(
      new Error('Connect Spotify to play music in Headspace.'),
    );
  player?.disconnect();
  player = null;
  const current = generation;
  const connection = (async () => {
    await loadSDK();
    if (current !== generation)
      throw new Error('Playback connection cancelled.');
    if (!window.Spotify) throw new Error('Spotify player did not load.');
    const instance = new window.Spotify.Player({
      name: 'Headspace',
      volume: Math.max(
        0,
        Math.min(
          1,
          Number(localStorage.getItem('headspace.volume') ?? '0.5') || 0,
        ),
      ),
      getOAuthToken: (callback) => {
        void accessToken()
          .then(async (token) => {
            if (current !== generation) return;
            callback(token);
            await persistSession();
          })
          .catch((error) =>
            report(
              error instanceof Error
                ? error.message
                : 'Spotify sign-in expired.',
            ),
          );
      },
    });
    player = instance;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () =>
          reject(
            new Error(
              'Headspace could not connect its audio player. Reconnect Spotify in Account.',
            ),
          ),
        20000,
      );
      cancelConnection = () => {
        clearTimeout(timeout);
        reject(new Error('Playback connection cancelled.'));
      };
      const fail = (message: string) => {
        if (current !== generation) return;
        clearTimeout(timeout);
        reject(new Error(message));
        report(message);
      };
      instance.addListener('ready', (data) => {
        if (current !== generation) return;
        deviceId = string(object(data).device_id);
        clearTimeout(timeout);
        resolve();
      });
      instance.addListener('not_ready', () => {
        if (current !== generation) return;
        deviceId = '';
        report('Headspace audio disconnected. Retry playback in Account.');
      });
      instance.addListener('player_state_changed', () => {
        if (current === generation)
          window.dispatchEvent(new Event('headspace-playback-changed'));
      });
      instance.addListener('initialization_error', (data) =>
        fail('Audio initialization: ' + string(object(data).message)),
      );
      instance.addListener('authentication_error', () =>
        fail(
          'Reconnect Spotify in Account to allow playback inside Headspace.',
        ),
      );
      instance.addListener('account_error', (data) =>
        fail(
          string(object(data).message) ||
            'Spotify Premium is required for playback.',
        ),
      );
      instance.addListener('playback_error', (data) =>
        report(
          string(object(data).message) || 'Spotify could not play this track.',
        ),
      );
      void instance
        .connect()
        .then((ok) => {
          if (!ok) fail('The embedded Spotify player could not connect.');
        })
        .catch((error) => fail(String(error)));
    });
    return instance;
  })();
  connecting = connection;
  void connection.then(
    () => {
      if (current === generation) {
        connecting = null;
        cancelConnection = null;
      }
    },
    () => {
      if (current === generation) disconnectPlayer();
    },
  );
  return connection;
}

export async function readPlayback(): Promise<LocalPlayback> {
  const instance = player;
  const state = instance ? object(await instance.getCurrentState()) : {};
  const track = object(object(state.track_window).current_track);
  return {
    running: Boolean(deviceId),
    playing: state.paused === false,
    volume: instance ? Math.round((await instance.getVolume()) * 100) : 50,
    position: typeof state.position === 'number' ? state.position : 0,
    shuffle: state.shuffle === true,
    repeat: sdkRepeat(state.repeat_mode),
    name: string(track.name),
    uri: string(track.uri),
    artist: list(track.artists)
      .map((a) => string(object(a).name))
      .join(', '),
    album: string(object(track.album).name),
    duration: typeof state.duration === 'number' ? state.duration : 0,
    image: string(object(list(object(track.album).images)[0]).url),
  };
}

export async function playSelection(selection: PlaybackSelection) {
  const current = generation;
  const instance = await startPlayer();
  await instance.activateElement();
  const body = await resolvePlayback(selection, spotifyAPI);
  if (current !== generation) throw new Error('Playback connection cancelled.');
  await spotifyAPI(
    '/me/player/play?device_id=' + encodeURIComponent(deviceId),
    'PUT',
    body,
  );
  window.dispatchEvent(new Event('headspace-playback-changed'));
}

export async function playbackCommand(
  method: string,
  args: Record<string, unknown> = {},
) {
  if (method === 'reconnect') disconnectPlayer();
  const instance = await startPlayer();
  await instance.activateElement();
  const device = '?device_id=' + encodeURIComponent(deviceId);
  switch (method) {
    case 'reconnect':
      return;
    case 'enqueue': {
      if (
        typeof args.uri !== 'string' ||
        !/^spotify:(track|episode):[a-zA-Z0-9]+$/.test(args.uri)
      )
        throw new Error('Invalid track.');
      const state = object(await instance.getCurrentState());
      if (!string(object(object(state.track_window).current_track).uri))
        throw new Error('Play a song in Headspace before adding to its queue.');
      await spotifyAPI(
        '/me/player/queue' + device + '&uri=' + encodeURIComponent(args.uri),
        'POST',
      );
      window.dispatchEvent(new Event('headspace-playback-changed'));
      return;
    }
    case 'play':
      return instance.resume();
    case 'pause':
      return instance.pause();
    case 'toggle':
      return instance.togglePlay();
    case 'stop':
      await instance.pause();
      return instance.seek(0);
    case 'previous':
      return instance.previousTrack();
    case 'next':
      return instance.nextTrack();
    case 'volume':
    case 'seek': {
      if (typeof args.value !== 'number' || !Number.isFinite(args.value))
        throw new Error('Invalid playback value.');
      if (method === 'seek')
        return instance.seek(Math.max(0, args.value) * 1000);
      const volume = Math.min(100, Math.max(0, args.value)) / 100;
      await instance.setVolume(volume);
      localStorage.setItem('headspace.volume', String(volume));
      return;
    }
    case 'shuffle': {
      const state = object(await instance.getCurrentState());
      return spotifyAPI(
        '/me/player/shuffle' +
          device +
          '&state=' +
          String(state.shuffle !== true),
        'PUT',
      );
    }
    case 'repeat': {
      const state = object(await instance.getCurrentState());
      return spotifyAPI(
        '/me/player/repeat' +
          device +
          '&state=' +
          nextRepeat(sdkRepeat(state.repeat_mode)),
        'PUT',
      );
    }
    default:
      throw new Error('Unknown playback command.');
  }
}
