import { useId } from 'react';
import './ear-control.css';

const gripContour =
  'M5.5.4C12 6.5 17.8 20.5 17.8 34.8C17.8 47.5 16.1 59.4 12.8 65.4C5.2 61.3.2 47.8.2 32.8C.2 19.4 2 6.5 5.5.4Z';

export function EarControlFace({ direction }: { direction: 'left' | 'right' }) {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;

  return (
    <svg
      className="ear-control-face"
      viewBox="0 0 18 66"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={gripContour} />
        </clipPath>
        <linearGradient id={`${id}-rib`} x1="0" x2="1" y1="0" y2="0">
          <stop stopColor="#6ccd34" />
          <stop offset=".22" stopColor="#57b321" />
          <stop offset=".45" stopColor="#91e748" />
          <stop offset=".72" stopColor="#73ce37" />
          <stop offset="1" stopColor="#4bac21" />
        </linearGradient>
        <pattern
          id={`${id}-ribs`}
          width="18"
          height="2"
          patternUnits="userSpaceOnUse"
        >
          <rect width="18" height="2" fill="#136e00" />
          <rect y=".7" width="18" height=".85" fill={paint('rib')} />
          <path d="M0 1.65H18" stroke="#348c13" strokeWidth=".3" />
        </pattern>
        <linearGradient id={`${id}-ridge`} x1="0" x2="1" y1="0" y2="0">
          <stop stopColor="#72ce1d" />
          <stop offset=".5" stopColor="#b1ff38" />
          <stop offset="1" stopColor="#449d0c" />
        </linearGradient>
        <linearGradient id={`${id}-arrow`} x1="0" x2=".8" y1="0" y2="1">
          <stop stopColor="#c8ff64" />
          <stop offset=".48" stopColor="#9eef28" />
          <stop offset="1" stopColor="#77c51b" />
        </linearGradient>
      </defs>
      <g className="ear-grip-shell">
        <path d={gripContour} fill={paint('ribs')} />
        <g clipPath={paint('clip')}>
          <path
            d="M5.1-1C10.7 9.7 3 14 3.7 32.4C3.6 47.1 6.5 57.5 13.1 67"
            fill="none"
            stroke="#116c00"
            strokeWidth="2.6"
          />
          <path
            d="M6.1-1C11.7 9.7 4 14 4.7 32.4C4.6 47.1 7.5 57.5 14.1 67"
            fill="none"
            stroke={paint('ridge')}
            strokeWidth="1.1"
          />
          <path
            d={gripContour}
            fill="none"
            stroke="#93df60"
            strokeWidth=".65"
          />
          <path
            d="M5.5.4C2 6.5.2 19.4.2 32.8C.2 47.8 5.2 61.3 12.8 65.4"
            fill="none"
            stroke="#328811"
            strokeWidth=".5"
          />
        </g>
      </g>
      <g
        className="ear-grip-arrow"
        transform={
          direction === 'left' ? 'translate(18 0) scale(-1 1)' : undefined
        }
      >
        <path d="M8 27 16 34.2 8 41Z" fill="#174900" opacity=".8" />
        <path d="M7.7 25.8 15.7 33.1 7.7 39.8Z" fill={paint('arrow')} />
        <path
          d="M7.7 39.8V25.8L15.7 33.1"
          fill="none"
          stroke="#e4ffc1"
          strokeWidth=".9"
          strokeLinejoin="round"
        />
        <path
          d="m15.7 33.1-8 6.7"
          fill="none"
          stroke="#478a1c"
          strokeWidth=".9"
        />
        <path d="m9 28.9 4.7 4.3L9 37.1Z" fill="#a2f52e" />
      </g>
    </svg>
  );
}
