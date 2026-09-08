import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Track } from '../../lib/spotify';
import { TrackRows } from './media-tables';
import './skin.css';
const tracks: Track[] = Array.from({ length: 10000 }, (_, i) => ({
  id: String(i),
  uri: 'spotify:track:benchmark' + i,
  name: 'Track ' + String(i + 1).padStart(5, '0'),
  artist: 'Benchmark artist',
  album: 'Benchmark',
  image: '',
  duration: 180000,
  url: '',
  playable: true,
}));
const saved = new Set<string>();
function Benchmark() {
  const [current, setCurrent] = useState<Track | null>(null);
  const [duplicates, setDuplicates] = useState(false);
  const [small, setSmall] = useState(false);
  return (
    <main style={{ background: '#c6c8b7', height: '100vh', padding: 30 }}>
      <h1>10,000-track virtualization check</h1>
      <button onClick={() => setSmall((v) => !v)}>Switch dataset</button>
      <button
        onClick={() => {
          setDuplicates((v) => !v);
          setCurrent(tracks[0]);
        }}
      >
        Duplicate history check
      </button>
      <output>{current?.name || 'No track selected'}</output>
      <div
        style={{
          width: 760,
          height: 280,
          background: '#285f03',
          color: '#cee6a6',
        }}
      >
        <TrackRows
          key={String(small)}
          items={
            duplicates
              ? Array.from({ length: 20 }, (_, i) => tracks[i % 3])
              : small
                ? tracks.slice(0, 20)
                : tracks
          }
          currentURI={current?.uri || ''}
          playing={duplicates}
          busy={false}
          saved={saved}
          playSong={setCurrent}
          like={() => Promise.resolve()}
          addQueue={() => Promise.resolve()}
          setAdding={() => {}}
        />
      </div>
    </main>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Benchmark />);
