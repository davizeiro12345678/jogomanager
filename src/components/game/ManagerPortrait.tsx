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
        <linearGradient id={`mp-bg-${h}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16202b" />
          <stop offset="100%" stopColor="#0b1118" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="48" fill={ring} opacity="0.35" />
      <g clipPath={`url(#mp-clip-${h}-${b}-${look.skin})`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#mp-bg-${h})`} />

        {/* ombros / roupa */}
        <path d="M12 100 C16 78 32 70 50 70 C68 70 84 78 88 100 Z" fill={outfit.body} />
        <path d="M42 70 L50 84 L58 70 L52 68 L48 68 Z" fill={outfit.collar} />
        <rect x="46" y="70" width="8" height="30" fill={ring} opacity="0.7" />

        {/* pescoço e cabeça */}
        <rect x="43" y="58" width="14" height="14" rx="6" fill={skin} />
        <ellipse cx="50" cy="43" rx="19" ry="22" fill={skin} />
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
        <rect x="39" y="40" width="8" height="2" rx="1" fill={hair} />
        <rect x="53" y="40" width="8" height="2" rx="1" fill={hair} />
        <ellipse cx="43" cy="45" rx="2.6" ry="2.9" fill="#fff" />
        <ellipse cx="57" cy="45" rx="2.6" ry="2.9" fill="#fff" />
        <circle cx="43" cy="45.4" r="1.4" fill="#20303f" />
        <circle cx="57" cy="45.4" r="1.4" fill="#20303f" />

        {/* nariz e boca */}
        <path d="M50 46 L48 52 L52 52 Z" fill="#00000022" />
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
