import { useEffect, useRef, useState } from 'react';
import { readAudioFrame, type AudioFrame } from './audio';
import { visualizerShader } from './visualizer-shader';

export const visualizations = [
  'Bars and waves',
  'Liquid chrome',
  'Aurora',
  'Blank screen',
  'Hyperspace',
  'Light ribbons',
  'Star flight',
  'Spectral bloom',
  'Oscilloscope',
  'Spectrogram',
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
type VisualizerProps = {
  mode: number;
  playing: boolean;
  bands: number[];
  settings: VisualizerSettings;
};
type CanvasScene = {
  ctx: CanvasRenderingContext2D;
  audio: AudioFrame;
  spectrum: number[];
  time: number;
};

function bars({ ctx, audio, spectrum }: CanvasScene) {
  for (let i = 0; i < 56; i++) {
    const level = spectrum[i] ?? 0;
    const height = level * 178;
    const x = 20 + i * 7;
    const gradient = ctx.createLinearGradient(0, 240 - height, 0, 242);
    gradient.addColorStop(0, `hsl(${172 + i * 2.8} 90% 74%)`);
    gradient.addColorStop(1, `hsl(${205 + i * 2.2} 80% 32%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, 240 - height, 4, Math.max(1, height));
    ctx.globalAlpha = 0.13;
    ctx.fillRect(x, 244, 4, height * 0.19);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = '#aa93dc';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  audio.waveform.forEach((value, i) => {
    const x = 20 + (i / (audio.waveform.length - 1)) * 390;
    const y = 280 - value * 20;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function bloom({ ctx, audio, spectrum, time }: CanvasScene) {
  const radius = 62 + Math.sqrt(audio.bass) * 24;
  const halo = ctx.createRadialGradient(216, 158, radius * 0.7, 216, 158, 148);
  halo.addColorStop(0, `rgba(51,84,147,${0.07 + Math.sqrt(audio.rms) * 0.22})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 432, 316);
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2 - Math.PI / 2;
      const folded = i <= 64 ? i : 128 - i;
      const amplitude = spectrum[Math.min(63, folded)] ?? 0;
      const r = radius + layer * 9 + amplitude * (88 - layer * 18);
      const x = 216 + Math.cos(a + time * 0.035) * r;
      const y = 158 + Math.sin(a + time * 0.035) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = ['#87efe0', '#8994f8', '#ee97dd'][layer] ?? '#fff';
    ctx.globalAlpha = 0.95 - layer * 0.16;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 5 + audio.treble * 8;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  for (let i = 0; i < 64; i++) {
    const amplitude = spectrum[i] ?? 0;
    const angle = (i / 64) * Math.PI * 2 - Math.PI / 2 + time * 0.035;
    const inner = radius + 30;
    const outer = inner + amplitude * 65;
    ctx.strokeStyle = `hsla(${168 + i * 2.5} 85% 76% / ${amplitude * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(216 + Math.cos(angle) * inner, 158 + Math.sin(angle) * inner);
    ctx.lineTo(216 + Math.cos(angle) * outer, 158 + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(189,220,234,${0.25 + audio.bass * 0.6})`;
  ctx.beginPath();
  ctx.arc(216, 158, 2 + audio.bass * 4, 0, Math.PI * 2);
  ctx.fill();
}

function scope({ ctx, audio }: CanvasScene) {
  ctx.strokeStyle = '#112826';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 24; x <= 408; x += 24) {
    ctx.moveTo(x, 38);
    ctx.lineTo(x, 278);
  }
  for (let y = 38; y <= 278; y += 24) {
    ctx.moveTo(24, y);
    ctx.lineTo(408, y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#24443e';
  ctx.beginPath();
  ctx.moveTo(24, 158);
  ctx.lineTo(408, 158);
  ctx.stroke();
  ctx.beginPath();
  audio.waveform.forEach((value, i) => {
    const x = 24 + (i / (audio.waveform.length - 1)) * 384;
    const y = 158 - value * 100;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#9afbd2';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = '#4ce5a8';
  ctx.shadowBlur = 7;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#6ca290';
  ctx.font = '10px monospace';
  ctx.fillText('OUTPUT / WAVEFORM', 25, 26);
  ctx.fillText('−1', 25, 299);
  ctx.fillText('0', 210, 299);
  ctx.fillText('+1', 395, 299);
}

function chrome({ ctx, audio, time }: CanvasScene) {
  const centerX = 216 + Math.sin(time * 0.18) * audio.mid * 24;
  for (let layer = 22; layer >= 0; layer--) {
    const depth = layer / 22;
    const radius = 34 + depth * 67 + audio.bass * 18;
    const silver = ctx.createLinearGradient(110, 65, 305, 249);
    silver.addColorStop(0, '#172230');
    silver.addColorStop(0.22, '#7b8ea7');
    silver.addColorStop(0.39, '#e2edf4');
    silver.addColorStop(0.45, '#35455d');
    silver.addColorStop(0.73, '#121a2e');
    silver.addColorStop(0.86, '#c2bdcf');
    silver.addColorStop(1, '#415877');
    ctx.strokeStyle = silver;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      const r =
        radius +
        Math.sin(angle * 3 + time * 0.45 + depth) * (9 + audio.mid * 17) +
        Math.cos(angle * 5 - time * 0.3) * audio.treble * 9;
      const x = centerX + Math.cos(angle) * r;
      const y = 158 + Math.sin(angle) * r * (0.75 + depth * 0.12);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function aurora({ ctx, audio, spectrum, time }: CanvasScene) {
  for (let layer = 0; layer < 3; layer++) {
    for (let x = 12; x < 420; x += 3) {
      const ratio = (x - 12) / 408;
      const level = spectrum[Math.floor(ratio * 63)] ?? 0;
      const y =
        138 +
        Math.sin(ratio * 5 + time * 0.3 + layer * 0.8) *
          (30 + audio.bass * 22) +
        Math.sin(ratio * 11 - time * 0.16) * audio.mid * 19 +
        layer * 23;
      const height = 45 + level * 81 + audio.treble * 18;
      const curtain = ctx.createLinearGradient(0, y - height, 0, y + 15);
      curtain.addColorStop(0, 'rgba(32,41,77,0)');
      curtain.addColorStop(
        0.74,
        `hsla(${160 + layer * 44 + ratio * 24} 80% 62% / ${0.15 + level * 0.27})`,
      );
      curtain.addColorStop(1, 'rgba(19,37,61,0)');
      ctx.fillStyle = curtain;
      ctx.fillRect(x, y - height, 3, height + 15);
    }
  }
}

function tunnel({ ctx, audio, time }: CanvasScene) {
  for (let ring = 15; ring >= 0; ring--) {
    const depth = (ring / 16 + time * 0.13) % 1;
    const radius = 9 + depth * depth * 330;
    const rotation = time * 0.05 + depth * 0.5 + audio.mid * 0.15;
    ctx.strokeStyle = `hsla(${202 + depth * 89} 85% ${48 + audio.treble * 26}% / ${0.12 + depth * 0.7})`;
    ctx.lineWidth = 0.6 + depth * 1.8;
    ctx.beginPath();
    for (let corner = 0; corner <= 8; corner++) {
      const angle = (corner / 8) * Math.PI * 2 + rotation;
      const x = 216 + Math.cos(angle) * radius * (1 + audio.bass * 0.13);
      const y = 158 + Math.sin(angle) * radius * 0.74;
      if (corner === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const center = ctx.createRadialGradient(216, 158, 0, 216, 158, 49);
  center.addColorStop(0, 'rgba(106,147,221,0.2)');
  center.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = center;
  ctx.fillRect(167, 109, 98, 98);
}

function ribbons({ ctx, audio, time }: CanvasScene) {
  for (let ribbon = 0; ribbon < 7; ribbon++) {
    const gradient = ctx.createLinearGradient(20, 0, 412, 0);
    gradient.addColorStop(0, 'rgba(43,89,163,0)');
    gradient.addColorStop(0.3, `hsl(${188 + ribbon * 15} 85% 67%)`);
    gradient.addColorStop(0.7, `hsl(${236 + ribbon * 12} 82% 72%)`);
    gradient.addColorStop(1, 'rgba(110,54,141,0)');
    ctx.strokeStyle = gradient;
    ctx.globalAlpha = 0.45 + ribbon * 0.06;
    ctx.lineWidth = ribbon === 3 ? 2 : 1;
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) {
      const ratio = i / 128;
      const wave = audio.waveform[Math.min(i, 127)] ?? 0;
      const x = 20 + ratio * 392;
      const y =
        158 +
        Math.sin(ratio * 7 + time * 0.35 + ribbon * 0.21) *
          (28 + audio.bass * 29) +
        Math.cos(ratio * 11 - time * 0.27 + ribbon * 0.14) *
          (12 + audio.mid * 21) +
        wave * (8 + ribbon * 2) +
        (ribbon - 3) * 6;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function stars({ ctx, audio, time }: CanvasScene) {
  for (let star = 0; star < 95; star++) {
    const angle = star * 2.399963 + audio.mid * 0.08;
    const distance = 14 + ((star * 0.618034 + time * 0.1) % 1) ** 2 * 250;
    const x = 216 + Math.cos(angle) * distance * (1 + audio.bass * 0.14);
    const y = 158 + Math.sin(angle) * distance * 0.72;
    const length =
      0.8 + distance * (0.015 + audio.treble * 0.06 + audio.rms * 0.03);
    ctx.strokeStyle = `hsla(${192 + (star % 9) * 9} ${25 + audio.treble * 45}% 85% / ${0.2 + distance / 340})`;
    ctx.lineWidth = 0.7 + distance / 240;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length * 0.72,
    );
    ctx.stroke();
  }
}

const canvasScenes: Readonly<Record<number, (scene: CanvasScene) => void>> = {
  0: bars,
  1: chrome,
  2: aurora,
  4: tunnel,
  5: ribbons,
  6: stars,
  7: bloom,
  8: scope,
};

function CanvasVisualizer(props: VisualizerProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef(props);
  useEffect(() => {
    current.current = props;
  }, [props]);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const history = document.createElement('canvas');
    history.width = 384;
    history.height = 224;
    const historyContext = history.getContext('2d');
    let frame = 0;
    let previous = performance.now();
    let elapsed = 0;
    let historyTime = 0;
    let previousMode = -1;
    let lastState = '';
    let audio = readAudioFrame();
    function draw(now: number) {
      if (!ctx || !canvas) return;
      const { mode, bands, settings } = current.current;
      const moving =
        !reduced.matches && !settings.frozen && !document.hidden && mode !== 3;
      const dt = Math.min(now - previous, 50) / 1000;
      previous = now;
      const state = JSON.stringify([mode, bands, settings]);
      if (document.hidden || (!moving && state === lastState)) {
        frame = requestAnimationFrame(draw);
        return;
      }
      if (moving) {
        audio = readAudioFrame(now);
        elapsed += dt * settings.speed * audio.rms;
      }
      const spectrum = audio.spectrum.map((value, i) =>
        Math.min(
          1,
          value *
            10 ** ((bands[Math.floor((i * bands.length) / 64)] ?? 0) / 20),
        ),
      );
      if (mode !== previousMode) {
        historyContext?.clearRect(0, 0, 384, 224);
        previousMode = mode;
        historyTime = 0;
      }
      ctx.filter = `hue-rotate(${settings.hue * 360}deg) brightness(${settings.glow})`;
      ctx.fillStyle = '#020406';
      ctx.fillRect(0, 0, 432, 316);
      if (mode === 9 && historyContext) {
        if (moving && now - historyTime >= 1000 / 30) {
          historyContext.drawImage(history, -2, 0);
          historyContext.fillStyle = '#020406';
          historyContext.fillRect(382, 0, 2, 224);
          for (let i = 0; i < 64; i++) {
            const level = spectrum[i] ?? 0;
            historyContext.fillStyle = `hsl(${260 - level * 210} ${70 + level * 25}% ${level * 65}%)`;
            historyContext.fillRect(382, 224 - (i + 1) * 3.5, 2, 3.5);
          }
          historyTime = now;
        }
        ctx.drawImage(history, 24, 46);
        ctx.fillStyle = '#8297ad';
        ctx.font = '10px monospace';
        ctx.fillText('OUTPUT / FREQUENCY HISTORY', 24, 29);
        ctx.fillText('LOW', 24, 291);
        ctx.fillText('NOW', 388, 291);
      } else if (mode !== 3) {
        canvasScenes[mode]?.({ ctx, audio, spectrum, time: elapsed });
      }
      lastState = state;
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
      aria-label={`${visualizations[props.mode]} audio visualization`}
    />
  );
}

export function Visualizer(props: VisualizerProps) {
  const [fallback, setFallback] = useState(false);
  return props.mode === 0 || props.mode === 3 || props.mode >= 7 || fallback ? (
    <CanvasVisualizer {...props} />
  ) : (
    <GPUVisualizer {...props} onFailure={() => setFallback(true)} />
  );
}

function GPUVisualizer({
  onFailure,
  ...props
}: VisualizerProps & { onFailure: () => void }) {
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
            time: 0,
            mode: 1,
            hue: 0,
            glow: 1,
            energy: 0,
            aspect: 216 / 158,
            bass: 0,
            mid: 0,
            treble: 0,
          },
        },
      });
      await shader.compile({ colors: [target.format] });
      if (disposed) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      let time = 0;
      let previous = performance.now();
      let lastState = '';
      let audio = readAudioFrame();
      function draw(now: number) {
        if (disposed) return;
        const { mode, bands, settings } = current.current;
        const moving = !settings.frozen && !reduced.matches && !document.hidden;
        const dt = Math.min(now - previous, 50) / 1000;
        previous = now;
        if (moving) {
          audio = readAudioFrame(now);
          time += dt * settings.speed * audio.rms * 3;
        }
        const state = JSON.stringify([mode, bands, settings]);
        if (!document.hidden && (moving || state !== lastState)) {
          const gain =
            10 **
            (bands.reduce((a, b) => a + b, 0) / Math.max(1, bands.length) / 20);
          shader.set({
            params: {
              time,
              mode,
              hue: settings.hue,
              glow: settings.glow,
              energy: Math.min(1, audio.rms * gain),
              aspect: 216 / 158,
              bass: Math.min(1, audio.bass * gain),
              mid: Math.min(1, audio.mid * gain),
              treble: Math.min(1, audio.treble * gain),
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
      aria-label={`${visualizations[props.mode]} audio visualization`}
    />
  );
}
