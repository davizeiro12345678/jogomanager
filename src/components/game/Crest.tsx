import { useId } from "react";

import type { Club } from "@/game/types";

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type Shape = "shield" | "round" | "pointed" | "diamond" | "banner";
type Pattern = "sash" | "halves" | "stripes" | "rings" | "quarters" | "chevron" | "solid";

const SHAPES: Record<Shape, string> = {
  shield: "M32 3 L59 11 V31 C59 47 46 57 32 61 C18 57 5 47 5 31 V11 Z",
  round: "M32 3 C47 3 60 15 60 31 C60 47 47 61 32 61 C17 61 4 47 4 31 C4 15 17 3 32 3 Z",
  pointed: "M32 2 L60 12 V30 C60 45 48 55 32 62 C16 55 4 45 4 30 V12 Z",
  diamond: "M32 2 L60 32 L32 62 L4 32 Z",
  banner: "M8 6 H56 A4 4 0 0 1 60 10 V38 C60 50 46 58 32 62 C18 58 4 50 4 38 V10 A4 4 0 0 1 8 6 Z",
};

const SHAPE_LIST = Object.keys(SHAPES) as Shape[];
const PATTERN_LIST: Pattern[] = [
  "sash",
  "halves",
  "stripes",
  "rings",
  "quarters",
  "chevron",
  "solid",
];

export function Crest({ club, size = 44 }: { club: Club; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const h = hash(club.id);
  const shape = SHAPE_LIST[h % SHAPE_LIST.length]!;
  const pattern = PATTERN_LIST[Math.floor(h / 5) % PATTERN_LIST.length]!;
  const stars = club.strength >= 84 ? 3 : club.strength >= 78 ? 2 : club.strength >= 72 ? 1 : 0;
  const path = SHAPES[shape];
  const grad = `g${uid}`;
  const clip = `c${uid}`;
  const shine = `s${uid}`;
  const metal = `m${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Escudo do ${club.name}`}
      className="shrink-0 drop-shadow-[0_3px_8px_rgba(0,0,0,0.5)]"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor={club.primary} stopOpacity="1" />
          <stop offset="60%" stopColor={club.primary} stopOpacity="0.9" />
          <stop offset="100%" stopColor={club.primary} stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fdf6d8" />
          <stop offset="45%" stopColor={club.secondary} />
          <stop offset="100%" stopColor="#6b6b6b" />
        </linearGradient>
        <clipPath id={clip}>
          <path d={path} />
        </clipPath>
      </defs>

      <path d={path} fill={`url(#${grad})`} />

      <g clipPath={`url(#${clip})`}>
        {pattern === "sash" && (
          <path d="M-10 46 L46 -10 L62 6 L6 62 Z" fill={club.secondary} opacity="0.92" />
        )}
        {pattern === "halves" && (
          <rect x="32" y="0" width="32" height="64" fill={club.secondary} opacity="0.92" />
        )}
        {pattern === "stripes" &&
          [6, 20, 34, 48].map((x) => (
            <rect key={x} x={x} y="0" width="8" height="64" fill={club.secondary} opacity="0.88" />
          ))}
        {pattern === "rings" && (
          <>
            <circle
              cx="32"
              cy="31"
              r="23"
              fill="none"
              stroke={club.secondary}
              strokeWidth="7"
              opacity="0.88"
            />
            <circle
              cx="32"
              cy="31"
              r="11"
              fill="none"
              stroke={club.secondary}
              strokeWidth="4"
              opacity="0.7"
            />
          </>
        )}
        {pattern === "quarters" && (
          <>
            <rect x="32" y="0" width="32" height="32" fill={club.secondary} opacity="0.9" />
            <rect x="0" y="32" width="32" height="32" fill={club.secondary} opacity="0.9" />
          </>
        )}
        {pattern === "chevron" && (
          <path d="M32 10 L64 34 V50 L32 26 L0 50 V34 Z" fill={club.secondary} opacity="0.9" />
        )}
        <rect x="0" y="5" width="64" height="13" fill={club.secondary} opacity="0.5" />
        <rect x="0" y="0" width="64" height="64" fill={`url(#${shine})`} />
      </g>

      <path d={path} fill="none" stroke={`url(#${metal})`} strokeWidth="3" />
      <path d={path} fill="none" stroke="#000000" strokeWidth="0.9" opacity="0.4" />

      {stars > 0 && (
        <g>
          {Array.from({ length: stars }).map((_, i) => {
            const cx = 32 + (i - (stars - 1) / 2) * 8;
            return (
              <path
                key={i}
                transform={`translate(${cx} 12) scale(0.32)`}
                d="M0 -10 L2.9 -3.1 L10.4 -2.4 L4.7 2.6 L6.4 9.9 L0 6 L-6.4 9.9 L-4.7 2.6 L-10.4 -2.4 L-2.9 -3.1 Z"
                fill="#ffd75e"
                stroke="#7a5b00"
                strokeWidth="1.6"
              />
            );
          })}
        </g>
      )}

      <text
        x="32"
        y="46"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2.6"
        paintOrder="stroke"
        style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif", letterSpacing: 0.8 }}
      >
        {club.short}
      </text>
    </svg>
  );
}
