import { visualizerShader } from './visualizer-shader';
import { useEffect, useRef, useState } from 'react';
export const visualizations = [
  'Bars and waves',
  'Liquid chrome',
  'Aurora',
  'Blank screen',
  'Hyperspace',
  'Light ribbons',
  'Star flight',
];
export type VisualizerSettings = {
  speed: number;
  glow: number;
  hue: number;
  frozen: boolean;
};
export const defaultVisualizerSettings: VisualizerSettings = {
  speed: 1,
  glow: 1,
  hue: 0,
  frozen: false,
};
function CanvasVisualizer({
  mode,
  playing,
  bands,
  settings,
}: {
  mode: number;
  playing: boolean;
  bands: number[];
  settings: VisualizerSettings;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef({ mode, playing, bands, settings });
  useEffect(() => {
    current.current = { mode, playing, bands, settings };
  }, [mode, playing, bands, settings]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous = performance.now();
    let elapsed = 1;
    let lastState = '';
    function draw(now: number) {
      if (!ctx || !canvas) return;
      const { mode, playing, bands, settings } = current.current;
      const moving =
        !reduced.matches && !settings.frozen && !document.hidden && mode !== 3;
      if (moving)
        elapsed +=
          (Math.min(now - previous, 50) / 1600) *
          settings.speed *
          (playing ? 1 : 0.5);
      previous = now;
      const state = JSON.stringify([mode, playing, bands, settings]);
      if (document.hidden || (!moving && state === lastState)) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastState = state;
      const t = elapsed;
      ctx.filter = `hue-rotate(${settings.hue * 360}deg) brightness(${settings.glow})`;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 432, 316);
      if (mode === 0) {
        for (let i = 0; i < 44; i++) {
          const a = i / 44,
            x = 216 + Math.cos(a * Math.PI + Math.PI) * 158,
            y = 238 + Math.sin(a * Math.PI + Math.PI) * 24;
          const gain = 1 + (bands[Math.floor(i / 4.4)] ?? 0) / 20;
          const height =
            (24 +
              Math.pow(Math.sin(a * 5 + t * 1.5), 2) * 90 +
              Math.cos(a * 17 + t) * 25) *
            gain *
            (playing ? 1 : 0.7);
          ctx.strokeStyle = `hsl(${185 + a * 175} 95% ${55 + 10 * Math.sin(t + a)}%)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (x - 216) * 0.14, y - height);
          ctx.stroke();
        }
        ctx.strokeStyle = '#b443fa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 15; x < 418; x++) {
          const y =
            256 + Math.sin(x / 25 + t * 3) * 5 + Math.cos(x / 12 + t) * 2;
          if (x === 15) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (mode === 1 || mode === 2 || mode === 5) {
        for (let i = 0; i < 8; i++) {
          const phase = t * 0.45 + i * 0.65;
          ctx.strokeStyle = `hsla(${270 + i * 8} 100% 55% / .6)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let j = 0; j <= 180; j++) {
            const angle = (j / 180) * Math.PI * 2,
              radius = 58 + Math.sin(angle * 3 + phase) * 25;
            const x =
              216 + Math.cos(angle + phase * 0.2) * radius * (1.2 + i * 0.025);
            const y = 151 + Math.sin(angle + phase * 0.2) * radius;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (mode === 4 || mode === 6) {
        for (let i = 0; i < 130; i++) {
          const angle = i * 2.39996 + t * 0.12,
            distance = (i * 17 + t * 35) % 185,
            x = 216 + Math.cos(angle) * distance,
            y = 158 + Math.sin(angle) * distance * 0.68;
          ctx.strokeStyle = `hsl(${i * 7 + t * 50} 100% 70%)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(
            x + Math.cos(angle) * distance * 0.16,
            y + Math.sin(angle) * distance * 0.12,
          );
          ctx.stroke();
        }
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      data-renderer="canvas"
      ref={ref}
      width={432}
      height={316}
      aria-label={`${mode === 0 || mode === 3 ? visualizations[mode] : 'Compatible animation'} decorative animation, not an audio spectrum`}
    />
  );
}

export function Visualizer(props: {
  mode: number;
  playing: boolean;
  bands: number[];
  settings: VisualizerSettings;
}) {
  const [fallback, setFallback] = useState(false);
  return props.mode === 0 || props.mode === 3 || fallback ? (
    <CanvasVisualizer {...props} />
  ) : (
    <GPUVisualizer {...props} onFailure={() => setFallback(true)} />
  );
}
function GPUVisualizer({
  onFailure,
  ...props
}: {
  mode: number;
  playing: boolean;
  bands: number[];
  settings: VisualizerSettings;
  onFailure: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef(props);
  const fail = useRef(onFailure);
  useEffect(() => {
    current.current = props;
    fail.current = onFailure;
  }, [props, onFailure]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    let frame = 0;
    let cleanup = () => {};
    async function start() {
      const {
        init,
        surface,
        effect,
        frame: renderFrame,
      } = await import('vgpu');
      const gpu = await init({ powerPreference: 'low-power' });
      if (disposed) {
        gpu.dispose();
        return;
      }
      cleanup = () => gpu.dispose();
      gpu.onError(() => {
        if (!disposed) fail.current();
      });
      void gpu.gpu.lost.then(() => {
        if (!disposed) fail.current();
      });
      if (!canvas) return;
      const target = surface(gpu, canvas, {
        autoResize: false,
        size: [648, 474],
      });
      const shader = effect(gpu, visualizerShader, {
        set: {
          params: {
            time: 1,
            mode: 1,
            hue: 0,
            glow: 1,
            energy: 1,
            aspect: 216 / 158,
          },
        },
      });
      await shader.compile({ colors: [target.format] });
      if (disposed) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      let time = 1;
      let previous = performance.now();
      let lastState = '';
      function draw(now: number) {
        if (disposed) return;
        const { mode, playing, bands, settings } = current.current;
        const moving = !settings.frozen && !reduced.matches && !document.hidden;
        if (moving)
          time +=
            (Math.min(now - previous, 50) / 1000) *
            settings.speed *
            (playing ? 1 : 0.5);
        previous = now;
        const state = JSON.stringify([mode, bands, settings]);
        if (!document.hidden && (moving || state !== lastState)) {
          shader.set({
            params: {
              time,
              mode,
              hue: settings.hue,
              glow: settings.glow,
              energy: 1 + bands.reduce((a, b) => a + b, 0) / 140,
              aspect: 216 / 158,
            },
          });
          try {
            renderFrame(gpu, (currentFrame) =>
              currentFrame.pass(target, shader),
            );
          } catch {
            fail.current();
            return;
          }
          lastState = state;
        }
        frame = requestAnimationFrame(draw);
      }
      frame = requestAnimationFrame(draw);
    }
    void start().catch((error: unknown) => {
      console.warn('Headspace visualizer fallback', error);
      if (!disposed) fail.current();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, []);
  return (
    <canvas
      ref={ref}
      width={648}
      height={474}
      data-renderer="vgpu"
      aria-label={`${visualizations[props.mode]} generative visualization`}
    />
  );
}
