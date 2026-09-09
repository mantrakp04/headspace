import { useEffect, useId, useRef } from 'react';
import { readAudioFrame } from './audio';

const cones = {
  left: [
    { x: 34, y: 39, rx: 16, ry: 22, angle: -28 },
    { x: 49, y: 94, rx: 14, ry: 18, angle: -28 },
    { x: 54, y: 140, rx: 14, ry: 16, angle: -28 },
  ],
  right: [
    { x: 54, y: 39, rx: 16, ry: 22, angle: 28 },
    { x: 35, y: 94, rx: 14, ry: 18, angle: 28 },
    { x: 35, y: 140, rx: 14, ry: 16, angle: 28 },
  ],
};

export function Speakers({
  side,
  frozen,
}: {
  side: 'left' | 'right';
  frozen: boolean;
}) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const freeze = useRef(frozen);
  useEffect(() => {
    freeze.current = frozen;
  }, [frozen]);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const drivers = svg.querySelectorAll<SVGGElement>('[data-cone]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous = performance.now();
    let excursion = 0;
    function draw(now: number) {
      const dt = Math.min(50, now - previous);
      previous = now;
      if (!document.hidden && !freeze.current) {
        const audio = readAudioFrame(now);
        const target = reduced.matches
          ? 0
          : Math.min(1, Math.sqrt(audio.bass) * 1.6);
        excursion +=
          (target - excursion) *
          (1 - Math.exp(-dt / (target > excursion ? 18 : 95)));
        if (excursion < 0.0001) excursion = 0;
        drivers.forEach((driver, index) => {
          const cone = cones[side][index];
          const amount = excursion * (1 - index * 0.16);
          const tremor = audio.waveform[64] * amount * 0.25;
          const scale = 1 + amount * 0.065 + tremor * 0.01;
          const dx = (side === 'left' ? -1 : 1) * amount * 0.4;
          const dy = -amount * 0.65 + tremor;
          driver.setAttribute(
            'transform',
            `translate(${cone.x + dx} ${cone.y + dy}) scale(${scale}) translate(${-cone.x} ${-cone.y})`,
          );
        });
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [side]);
  const width = side === 'left' ? 84 : 87;
  return (
    <svg
      ref={ref}
      className="speaker-cones"
      style={{ left: side === 'left' ? 0 : 185 }}
      width={width}
      height={170}
      viewBox={`0 0 ${width} 170`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-feather`}>
          <stop offset="0.84" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
        {cones[side].map((cone, index) => (
          <mask
            key={index}
            id={`${id}-${index}`}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={width}
            height={170}
          >
            <ellipse
              cx={cone.x}
              cy={cone.y}
              rx={cone.rx}
              ry={cone.ry}
              transform={`rotate(${cone.angle} ${cone.x} ${cone.y})`}
              fill={`url(#${id}-feather)`}
            />
          </mask>
        ))}
      </defs>
      {cones[side].map((_, index) => (
        <g key={index} mask={`url(#${id}-${index})`}>
          <g data-cone={index}>
            <image href={`/skin/${side}_ear.png`} width={width} height={170} />
          </g>
        </g>
      ))}
    </svg>
  );
}
