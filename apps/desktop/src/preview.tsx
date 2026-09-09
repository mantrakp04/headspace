import { formatTime, type Track } from '@headspace/spotify';
import type { LocalPlayback, PlaybackCommandArgs } from './bridge';

export type PreviewPlayer = {
  tracks: readonly Track[];
  readPlayback: () => LocalPlayback;
  command: (method: string, args?: PlaybackCommandArgs) => Promise<void>;
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
    <PlaylistTracks
      tracks={player.tracks}
      playback={playback}
      busy={busy}
      play={play}
      preview
    />
  );
}

export function PlaylistTracks({
  tracks,
  playback,
  busy,
  play,
  preview = false,
}: {
  tracks: readonly Track[];
  playback: LocalPlayback;
  busy: boolean;
  play: (track: Track) => void;
  preview?: boolean;
}) {
  const currentIndex = tracks.findIndex((track) => track.uri === playback.uri);
  return (
    <div className="preview-queue">
      <p className="preview-caption">
        {preview ? 'Spotify · Song previews' : 'Spotify'}
      </p>
      {tracks.map((track, index) => (
        <div
          key={`${track.uri}-${index}`}
          className={`preview-track ${index === currentIndex ? 'selected' : ''}`}
        >
          <button
            className="preview-track-play"
            aria-label={`${preview ? 'Play preview of' : 'Play'} ${track.name}`}
            aria-pressed={index === currentIndex && playback.playing}
            disabled={busy || (!preview && !track.playable)}
            onClick={() => play(track)}
          >
            <img src={track.image} alt="" width={24} height={24} />
            <span>
              <strong title={track.name}>{track.name}</strong>
              <small title={track.artist}>{track.artist}</small>
            </span>
            <span className="preview-track-time">
              {index === currentIndex && playback.playing
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
