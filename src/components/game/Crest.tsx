import { useEffect, useId, useState } from "react";

import type { Club } from "@/game/types";
import { crestStyleFor } from "@/game/customStyle";
import { badgeFor } from "@/lib/customData";
import { loadOfficialAssets, officialCrest, subscribeOfficial } from "@/lib/officialAssets";

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type Shape = "shield" | "round" | "pointed" | "diamond" | "hex" | "english" | "split" | "banner";

type Pattern =
  "sash" | "halves" | "stripes" | "rings" | "quarters" | "chevron" | "hoop" | "rays" | "solid";

type Emblem = "ball" | "lion" | "eagle" | "crown" | "anchor" | "leaf" | "mountain" | "bolt";

const SHAPES: Record<Shape, string> = {
  shield: "M32 3 L59 11 V31 C59 47 46 57 32 61 C18 57 5 47 5 31 V11 Z",
  round: "M32 3 C47 3 60 15 60 31 C60 47 47 61 32 61 C17 61 4 47 4 31 C4 15 17 3 32 3 Z",
  pointed: "M32 2 L60 12 V30 C60 45 48 55 32 62 C16 55 4 45 4 30 V12 Z",
  diamond: "M32 2 L60 32 L32 62 L4 32 Z",
  hex: "M32 2 L57 16 V46 L32 62 L7 46 V16 Z",
  english: "M7 6 H57 V28 C57 45 45 55 32 61 C19 55 7 45 7 28 Z",
  split: "M32 2 L58 10 V34 C58 48 46 57 32 62 C18 57 6 48 6 34 V10 Z",
  banner: "M8 6 H56 A4 4 0 0 1 60 10 V38 C60 50 46 58 32 62 C18 58 4 50 4 38 V10 A4 4 0 0 1 8 6 Z",
};

const EMBLEMS: Record<Emblem, string> = {
  ball: "M0 -8 A8 8 0 1 1 0 8 A8 8 0 1 1 0 -8 M0 -4 L3.8 -1.2 L2.4 3.4 L-2.4 3.4 L-3.8 -1.2 Z",
  lion: "M0 -8 C4 -8 7 -5 7 -1 C7 3 4 7 0 8 C-4 7 -7 3 -7 -1 C-7 -5 -4 -8 0 -8 M-3 -2 h1.6 v1.6 h-1.6 Z M1.4 -2 h1.6 v1.6 h-1.6 Z M-2.6 2.6 h5.2 v1.4 h-5.2 Z",
  eagle: "M0 -7 L2 -3 L8 -5 L4 0 L8 5 L2 3 L0 7 L-2 3 L-8 5 L-4 0 L-8 -5 L-2 -3 Z",
  crown: "M-8 4 L-8 -4 L-4 0 L0 -6 L4 0 L8 -4 L8 4 Z",
  anchor:
    "M-0.9 -7 h1.8 v3 h2.4 v1.8 h-2.4 V5 C3 4.6 5.4 2.6 6 -0.2 L8 0.4 C7 4.6 3.6 7.4 0 7.6 C-3.6 7.4 -7 4.6 -8 0.4 L-6 -0.2 C-5.4 2.6 -3 4.6 -0.9 5 Z",
  leaf: "M0 8 C-6 4 -7 -4 0 -8 C7 -4 6 4 0 8 Z",
  mountain: "M-8 6 L-2.5 -5 L1 1 L3.5 -3 L8 6 Z",
  bolt: "M1.5 -8 L-5 1 H-0.5 L-2 8 L5 -1 H0.5 Z",
};

const SHAPE_LIST = Object.keys(SHAPES) as Shape[];
const EMBLEM_LIST = Object.keys(EMBLEMS) as Emblem[];
const PATTERN_LIST: Pattern[] = [
  "sash",
  "halves",
  "stripes",
  "rings",
  "quarters",
  "chevron",
  "hoop",
  "rays",
  "solid",
];

