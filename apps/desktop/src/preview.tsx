import { formatTime, type Track } from '@headspace/spotify';
import type { LocalPlayback } from './bridge';

export type PreviewPlayer = {
  tracks: readonly Track[];
  readPlayback: () => LocalPlayback;
  command: (method: string, args?: Record<string, unknown>) => Promise<void>;
  playTrack: (uri: string) => Promise<void>;
};

export function PreviewQueue({
  player,
  playback,
  busy,
  play,
}: {
  player: PreviewPlayer;
  playback: LocalPlayback;
  busy: boolean;
  play: (track: Track) => void;
}) {
  return (
    <div className="preview-queue">
      <p className="preview-caption">Spotify · Song previews</p>
      {player.tracks.map((track) => (
        <div
          key={track.uri}
          className={`preview-track ${playback.uri === track.uri ? 'selected' : ''}`}
        >
          <button
            className="preview-track-play"
            aria-label={`Play preview of ${track.name}`}
            aria-pressed={playback.uri === track.uri && playback.playing}
            disabled={busy}
            onClick={() => play(track)}
          >
            <img src={track.image} alt="" width={24} height={24} />
            <span>
              <strong title={track.name}>{track.name}</strong>
              <small title={track.artist}>{track.artist}</small>
            </span>
            <span className="preview-track-time">
              {playback.uri === track.uri && playback.playing
                ? '▶'
                : formatTime(track.duration)}
            </span>
          </button>
          <a
            href={track.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${track.name} on Spotify`}
            title="Listen on Spotify"
          >
            ↗
          </a>
        </div>
      ))}
      <output className="preview-caption">
        {playback.playing
          ? 'Playing'
          : playback.position > 0
            ? 'Paused'
            : 'Ready'}{' '}
        · {formatTime(playback.position)} / {formatTime(playback.duration)}
      </output>
    </div>
  );
}
