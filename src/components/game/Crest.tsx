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

type Shape = "shield" | "round" | "pointed";
type Pattern = "sash" | "halves" | "stripes" | "rings" | "solid";

const SHAPES: Record<Shape, string> = {
  shield: "M32 3 L59 11 V31 C59 47 46 57 32 61 C18 57 5 47 5 31 V11 Z",
  round: "M32 3 C47 3 60 15 60 31 C60 47 47 61 32 61 C17 61 4 47 4 31 C4 15 17 3 32 3 Z",
  pointed: "M32 2 L60 12 V30 C60 45 48 55 32 62 C16 55 4 45 4 30 V12 Z",
};

export function Crest({ club, size = 44 }: { club: Club; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const h = hash(club.id);
  const shape = (["shield", "round", "pointed"] as Shape[])[h % 3]!;
  const pattern = (["sash", "halves", "stripes", "rings", "solid"] as Pattern[])[
    Math.floor(h / 3) % 5
  ]!;
  const path = SHAPES[shape];
  const grad = `g${uid}`;
  const clip = `c${uid}`;
  const shine = `s${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Escudo ${club.name}`}
      className="shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={club.primary} stopOpacity="1" />
          <stop offset="100%" stopColor={club.primary} stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
        </linearGradient>
        <clipPath id={clip}>
          <path d={path} />
        </clipPath>
      </defs>

      <path d={path} fill={`url(#${grad})`} />

      <g clipPath={`url(#${clip})`}>
        {pattern === "sash" && (
          <path d="M-10 46 L46 -10 L62 6 L6 62 Z" fill={club.secondary} opacity="0.9" />
        )}
        {pattern === "halves" && <rect x="32" y="0" width="32" height="64" fill={club.secondary} opacity="0.9" />}
        {pattern === "stripes" &&
          [8, 22, 36, 50].map((x) => (
            <rect key={x} x={x} y="0" width="7" height="64" fill={club.secondary} opacity="0.85" />
          ))}
        {pattern === "rings" && (
          <>
            <circle cx="32" cy="31" r="22" fill="none" stroke={club.secondary} strokeWidth="6" opacity="0.85" />
            <circle cx="32" cy="31" r="11" fill="none" stroke={club.secondary} strokeWidth="4" opacity="0.7" />
          </>
        )}
        <rect x="0" y="6" width="64" height="14" fill={club.secondary} opacity="0.55" />
        <rect x="0" y="0" width="64" height="64" fill={`url(#${shine})`} />
      </g>

      <path d={path} fill="none" stroke={club.secondary} strokeWidth="2.6" />
      <path d={path} fill="none" stroke="#000000" strokeWidth="0.8" opacity="0.35" />

      <text
        x="32"
        y="45"
        textAnchor="middle"
        fontSize="19"
        fontWeight="800"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2.4"
        paintOrder="stroke"
        style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif", letterSpacing: 1 }}
      >
        {club.short}
      </text>
    </svg>
  );
}