/** Relative luminance, used to keep the monogram readable on any club colour. */
function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.4;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function Crest({
  club,
  size = 44,
  detail = "auto",
}: {
  club: Club;
  size?: number;
  /** `full` shows emblem, founding year and metal rim; `simple` is optimised for tiny sizes. */
  detail?: "auto" | "simple" | "full";
}) {
  const uid = useId().replace(/:/g, "");
  const [custom, setCustom] = useState<string | undefined>(undefined);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    const sync = () => setCustom(badgeFor(club.id) ?? officialCrest(club.id));
    sync();
    void loadOfficialAssets().then(sync);
    const off = subscribeOfficial(sync);
    return () => {
      off();
    };
  }, [club.id]);

  const h = hash(club.id);
  const style = crestStyleFor(club.id);
  const shape = style?.shape ?? SHAPE_LIST[h % SHAPE_LIST.length]!;
  const pattern = style?.pattern ?? PATTERN_LIST[Math.floor(h / 7) % PATTERN_LIST.length]!;
  const emblem = style?.emblem ?? EMBLEM_LIST[Math.floor(h / 31) % EMBLEM_LIST.length]!;
  const founded = style?.founded ?? 1890 + (Math.floor(h / 97) % 110);

  const stars = club.strength >= 84 ? 3 : club.strength >= 78 ? 2 : club.strength >= 72 ? 1 : 0;
  const full = detail === "full" || (detail === "auto" && size >= 38);

  const path = SHAPES[shape];
  const grad = `g${uid}`;
  const clip = `c${uid}`;
  const shine = `s${uid}`;
  const metal = `m${uid}`;

  const dark = luminance(club.primary) < 0.42;
  const ink = dark ? "#ffffff" : "#0d1512";
  const inkStroke = dark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";
  const rimA = stars >= 2 ? "#fdf0b8" : "#e8e8ee";
  const rimB = stars >= 2 ? "#a9812c" : "#7d7d88";

  // Imagem oficial: se ela falhar (link morto, bloqueio de rede), caímos no
  // escudo desenhado em vez de deixar um quadrado quebrado na tela.
  if (custom && !imgFailed) {
    return (
      <img
        src={custom}
        width={size}
        height={size}
        // pedimos o dobro do tamanho na tela para o escudo não sair borrado
        // em telas de alta densidade
        style={{ width: size, height: size, imageRendering: "auto" }}
        decoding="async"
        loading="lazy"
        draggable={false}
        onError={() => setImgFailed(true)}
        alt={`Escudo do ${club.name}`}
        className="shrink-0 rounded-md object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.5)]"
      />
    );
  }

  if (!full) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={`Escudo do ${club.name}`}
        className="shrink-0"
      >
        <path d={path} fill={club.primary} stroke={club.secondary} strokeWidth="3" />
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fontSize="18"
          fontWeight="800"
          fill={ink}
          stroke={inkStroke}
          strokeWidth="1.5"
          paintOrder="stroke"
        >
          {club.short}
        </text>
      </svg>
    );
  }

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
        <linearGradient id={grad} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor={club.primary} stopOpacity="1" />
          <stop offset="58%" stopColor={club.primary} stopOpacity="0.92" />
          <stop offset="100%" stopColor={club.primary} stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={rimA} />
          <stop offset="45%" stopColor={club.secondary} />
          <stop offset="100%" stopColor={rimB} />
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
        {pattern === "hoop" && (
          <>
            <rect x="0" y="18" width="64" height="10" fill={club.secondary} opacity="0.9" />
            <rect x="0" y="36" width="64" height="10" fill={club.secondary} opacity="0.9" />
          </>
        )}
        {pattern === "rays" &&
          Array.from({ length: 8 }).map((_, i) => (
            <path
              key={i}
              d="M32 31 L64 31 L64 39 Z"
              fill={club.secondary}
              opacity="0.55"
              transform={`rotate(${i * 45} 32 31)`}
            />
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

        {/* upper band carries the stars / founding year */}
        <rect x="0" y="4" width="64" height="13" fill={club.primary} opacity="0.55" />

        {full && (
          <g opacity="0.28" transform="translate(32 33) scale(1.85)" fill={ink}>
            <path d={EMBLEMS[emblem]} />
          </g>
        )}

        <rect x="0" y="0" width="64" height="64" fill={`url(#${shine})`} />
      </g>

      <path d={path} fill="none" stroke={`url(#${metal})`} strokeWidth="3" />
      <path d={path} fill="none" stroke="#000000" strokeWidth="0.9" opacity="0.42" />
      {/* bisel interno: dá relevo à borda e separa o escudo do fundo escuro */}
      <path
        d={path}
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.8"
        opacity="0.35"
        transform="translate(32 32) scale(0.945) translate(-32 -32)"
      />

      {stars > 0 && (
        <g>
          {Array.from({ length: stars }).map((_, i) => {
            const cx = 32 + (i - (stars - 1) / 2) * 8;
            return (
              <path
                key={i}
                transform={`translate(${cx} 11.5) scale(0.32)`}
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
        y={full ? 43 : 46}
        textAnchor="middle"
        fontSize={full ? 19 : 22}
        fontWeight="800"
        fill={ink}
        stroke={inkStroke}
        strokeWidth="2.8"
        paintOrder="stroke"
        style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif", letterSpacing: 0.8 }}
      >
        {club.short}
      </text>

      {full && (
        <text
          x="32"
          y="54"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill={ink}
          stroke={inkStroke}
          strokeWidth="1.5"
          paintOrder="stroke"
          opacity="0.9"
          style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif", letterSpacing: 1.4 }}
        >
          {founded}
        </text>
      )}
    </svg>
  );
}
