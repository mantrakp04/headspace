import { useId, type CSSProperties } from 'react';
import './control-detail.css';
import { EarControlFace } from './ear-control';

const paths = {
  previous: 'M4 5h2v14H4z M13 5v14l-7-7z M21 5v14l-8-7z',
  next: 'M3 5l8 7-8 7z M11 5l7 7-7 7z M18 5h2v14h-2z',
  play: 'M8 4.5L19 12 8 19.5z',
  pause: 'M6 4h4v16H6z M14 4h4v16h-4z',
  stop: 'M5.5 5.5h13v13h-13z',
  close: 'M6 6l12 12M18 6L6 18',
  minimize: 'M5 17h14',
  left: 'M15 6l-7 6 7 6',
  right: 'M9 6l7 6-7 6',
  equalizer: 'M3 3v18h18 M7 17V9m4 8V4m4 13v-6m4 6V8',
  playlist:
    'M7 3h9l4 4v14H7z M15 3v5h5 M4 6v15 M10 10h1m2 0h4m-7 3h1m2 0h4m-7 3h1m2 0h4m-7 3h1m2 0h4',
  library: 'M8 13H4V3h10v4 M14 9h7v12H10v-7 M7 7l11 11m0-6v6h-6',
  visualizer:
    'M12 2v5m0 10v5M2 12h5m10 0h5M5 5l4 4m6 6l4 4M5 19l4-4m6-6l4-4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
};
export type SkinIcon = keyof typeof paths;
const solidIcons: readonly SkinIcon[] = [
  'previous',
  'next',
  'play',
  'pause',
  'stop',
];
export function Icon({ name }: { name: SkinIcon }) {
  const solid = solidIcons.includes(name);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={paths[name]}
        fill={solid ? 'currentColor' : 'none'}
        stroke={solid ? 'none' : 'currentColor'}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Jewel({ icon, gold }: { icon: SkinIcon; gold: boolean }) {
  const id = useId();
  const face = `${id}-face`;
  const rim = `${id}-rim`;
  const glint = `${id}-glint`;
  const solid = solidIcons.includes(icon);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#426206" />
          <stop offset=".19" stopColor="#688b24" />
          <stop offset=".42" stopColor="#bed48f" />
          <stop offset=".63" stopColor="#f4ffe4" />
          <stop offset=".82" stopColor="#faffee" />
          <stop offset="1" stopColor="#749537" />
        </linearGradient>
        <radialGradient id={face} cx=".35" cy=".3" r=".72" fx=".26" fy=".25">
          <stop stopColor={gold ? '#fffed4' : '#ffe5ff'} />
          <stop offset=".19" stopColor={gold ? '#fff17e' : '#eb96ff'} />
          <stop offset=".43" stopColor={gold ? '#f8cc23' : '#bf59db'} />
          <stop offset=".68" stopColor={gold ? '#d89908' : '#9036aa'} />
          <stop offset=".84" stopColor={gold ? '#95600c' : '#512666'} />
          <stop offset="1" stopColor={gold ? '#f8d25a' : '#d19be1'} />
        </radialGradient>
        <radialGradient id={glint}>
          <stop stopColor="#fff" stopOpacity=".94" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".44" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M7 .7h10l6.3 6.1v10.4L17 23.3H7L.7 17.2V6.8z"
        fill={`url(#${rim})`}
      />
      <path
        d="M6.4 2.1Q12-.9 18 2.8L22 7v9.8L17.4 22H7L2 17V7z"
        fill="#bddd85"
        opacity=".55"
      />
      <g className="control-face">
        <circle cx="12" cy="12" r="10.05" fill={gold ? '#574412' : '#412344'} />
        <circle cx="12.15" cy="12.35" r="9.3" fill={`url(#${face})`} />
        <path
          d="M3.3 12.4C2.9 7.3 6.5 3 11.5 2.8"
          fill="none"
          stroke={gold ? '#fff6b0' : '#d592e7'}
          strokeWidth=".75"
          opacity=".85"
        />
        <path
          d="M5 18.2C8 22.4 15.7 22.7 19.7 16.9"
          fill="none"
          stroke={gold ? '#fff0a8' : '#f3caff'}
          strokeWidth="1.05"
          opacity=".8"
        />
        <ellipse
          cx="7.2"
          cy="7.9"
          rx="3.2"
          ry="5.3"
          transform="rotate(24 7.2 7.9)"
          fill={`url(#${glint})`}
        />
        <g transform="translate(2.5 2.5) scale(.79)">
          <path
            d={paths[icon]}
            opacity=".5"
            transform="translate(.3 .45)"
            fill={solid ? '#fff0ff' : 'none'}
            stroke={solid ? '#f2c3f3' : '#fff2cc'}
            strokeWidth={solid ? '.2' : '2.45'}
            strokeLinejoin="miter"
          />
          <path
            d={paths[icon]}
            fill={solid ? '#100d12' : 'none'}
            stroke={solid ? 'none' : '#17170f'}
            strokeWidth="2.55"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </g>
      </g>
    </svg>
  );
}

