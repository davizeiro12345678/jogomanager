import type { MyClub } from "@/lib/myClub";

export function KitPreview({ club }: { club: MyClub }) {
  const { kit } = club;
  return (
    <svg viewBox="0 0 100 110" width={120} height={132} role="img" aria-label="Prévia do uniforme">
      <defs>
        <clipPath id="shirt">
          <path d="M50 8 l18 6 l14 8 l-8 16 l-8 -4 v64 h-32 v-64 l-8 4 l-8 -16 l14 -8 z" />
        </clipPath>
      </defs>
      <path
        d="M50 8 l18 6 l14 8 l-8 16 l-8 -4 v64 h-32 v-64 l-8 4 l-8 -16 l14 -8 z"
        fill={kit.base}
      />
      <g clipPath="url(#shirt)">
        {kit.pattern === "stripes" &&
          [0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={22 + i * 12} y="0" width="6" height="110" fill={kit.detail} />
          ))}
        {kit.pattern === "hoops" &&
          [0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="0" y={20 + i * 16} width="100" height="8" fill={kit.detail} />
          ))}
        {kit.pattern === "sash" && <path d="M10 10 L95 80 L85 95 L0 26 z" fill={kit.detail} />}
        {kit.pattern === "halves" && (
          <rect x="50" y="0" width="50" height="110" fill={kit.detail} />
        )}
        {kit.pattern === "band" && <rect x="0" y="46" width="100" height="16" fill={kit.detail} />}
        {kit.pattern === "sleeves" && (
          <>
            <rect x="0" y="0" width="24" height="46" fill={kit.detail} />
            <rect x="76" y="0" width="24" height="46" fill={kit.detail} />
          </>
        )}
        {kit.pattern === "pin" &&
          Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x={i * 9} y="0" width="2" height="110" fill={kit.detail} opacity="0.7" />
          ))}
        {kit.pattern === "checks" &&
          Array.from({ length: 40 }).map((_, i) => (
            <rect
              key={i}
              x={(i % 8) * 13}
              y={Math.floor(i / 8) * 22}
              width="13"
              height="22"
              fill={i % 2 ? kit.detail : "transparent"}
              opacity="0.8"
            />
          ))}
        {kit.pattern === "gradient" && (
          <rect x="0" y="55" width="100" height="55" fill={kit.detail} opacity="0.55" />
        )}
      </g>
      <path
        d="M50 8 l18 6 l14 8 l-8 16 l-8 -4 v64 h-32 v-64 l-8 4 l-8 -16 l14 -8 z"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
      />
      <rect x="36" y="98" width="12" height="10" fill={kit.shorts} />
      <rect x="52" y="98" width="12" height="10" fill={kit.socks} />
    </svg>
  );
}
