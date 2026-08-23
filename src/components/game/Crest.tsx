import type { Club } from "@/game/types";

export function Crest({ club, size = 44 }: { club: Club; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Escudo ${club.name}`}
      className="shrink-0 drop-shadow"
    >
      <path
        d="M32 2 L60 10 V32 C60 48 46 58 32 62 C18 58 4 48 4 32 V10 Z"
        fill={club.primary}
        stroke={club.secondary}
        strokeWidth="3"
      />
      <path d="M32 2 L60 10 V22 H4 V10 Z" fill={club.secondary} opacity="0.85" />
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fill={club.secondary}
        style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif", letterSpacing: 1 }}
      >
        {club.short}
      </text>
    </svg>
  );
}
