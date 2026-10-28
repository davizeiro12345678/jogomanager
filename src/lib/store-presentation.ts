/** Lightweight art palette and money formatting for public commerce routes.
 * Legacy hardcoded product descriptions/prices must not be imported by the live catalog.
 */
import type { PackKind } from "@/game/store-catalog";

export interface StorePresentation {
  accent: string;
  accent2: string;
}

const BY_KIND: Record<PackKind, StorePresentation> = {
  coins: { accent: "#ffe08a", accent2: "#8a6a12" },
  scout: { accent: "#57b6ff", accent2: "#0f3f6b" },
  training: { accent: "#4ade80", accent2: "#14532d" },
  cosmetic: { accent: "#c084fc", accent2: "#3b1170" },
  pass: { accent: "#ffb547", accent2: "#5a2c00" },
  bundle: { accent: "#ffe9a8", accent2: "#6a3d05" },
};

const BY_KEY: Record<string, StorePresentation> = {
  coins_starter: { accent: "#ffe08a", accent2: "#8a6a12" },
  coins_small: { accent: "#f5c542", accent2: "#8a5a12" },
  coins_medium: { accent: "#ffd977", accent2: "#7a4a08" },
  coins_large: { accent: "#ffe9a8", accent2: "#6a3d05" },
  celebration_pack: { accent: "#fb7185", accent2: "#651224" },
  stadium_pack: { accent: "#34d399", accent2: "#064e3b" },
  scout_pack: { accent: "#57b6ff", accent2: "#0f3f6b" },
  training_pack: { accent: "#4ade80", accent2: "#14532d" },
  theme_pack: { accent: "#c084fc", accent2: "#3b1170" },
  season_pass: { accent: "#ffb547", accent2: "#5a2c00" },
};

export function storePresentation(key: string, kind: string): StorePresentation {
  return BY_KEY[key] ?? BY_KIND[kind as PackKind] ?? BY_KIND.cosmetic;
}

export function formatStoreCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
