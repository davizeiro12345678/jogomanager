import artCoins from "@/assets/store/coins.jpg?format=webp&w=640&quality=65&as=url";
import artScout from "@/assets/store/scout.jpg?format=webp&w=640&quality=65&as=url";
import artTraining from "@/assets/store/training.jpg?format=webp&w=640&quality=65&as=url";
import artCosmetic from "@/assets/store/cosmetic.jpg?format=webp&w=640&quality=65&as=url";
import artPass from "@/assets/store/pass.jpg?format=webp&w=640&quality=65&as=url";

import { PACK_BY_KEY, type PackKind } from "@/game/store-catalog";

export const STORE_KIND_IMAGE: Record<PackKind, string> = {
  coins: artCoins,
  scout: artScout,
  training: artTraining,
  cosmetic: artCosmetic,
  pass: artPass,
  bundle: artCoins,
};

/**
 * Historical purchases can outlive a SKU in the public RLS catalog.
 * Resolve their image by stable SKU prefix, never by trusting a remote URL.
 */
export function storeArtworkForProduct(key: string, kind?: string): string {
  const resolved = kind ?? PACK_BY_KEY[key]?.kind;
  if (resolved && resolved in STORE_KIND_IMAGE) {
    return STORE_KIND_IMAGE[resolved as PackKind];
  }
  if (key.startsWith("coins_")) return artCoins;
  if (key.startsWith("scout_")) return artScout;
  if (key.startsWith("training_")) return artTraining;
  if (key.startsWith("bundle_")) return artCoins;
  if (key === "vip_monthly" || key === "premium_max_monthly") return artPass;
  return artCosmetic;
}
