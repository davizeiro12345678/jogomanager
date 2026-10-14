/**
 * Retrato vetorial do treinador, desenhado a partir do perfil criado
 * no início do jogo. Sem imagens externas — tudo SVG determinístico.
 */
import type { ManagerLook } from "@/game/types";

const SKINS = ["#f2d4bb", "#e8bd97", "#d29a6e", "#b57748", "#8a5433", "#5c3721"];
const OUTFITS = [
  { body: "#1b2432", collar: "#f4f4f5", accent: "#c8a24a" }, // terno
  { body: "#123d2c", collar: "#0f5132", accent: "#8bd6a6" }, // agasalho
  { body: "#2f3a45", collar: "#4c5966", accent: "#9fb3c8" }, // casual
];

export interface ManagerPortraitProps {
  look: ManagerLook;
  size?: number;
  /** cor de destaque do clube */
  accent?: string;
  className?: string;
}

export function ManagerPortrait({ look, size = 96, accent, className }: ManagerPortraitProps) {
  const skin = SKINS[Math.abs(look.skin) % SKINS.length]!;
  const outfit = OUTFITS[Math.abs(look.outfit) % OUTFITS.length]!;
  const hair = look.hairColor || "#2b2118";
  const h = Math.abs(look.hair) % 7;
  const b = Math.abs(look.beard) % 5;
  const ring = accent ?? outfit.accent;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Retrato do treinador"
    >
      <defs>
        <clipPath id={`mp-clip-${h}-${b}-${look.skin}`}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
        <radialGradient id={`mp-bg-${h}`} cx="50%" cy="18%" r="85%">
          <stop offset="0%" stopColor="#2c4a36" />
          <stop offset="55%" stopColor="#14202a" />
          <stop offset="100%" stopColor="#080d12" />
        </radialGradient>
        {/* Soft key light from top-left gives the face volume instead of a flat disc. */}
        <radialGradient id="mp-face-shade" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </radialGradient>
        <linearGradient id="mp-cloth-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="48" fill={ring} opacity="0.35" />
      <g clipPath={`url(#mp-clip-${h}-${b}-${look.skin})`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#mp-bg-${h})`} />

        {/* ombros / roupa */}
        <path d="M12 100 C16 78 32 70 50 70 C68 70 84 78 88 100 Z" fill={outfit.body} />
        <path d="M12 100 C16 78 32 70 50 70 C68 70 84 78 88 100 Z" fill="url(#mp-cloth-shade)" />
        <path d="M42 70 L50 86 L58 70 L52 68 L48 68 Z" fill={outfit.collar} />
        <path d="M48.5 74 L51.5 74 L53 92 L50 96 L47 92 Z" fill={ring} opacity="0.85" />
        {/* lapels */}
        <path d="M36 73 L44 71 L50 88 Z" fill="#000000" opacity="0.22" />
        <path d="M64 73 L56 71 L50 88 Z" fill="#000000" opacity="0.22" />
        <circle cx="66" cy="82" r="1.6" fill={ring} opacity="0.9" />

        {/* pescoço e cabeça */}
        <rect x="43" y="58" width="14" height="14" rx="6" fill={skin} />
        <rect x="43" y="62" width="14" height="5" fill="#000000" opacity="0.18" />
        <path
          d="M31 40 C31 24 69 24 69 40 L68 50 C66 61 58 66 50 66 C42 66 34 61 32 50 Z"
          fill={skin}
        />
        <path
          d="M31 40 C31 24 69 24 69 40 L68 50 C66 61 58 66 50 66 C42 66 34 61 32 50 Z"
          fill="url(#mp-face-shade)"
        />
        {/* orelhas */}
        <ellipse cx="31" cy="45" rx="3.4" ry="5" fill={skin} />
        <ellipse cx="69" cy="45" rx="3.4" ry="5" fill={skin} />

        {/* cabelo */}
        {h === 0 ? null : h === 1 ? (
          <path d="M31 40 C33 24 67 24 69 40 C64 32 36 32 31 40 Z" fill={hair} />
        ) : h === 2 ? (
          <path d="M30 42 C30 22 70 22 70 42 C70 32 62 28 50 28 C38 28 30 32 30 42 Z" fill={hair} />
        ) : h === 3 ? (
          <>
            <path d="M30 42 C30 22 70 22 70 42 C66 30 34 30 30 42 Z" fill={hair} />
            <path d="M30 42 C26 46 26 56 30 60 L32 44 Z" fill={hair} />
            <path d="M70 42 C74 46 74 56 70 60 L68 44 Z" fill={hair} />
          </>
        ) : h === 4 ? (
          <path d="M31 41 C31 26 69 26 69 41 C62 36 56 44 50 38 C44 44 38 36 31 41 Z" fill={hair} />
        ) : h === 5 ? (
          <>
            <path d="M32 38 C36 26 64 26 68 38 C60 33 40 33 32 38 Z" fill={hair} />
            <circle cx="50" cy="24" r="6" fill={hair} />
          </>
        ) : (
          <path d="M32 44 C28 24 72 24 68 44 C68 30 32 30 32 44 Z" fill={hair} opacity="0.9" />
        )}

        {/* sobrancelhas e olhos */}
        <path
          d="M38.5 41 Q43 38.6 47.5 40.4"
          stroke={hair}
          strokeWidth="1.9"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M52.5 40.4 Q57 38.6 61.5 41"
          stroke={hair}
          strokeWidth="1.9"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx="43" cy="45.2" rx="2.9" ry="2.1" fill="#f6f3ee" />
        <ellipse cx="57" cy="45.2" rx="2.9" ry="2.1" fill="#f6f3ee" />
        <circle cx="43.2" cy="45.3" r="1.5" fill="#4a3424" />
        <circle cx="57.2" cy="45.3" r="1.5" fill="#4a3424" />
        <circle cx="43.2" cy="45.3" r="0.7" fill="#0d0d0d" />
        <circle cx="57.2" cy="45.3" r="0.7" fill="#0d0d0d" />
        <circle cx="43.8" cy="44.7" r="0.45" fill="#ffffff" />
        <circle cx="57.8" cy="44.7" r="0.45" fill="#ffffff" />
        <path
          d="M40 43.6 Q43 42.4 46 43.6"
          stroke="#000000"
          strokeOpacity="0.25"
          strokeWidth="0.6"
          fill="none"
        />
        <path
          d="M54 43.6 Q57 42.4 60 43.6"
          stroke="#000000"
          strokeOpacity="0.25"
          strokeWidth="0.6"
          fill="none"
        />

        {/* nariz e boca */}
        <path
          d="M50.5 45 Q52.5 51 51.5 52.5 Q50 53.4 48 52.6"
          stroke="#000000"
          strokeOpacity="0.22"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx="38" cy="52" rx="3.5" ry="2" fill="#c0504d" opacity="0.08" />
        <ellipse cx="62" cy="52" rx="3.5" ry="2" fill="#c0504d" opacity="0.08" />
        <path
          d="M45 57 Q50 60 55 57"
          stroke="#00000055"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />

        {/* barba */}
        {b === 1 ? (
          <path d="M44 57 h12 v3 h-12 Z" fill={hair} opacity="0.85" />
        ) : b === 2 ? (
          <path
            d="M33 46 C34 62 42 68 50 68 C58 68 66 62 67 46 C64 60 56 63 50 63 C44 63 36 60 33 46 Z"
            fill={hair}
            opacity="0.8"
          />
        ) : b === 3 ? (
          <path d="M34 48 C35 66 44 72 50 72 C56 72 65 66 66 48 C62 66 38 66 34 48 Z" fill={hair} />
        ) : b === 4 ? (
          <path
            d="M36 52 C38 64 44 66 50 66 C56 66 62 64 64 52 C58 62 42 62 36 52 Z"
            fill={hair}
            opacity="0.45"
          />
        ) : null}
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke={ring} strokeWidth="2.5" />
    </svg>
  );
}

export const HAIR_COLORS = [
  "#2b2118",
  "#131313",
  "#6b4423",
  "#b07d3a",
  "#d8cdbd",
  "#8c8c8c",
  "#7a2f1d",
];
