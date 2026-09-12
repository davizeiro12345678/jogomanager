/**
 * Tema dinâmico por clube.
 *
 * As cores do clube escolhido viram tokens semânticos no documento, então
 * todos os componentes (que só usam bg-primary, text-primary, etc.) mudam de
 * cara junto com o time — sem nenhuma cor fixa espalhada pelo código.
 */
import { useEffect } from "react";

import type { Club } from "./types";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Clareia (t > 0) ou escurece (t < 0) uma cor hexadecimal. */
function shift(hex: string, t: number) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (v: number) =>
    Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t))
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

export function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Garante contraste mínimo com o fundo escuro do app. */
function readable(hex: string) {
  let out = hex;
  let guard = 0;
  while (luminance(out) < 0.22 && guard++ < 6) out = shift(out, 0.22);
  return out;
}

export function clubTheme(club: Club) {
  const primary = readable(club.primary);
  const accent = readable(
    club.secondary === club.primary ? shift(club.secondary, 0.3) : club.secondary,
  );
  return {
    primary,
    accent,
    primaryForeground: luminance(primary) > 0.5 ? "#0b0f14" : "#ffffff",
    glow: rgba(primary, 0.35),
  };
}

/**
 * Aplica as cores do clube como detalhe da interface.
 *
 * A identidade visual do produto é o verde do gramado, então o clube entra
 * apenas nos realces (--club-accent / --club-glow) e a cor principal dos
 * botões e destaques permanece consistente em todas as telas.
 */
export function useClubTheme(club: Club | undefined) {
  useEffect(() => {
    if (!club || typeof document === "undefined") return;
    const t = clubTheme(club);
    const root = document.documentElement;
    const previous = {
      clubColor: root.style.getPropertyValue("--club-color"),
      accent: root.style.getPropertyValue("--club-accent"),
      glow: root.style.getPropertyValue("--club-glow"),
    };
    root.style.setProperty("--club-color", t.primary);
    root.style.setProperty("--club-accent", t.accent);
    root.style.setProperty("--club-glow", rgba(t.primary, 0.22));
    return () => {
      root.style.setProperty("--club-color", previous.clubColor);
      root.style.setProperty("--club-accent", previous.accent);
      root.style.setProperty("--club-glow", previous.glow);
    };
  }, [club]);
}
