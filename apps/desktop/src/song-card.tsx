import { useState } from 'react';
import type { LocalPlayback } from './bridge';

export function SongCard({ playback }: { playback: LocalPlayback }) {
  const [introducing, setIntroducing] = useState(true);
  return (
    <output
      className={`song-card ${introducing ? 'song-card-intro' : ''}`}
      onAnimationEnd={() => setIntroducing(false)}
    >
      {playback.image ? (
        <img src={playback.image} alt="" width={52} height={52} />
      ) : (
        <span className="song-card-placeholder" aria-hidden="true">
          ♫
        </span>
      )}
      <div className="song-card-copy">
        <span className="song-card-caption">Now playing</span>
        <strong title={playback.name}>{playback.name}</strong>
        <span title={playback.artist}>{playback.artist}</span>
      </div>
    </output>
  );
}
