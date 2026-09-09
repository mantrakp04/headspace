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

function aurora({ ctx, audio, time }: CanvasScene) {
  ctx.fillStyle = '#030a13';
  ctx.fillRect(0, 0, 432, 316);
  ctx.globalCompositeOperation = 'screen';
  for (let layer = 0; layer < 4; layer++) {
    for (let x = 0; x < 432; x += 2) {
      const u = x / 432;
      const fold =
        Math.sin(u * 8 + time * 0.24 + layer * 0.7) * 24 +
        Math.sin(u * 17 - time * 0.17 + layer) * 8;
      const edge = 178 + fold + layer * 12;
      const height = 95 + Math.sin(u * 6 + time * 0.2) * 26 + audio.bass * 20;
      const light =
        (0.22 + 0.08 * Math.sin(u * 180 + fold * 0.1)) *
        Math.sin(u * Math.PI) ** 0.6;
      const curtain = ctx.createLinearGradient(0, edge - height, 0, edge + 4);
      curtain.addColorStop(0, 'rgba(65,35,100,0)');
      curtain.addColorStop(0.35, `rgba(70,61,145,${light * 0.3})`);
      curtain.addColorStop(0.8, `rgba(35,170,130,${light * 0.7})`);
      curtain.addColorStop(0.96, `rgba(86,230,167,${light})`);
      curtain.addColorStop(1, 'rgba(25,90,80,0)');
      ctx.fillStyle = curtain;
      ctx.fillRect(x, edge - height, 2, height + 4);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function tunnel({ ctx, audio, time }: CanvasScene) {
  const cx = 216 + Math.sin(time * 0.12) * 17;
  const cy = 158 + Math.cos(time * 0.09) * 12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.85);
  for (let ring = 0; ring < 24; ring++) {
    const z = 0.12 + ((ring / 24 + time * 0.1) % 1) * 5;
    const radius = 85 / z;
    ctx.strokeStyle = `rgba(59,153,218,${Math.min(0.65, 0.7 / z)})`;
    ctx.lineWidth = 0.5 + 0.7 / z;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let rail = 0; rail < 16; rail++) {
    const a = (rail / 16) * Math.PI * 2 + Math.sin(time * 0.12) * 0.16;
    const gradient = ctx.createLinearGradient(
      0,
      0,
      Math.cos(a) * 300,
      Math.sin(a) * 300,
    );
    gradient.addColorStop(0, 'rgba(20,75,125,0)');
    gradient.addColorStop(1, 'rgba(65,170,230,0.45)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
    ctx.quadraticCurveTo(
      Math.cos(a + 0.1) * 100,
      Math.sin(a + 0.1) * 100,
      Math.cos(a) * 350,
      Math.sin(a) * 350,
    );
    ctx.stroke();
  }
  ctx.restore();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 38);
  core.addColorStop(0, '#020406');
  core.addColorStop(0.4, '#020406');
  core.addColorStop(1, 'rgba(2,4,6,0)');
  ctx.fillStyle = core;
  ctx.fillRect(cx - 38, cy - 38, 76, 76);
  ctx.fillStyle = `rgba(85,160,220,${audio.bass * 0.025})`;
  ctx.fillRect(0, 0, 432, 316);
}

function ribbons({ ctx, audio, time }: CanvasScene) {
  ctx.globalCompositeOperation = 'screen';
  for (let ribbon = 0; ribbon < 3; ribbon++) {
    const phase = time * 0.24 + ribbon * 1.7;
    for (let strand = 0; strand < 32; strand++) {
      const cross = (strand / 31) * 2 - 1;
      const sheen = Math.exp(-(((cross + 0.36) * 5) ** 2));
      const gradient = ctx.createLinearGradient(0, 0, 432, 0);
      const color =
        ribbon === 0
          ? '70,185,205'
          : ribbon === 1
            ? '158,172,204'
            : '218,150,99';
      gradient.addColorStop(0, `rgba(${color},0)`);
      gradient.addColorStop(0.25, `rgba(${color},${0.13 + sheen * 0.55})`);
      gradient.addColorStop(0.75, `rgba(${color},${0.13 + sheen * 0.55})`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = 0; x <= 432; x += 3) {
        const u = (x - 216) / 158;
        const center =
          158 +
          Math.sin(u * 1.8 + phase) * 47 +
          Math.sin(u * 3.1 - phase * 0.7) * 16 +
          (ribbon - 1) * 24;
        const width =
          4 +
          19 * (0.5 + 0.5 * Math.sin(u * 2 + phase + 1)) ** 2 +
          audio.bass * 4;
        const y = center + cross * width;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function starSeed(n: number) {
  const value = Math.sin(n * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function stars({ ctx, audio, time }: CanvasScene) {
  for (let star = 0; star < 180; star++) {
    const angle = starSeed(star * 3 + 1) * Math.PI * 2;
    const spread = 40 + starSeed(star * 3 + 2) * 410;
    const phase = starSeed(star * 3 + 3) - time * 0.055;
    const z = 0.2 + (phase - Math.floor(phase)) * 4;
    const x = 216 + (Math.cos(angle) * spread) / z;
    const y = 158 + (Math.sin(angle) * spread) / z;
    const opacity =
      Math.min(1, (z - 0.2) / 0.3, (4.2 - z) / 0.9) *
      (0.5 + starSeed(star + 300) * 0.5);
    const length = 0.4 + 3 / (z * z);
    ctx.strokeStyle = `rgba(186,211,242,${opacity * 0.45})`;
    ctx.lineWidth = 0.5 + 0.5 / z;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
    ctx.stroke();
    ctx.fillStyle = `rgba(225,233,244,${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.3 + 0.4 / z + audio.treble * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

const canvasScenes = {
  0: bars,
  1: chrome,
  2: aurora,
  4: tunnel,
  5: ribbons,
  6: stars,
  7: bloom,
  8: scope,
};

function canvasScene(mode: number) {
  switch (mode) {
    case 0:
    case 1:
    case 2:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
      return canvasScenes[mode];
    default:
      return undefined;
  }
}

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
        elapsed +=
          dt *
          settings.speed *
          (mode >= 2 && mode <= 6 ? 0.35 + audio.rms * 0.65 : audio.rms);
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
        canvasScene(mode)?.({ ctx, audio, spectrum, time: elapsed });
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
          time +=
            dt *
            settings.speed *
            (mode >= 2 && mode <= 6 ? 0.6 + audio.rms * 1.4 : audio.rms * 3);
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
    void start().catch((cause: unknown) => {
      console.warn('Headspace visualizer fallback', cause);
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