const utilityDrawings = {
  library: {
    viewBox: '0 0 35 31',
    path: 'M12 17H8V5H20V10 M9 8H17 M20 12H27V25H15V19 M11 10L23 22 M23 15V22H16',
    stroke: 1.2,
  },
  equalizer: {
    viewBox: '0 0 20 19',
    path: 'M3.5 3.5V16H17 M7 13V7 M10 13V3 M13 13V10 M16 13V6',
    stroke: 1,
  },
  playlist: {
    viewBox: '0 0 19 20',
    path: 'M6 3H12L15 6V17H6Z M12 3V6H15 M4 5V17 M8 8H9 M11 8H13 M8 10.5H9 M11 10.5H13 M8 13H9 M11 13H13 M8 15.5H9 M11 15.5H13',
    stroke: 0.7,
  },
};

function UtilityRelief({ icon }: { icon: keyof typeof utilityDrawings }) {
  const id = useId();
  const paint = `${id}-utility`;
  const drawing = utilityDrawings[icon];
  return (
    <svg viewBox={drawing.viewBox} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={paint} x1="0" y1="0" x2=".6" y2="1">
          <stop stopColor="#d5f66a" />
          <stop offset=".45" stopColor="#b4e640" />
          <stop offset="1" stopColor="#79b51b" />
        </linearGradient>
      </defs>
      <g
        className="control-relief"
        fill="none"
        strokeLinejoin="miter"
        strokeLinecap="square"
      >
        <path
          d={drawing.path}
          stroke="#385f04"
          strokeWidth={drawing.stroke + 1.2}
          transform="translate(.6 .8)"
        />
        <path
          d={drawing.path}
          stroke="#def986"
          strokeWidth={drawing.stroke + 0.45}
          transform="translate(-.3 -.35)"
        />
        <path
          className="relief-face"
          style={{ fill: 'none' }}
          d={drawing.path}
          stroke={`url(#${paint})`}
          strokeWidth={drawing.stroke}
        />
      </g>
    </svg>
  );
}

function Relief({
  icon,
  windowControl,
}: {
  icon: SkinIcon;
  windowControl: boolean;
}) {
  const id = useId();
  const paint = `${id}-relief`;
  const glyph =
    icon === 'close'
      ? 'M3 3h5l4 6 4-6h5l-6 9 6 9h-5l-4-6-4 6H3l6-9z'
      : icon === 'minimize'
        ? 'M2 16h20v4H2z'
        : paths[icon];
  const solid = windowControl && (icon === 'close' || icon === 'minimize');
  const fill = (color: string) => (solid ? color : 'none');
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={paint} x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor={windowControl ? '#a1e84a' : '#e3ff70'} />
          <stop offset=".4" stopColor={windowControl ? '#548c18' : '#c9f850'} />
          <stop offset="1" stopColor={windowControl ? '#396706' : '#7fb717'} />
        </linearGradient>
      </defs>
      <g
        className="control-relief"
        transform={
          windowControl
            ? 'translate(.7 .7) scale(.92)'
            : 'translate(1 1) scale(.9)'
        }
        strokeLinejoin="miter"
        strokeLinecap="square"
      >
        <path
          d={glyph}
          transform="translate(1.4 1.8)"
          fill={fill('#284e00')}
          stroke="#284e00"
          strokeWidth={solid ? '.9' : '3.3'}
          opacity=".68"
        />
        <path
          d={glyph}
          transform="translate(.65 1)"
          fill={fill('#5c9209')}
          stroke="#5c9209"
          strokeWidth={solid ? '.8' : '3.1'}
        />
        <path
          d={glyph}
          transform="translate(-.5 -.55)"
          fill={fill('#e4ff9c')}
          stroke="#e4ff9c"
          strokeWidth={solid ? '.75' : '2.8'}
        />
        <path
          className="relief-face"
          d={glyph}
          fill={fill(`url(#${paint})`)}
          stroke={`url(#${paint})`}
          strokeWidth={solid ? '.4' : '1.75'}
        />
      </g>
    </svg>
  );
}

export function SkinButton({
  label,
  icon,
  x,
  y,
  width = 20,
  height = 20,
  onClick,
  disabled,
  variant = 'utility',
}: {
  label: string;
  icon: SkinIcon;
  x: number;
  y: number;
  width?: number;
  height?: number;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'transport' | 'gold' | 'utility' | 'window' | 'ear';
}) {
  const style: CSSProperties = { left: x, top: y, width, height };
  return (
    <button
      type="button"
      className={`skin-button control-${variant}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      style={style}
      onClick={onClick}
    >
      {variant === 'transport' || variant === 'gold' ? (
        <Jewel icon={icon} gold={variant === 'gold'} />
      ) : variant === 'ear' ? (
        icon === 'left' || icon === 'right' ? (
          <EarControlFace direction={icon} />
        ) : (
          <Icon name={icon} />
        )
      ) : icon === 'library' || icon === 'equalizer' || icon === 'playlist' ? (
        <UtilityRelief icon={icon} />
      ) : (
        <Relief icon={icon} windowControl={variant === 'window'} />
      )}
    </button>
  );
}
