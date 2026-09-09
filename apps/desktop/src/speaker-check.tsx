import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Speakers } from './speakers';
import { useAudioCapture } from './audio';
import { silentAudioFrame } from './audio-frame';

window.headspaceNative = {
  request: () => Promise.resolve(true),
  openAuth: () => Promise.resolve(),
};

function Check() {
  useAudioCapture(true, 0);
  const [drive, setDrive] = useState<'silence' | 'held' | 'pulse'>('silence');
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => {
      const phase = ((performance.now() - start) % 500) / 500;
      const bass =
        drive === 'silence'
          ? 0
          : drive === 'held'
            ? 0.22
            : 0.22 * Math.exp(-phase * 8);
      window.dispatchEvent(
        new CustomEvent('headspace-audio', {
          detail: { ...silentAudioFrame, bass, rms: bass, peak: bass },
        }),
      );
    }, 25);
    return () => window.clearInterval(timer);
  }, [drive]);
  return (
    <main>
      <style>{`body { margin:0; background:#191919; color:#eee; font:14px system-ui; } main { padding:24px; } button { padding:10px 16px; margin:0 8px 16px 0; } .pairs { display:flex; gap:32px; } section { width:408px; } .speakers { position:relative; width:272px; height:170px; transform:scale(1.5); transform-origin:top left; } .speaker-cones, .ear { position:absolute; top:0; pointer-events:none; } h2 { font-size:16px; font-weight:500; } output { display:block; margin:100px 0 0; }`}</style>
      <h1>Speaker motion at 150%</h1>
      <p>
        Silent fixture. The controls feed test bass levels through the
        production audio bridge.
      </p>
      <button onClick={() => setDrive('silence')}>Silence</button>
      <button onClick={() => setDrive('held')}>Hold bass</button>
      <button onClick={() => setDrive('pulse')}>Bass pulses</button>
      <button
        onClick={() => {
          setFrozen(false);
          setDrive('held');
          window.setTimeout(() => setFrozen(true), 75);
        }}
      >
        Freeze a bass hit
      </button>
      <button onClick={() => setFrozen(!frozen)}>
        {frozen ? 'Resume' : 'Freeze'}
      </button>
      <div className="pairs">
        <section>
          <h2>At rest</h2>
          <div className="speakers">
            <img
              aria-hidden="true"
              className="ear"
              src="/skin/left_ear.png"
              width="84"
              height="170"
              alt=""
            />

            <img
              aria-hidden="true"
              className="ear"
              style={{ left: 185 }}
              src="/skin/right_ear.png"
              width="87"
              height="170"
              alt=""
            />
          </div>
        </section>
        <section>
          <h2>Live bass</h2>
          <div className="speakers">
            <img
              aria-hidden="true"
              className="ear"
              src="/skin/left_ear.png"
              width="84"
              height="170"
              alt=""
            />
            <Speakers side="left" frozen={frozen} />
            <img
              aria-hidden="true"
              className="ear"
              style={{ left: 185 }}
              src="/skin/right_ear.png"
              width="87"
              height="170"
              alt=""
            />
            <Speakers side="right" frozen={frozen} />
          </div>
        </section>
      </div>
      <output>
        {drive} · {frozen ? 'frozen' : 'live'}
      </output>
    </main>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Check />);
