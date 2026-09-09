import type {
  LocalPlayback,
  PlaybackCommandArgs,
} from '../../desktop/src/bridge';
import type { PreviewPlayer } from '../../desktop/src/preview';
import { analyseSamples } from '../../desktop/src/analyser-frame.ts';
import { silentAudioFrame } from '../../desktop/src/audio-frame.ts';
import { setPreviewAudioSource } from '../../desktop/src/audio.ts';
import { previewTracks } from './preview-tracks.ts';

export function createPreviewPlayer(): PreviewPlayer & {
  mount: () => () => void;
} {
  let track = previewTracks[0];
  function createAudio() {
    const element = new Audio();
    element.crossOrigin = 'anonymous';
    element.preload = 'none';
    element.src = track.previewURL;
    return element;
  }
  let audio = createAudio();
  let volume = 50;
  let graph: {
    context: AudioContext;
    source: MediaElementAudioSourceNode;
    gain: GainNode;
    analyser: AnalyserNode;
    frequencies: Uint8Array<ArrayBuffer>;
    samples: Float32Array<ArrayBuffer>;
  } | null = null;
  let active = false;
  let playbackRequest = 0;

  const changed = () =>
    window.dispatchEvent(new Event('headspace-playback-changed'));
  const report = () =>
    window.dispatchEvent(
      new CustomEvent('headspace-player-error', {
        detail: `The preview for ${track.name} could not play. Try again, skip to another song, or open it on Spotify.`,
      }),
    );

  function readPlayback(): LocalPlayback {
    return {
      ...track,
      running: true,
      playing: !audio.paused && !audio.ended,
      position: audio.currentTime * 1000,
      duration: Number.isFinite(audio.duration)
        ? audio.duration * 1000
        : track.duration,
      volume,
      shuffle: false,
      repeat: 'off',
    };
  }

  async function play() {
    if (!active) return;
    const request = ++playbackRequest;
    if (!graph) {
      const context = new AudioContext();
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.65;
      gain.gain.value = volume / 100;
      source.connect(gain).connect(analyser).connect(context.destination);
      graph = {
        context,
        source,
        gain,
        analyser,
        frequencies: new Uint8Array(analyser.frequencyBinCount),
        samples: new Float32Array(analyser.fftSize),
      };
    }
    if (audio.ended) audio.currentTime = 0;
    if (audio.error) audio.load();
    try {
      await Promise.all([graph.context.resume(), audio.play()]);
    } catch (error) {
      if (!active || request !== playbackRequest) return;
      audio.pause();
      if (error instanceof DOMException && error.name === 'NotAllowedError')
        throw new DOMException(
          'Click anywhere to allow preview audio in your browser.',
          'NotAllowedError',
        );
      throw new Error(
        `The preview for ${track.name} is unavailable. Try another song or open it on Spotify.`,
      );
    }
  }

  async function playTrack(uri: string) {
    const next = previewTracks.find((item) => item.uri === uri);
    if (!next) throw new Error('This song is not in the demo queue.');
    audio.pause();
    track = next;
    audio.src = track.previewURL;
    changed();
    await play();
  }

  async function command(method: string, args: PlaybackCommandArgs = {}) {
    switch (method) {
      case 'play':
        return play();
      case 'toggle':
        if (audio.paused || audio.ended) return play();
        playbackRequest += 1;
        audio.pause();
        return;
      case 'pause':
        playbackRequest += 1;
        audio.pause();
        return;
      case 'stop':
        playbackRequest += 1;
        audio.pause();
        audio.currentTime = 0;
        changed();
        return;
      case 'next':
      case 'previous': {
        const offset = method === 'next' ? 1 : -1;
        const index =
          (previewTracks.indexOf(track) + offset + previewTracks.length) %
          previewTracks.length;
        return playTrack(previewTracks[index].uri);
      }
      case 'volume':
      case 'seek': {
        if (args.value === undefined || !Number.isFinite(args.value))
          throw new Error('Invalid playback value.');
        if (method === 'volume') {
          volume = Math.max(0, Math.min(100, args.value));
          if (graph) graph.gain.gain.value = volume / 100;
        } else {
          const duration = readPlayback().duration / 1000;
          audio.currentTime = Math.max(0, Math.min(duration, args.value));
        }
        changed();
        return;
      }
      default:
        throw new Error('This control is available in Headspace for Mac.');
    }
  }

  function ended() {
    const next = previewTracks[previewTracks.indexOf(track) + 1];
    if (next) void playTrack(next.uri).catch(report);
    else changed();
  }

  function mount() {
    active = true;
    let previous = -Infinity;
    let frame = silentAudioFrame;
    setPreviewAudioSource(() => {
      if (
        !graph ||
        audio.paused ||
        audio.ended ||
        graph.context.state !== 'running' ||
        volume === 0
      )
        return silentAudioFrame;
      const now = performance.now();
      if (now - previous < 1000 / 60) return frame;
      previous = now;
      graph.analyser.getByteFrequencyData(graph.frequencies);
      graph.analyser.getFloatTimeDomainData(graph.samples);
      frame = analyseSamples(
        graph.frequencies,
        graph.samples,
        graph.context.sampleRate,
      );
      return frame;
    });
    const events = [
      'playing',
      'pause',
      'timeupdate',
      'loadedmetadata',
      'emptied',
    ];
    events.forEach((event) => audio.addEventListener(event, changed));
    audio.addEventListener('ended', ended);
    audio.addEventListener('error', report);
    window.addEventListener('pagehide', stop);
    const interactionTargets = new Set([window, window.parent]);
    const disarmAutoplay = () => {
      interactionTargets.forEach((target) => {
        target.removeEventListener('pointerdown', startOnInteraction);
        target.removeEventListener('keydown', startOnInteraction);
      });
    };
    const startOnInteraction = (event: Event) => {
      disarmAutoplay();
      if (
        event.target instanceof Element &&
        event.target.closest(
          '.preview-track-play, button[aria-label="Play"], button[aria-label="Pause"], button[aria-label="Stop"], button[aria-label="Next"], button[aria-label="Previous"]',
        )
      ) {
        void graph?.context.resume();
        return;
      }
      void play().catch(report);
    };
    interactionTargets.forEach((target) => {
      target.addEventListener('pointerdown', startOnInteraction);
      target.addEventListener('keydown', startOnInteraction);
    });
    void play()
      .then(disarmAutoplay)
      .catch((cause: unknown) => {
        if (!active) return;
        if (
          !(cause instanceof DOMException && cause.name === 'NotAllowedError')
        ) {
          disarmAutoplay();
          report();
        }
      });
    changed();
    function stop() {
      audio.pause();
    }
    return () => {
      active = false;
      playbackRequest += 1;
      disarmAutoplay();
      stop();
      setPreviewAudioSource(null);
      events.forEach((event) => audio.removeEventListener(event, changed));
      audio.removeEventListener('ended', ended);
      audio.removeEventListener('error', report);
      window.removeEventListener('pagehide', stop);
      audio.removeAttribute('src');
      audio.load();
      if (graph) {
        graph.source.disconnect();
        graph.gain.disconnect();
        graph.analyser.disconnect();
        void graph.context.close();
        graph = null;
      }
      audio = createAudio();
    };
  }

  return { tracks: previewTracks, readPlayback, command, playTrack, mount };
}
