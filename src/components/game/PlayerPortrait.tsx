import { useId, useMemo } from "react";

import { hairFor, skinFor } from "@/game/kits";
import { hashSeed } from "@/game/rng";
import type { Player } from "@/game/types";

/**
 * Retrato vetorial determinístico do jogador: rosto, cabelo, barba, sobrancelha
 * e camisa nas cores do clube. Sem imagens externas — escala sem perder nitidez.
 */
export function PlayerPortrait({
  player,
  size = 72,
  primary = "#0a8f3c",
  secondary = "#ffffff",
}: {
  player: Player;
  size?: number;
  primary?: string;
  secondary?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const f = useMemo(() => {
    const h = hashSeed(`${player.id}-${player.name}`);
    const pick = <T,>(arr: readonly T[], salt: number) => arr[Math.floor(h / salt) % arr.length]!;
    return {
      skin: player.photo ? skinFor(player.id) : skinFor(player.id),
      hair: hairFor(player.id),
      hairStyle: pick(["curto", "raspado", "topete", "cacheado", "coque", "moicano"] as const, 3),
      beard: pick(["nenhuma", "cavanhaque", "cheia", "bigode"] as const, 11),
      brow: 0.8 + ((h >> 5) % 5) * 0.1,
      jaw: 26 + ((h >> 9) % 6),
      ear: 1 + ((h >> 13) % 3) * 0.15,
    };
  }, [player.id, player.name, player.photo]);

  const bg = `bg${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Retrato de ${player.name}`}
      className="shrink-0"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={primary} stopOpacity="0.85" />
          <stop offset="100%" stopColor={secondary} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="14" fill={`url(#${bg})`} />
      <rect width="100" height="100" rx="14" fill="#05100b" opacity="0.25" />

      {/* ombros / camisa */}
      <path d="M18 100 q6 -22 32 -24 q26 2 32 24 z" fill={primary} />
      <path d="M50 76 l-9 6 l9 10 l9 -10 z" fill={secondary} opacity="0.9" />

      {/* pescoço */}
      <rect x="43" y="62" width="14" height="16" rx="6" fill={f.skin} />

      {/* orelhas */}
      <ellipse cx="28" cy="46" rx={4 * f.ear} ry={6 * f.ear} fill={f.skin} />
      <ellipse cx="72" cy="46" rx={4 * f.ear} ry={6 * f.ear} fill={f.skin} />

      {/* rosto */}
      <path
        d={`M30 40 q0 -18 20 -18 q20 0 20 18 q0 ${f.jaw} -20 ${f.jaw} q-20 0 -20 -${f.jaw}`}
        fill={f.skin}
      />

      {/* cabelo */}
      {f.hairStyle !== "raspado" && (
        <path
          d={
            f.hairStyle === "topete"
              ? "M29 40 q1 -26 21 -26 q20 0 21 26 q-6 -14 -21 -12 q-13 -1 -21 12"
              : f.hairStyle === "cacheado"
                ? "M28 42 q-2 -30 22 -30 q24 0 22 30 q-5 -8 -11 -6 q-6 -8 -12 0 q-8 -4 -11 6"
                : f.hairStyle === "moicano"
                  ? "M44 16 q6 -6 12 0 l0 22 l-12 0 z"
                  : "M29 42 q0 -28 21 -28 q21 0 21 28 q-4 -12 -21 -12 q-17 0 -21 12"
          }
          fill={f.hair}
        />
      )}
      {f.hairStyle === "coque" && <circle cx="50" cy="12" r="7" fill={f.hair} />}
      {f.hairStyle === "raspado" && (
        <path d="M30 40 q0 -18 20 -18 q20 0 20 18 q-6 -8 -20 -8 q-14 0 -20 8" fill={f.hair} opacity="0.55" />
      )}

      {/* sobrancelhas + olhos */}
      <rect x="36" y={44 - f.brow * 2} width="10" height="2.4" rx="1.2" fill={f.hair} />
      <rect x="54" y={44 - f.brow * 2} width="10" height="2.4" rx="1.2" fill={f.hair} />
      <ellipse cx="41" cy="49" rx="3.4" ry="2.6" fill="#ffffff" />
      <ellipse cx="59" cy="49" rx="3.4" ry="2.6" fill="#ffffff" />
      <circle cx="41" cy="49" r="1.5" fill="#221a12" />
      <circle cx="59" cy="49" r="1.5" fill="#221a12" />

      {/* nariz e boca */}
      <path d="M50 51 l-2.5 8 q2.5 2 5 0 z" fill="#000000" opacity="0.14" />
      <path d="M44 64 q6 4 12 0" stroke="#000000" strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* barba */}
      {f.beard === "cheia" && (
        <path d="M32 52 q2 22 18 22 q16 0 18 -22 q-4 16 -18 16 q-14 0 -18 -16" fill={f.hair} opacity="0.85" />
      )}
      {f.beard === "cavanhaque" && <ellipse cx="50" cy="67" rx="7" ry="6" fill={f.hair} opacity="0.85" />}
      {f.beard === "bigode" && <rect x="44" y="59" width="12" height="3" rx="1.5" fill={f.hair} opacity="0.85" />}

      {/* número da camisa */}
      <text
        x="50"
        y="95"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill={secondary}
        opacity="0.9"
      >
        {player.number}
      </text>
    </svg>
  );
}
