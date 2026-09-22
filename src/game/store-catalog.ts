/**
 * Metadados locais exclusivamente visuais da vitrine.
 *
 * Nomes, descrições, moedas e preços são dados comerciais e vêm sempre de
 * `store_products` por meio de `useStoreCatalog`. Preço, disponibilidade,
 * conteúdo e a referência da Stripe são resolvidos apenas no servidor.
 */

export type PackKind = "coins" | "scout" | "training" | "cosmetic" | "pass";

export interface StorePresentation {
  key: string;
  kind: PackKind;
  /** Cores usadas somente no render 3D do pacote. */
  accent: string;
  accent2: string;
}

export const STORE_PRESENTATIONS: StorePresentation[] = [
  {
    key: "coins_starter",
    kind: "coins",
    accent: "#ffe08a",
    accent2: "#8a6a12",
  },
  {
    key: "coins_small",
    kind: "coins",
    accent: "#f5c542",
    accent2: "#8a5a12",
  },
  {
    key: "coins_medium",
    kind: "coins",
    accent: "#ffd977",
    accent2: "#7a4a08",
  },
  {
    key: "coins_large",
    kind: "coins",
    accent: "#ffe9a8",
    accent2: "#6a3d05",
  },
  {
    key: "celebration_pack",
    kind: "cosmetic",
    accent: "#fb7185",
    accent2: "#651224",
  },
  {
    key: "stadium_pack",
    kind: "cosmetic",
    accent: "#34d399",
    accent2: "#064e3b",
  },
  {
    key: "scout_pack",
    kind: "scout",
    accent: "#57b6ff",
    accent2: "#0f3f6b",
  },
  {
    key: "training_pack",
    kind: "training",
    accent: "#4ade80",
    accent2: "#14532d",
  },
  {
    key: "theme_pack",
    kind: "cosmetic",
    accent: "#c084fc",
    accent2: "#3b1170",
  },
  {
    key: "season_pass",
    kind: "pass",
    accent: "#ffb547",
    accent2: "#5a2c00",
  },
];

export const PACK_BY_KEY: Record<string, StorePresentation> = Object.fromEntries(
  STORE_PRESENTATIONS.map((presentation) => [presentation.key, presentation]),
);

export function formatPrice(cents: number, currency = "brl"): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toLocaleString("pt-BR")} ${currency || "BRL"}`;
  }
}
