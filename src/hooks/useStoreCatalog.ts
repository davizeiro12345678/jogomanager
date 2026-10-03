import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Dados comerciais que a vitrine pode exibir.
 *
 * `store_products` possui leitura pública apenas para itens ativos. Compartilhar
 * esta consulta entre as superfícies públicas e autenticadas impede que a
 * vitrine anuncie um catálogo local diferente do catálogo atual da loja.
 */
export type StoreCatalogProduct = Pick<
  Database["public"]["Tables"]["store_products"]["Row"],
  | "key"
  | "name"
  | "description"
  | "price_cents"
  | "currency"
  | "coins"
  | "kind"
  | "sale_percent_off"
  | "sale_starts_at"
  | "sale_ends_at"
>;

export function useStoreCatalog() {
  return useQuery({
    queryKey: ["store_products", "public-catalog"],
    queryFn: async (): Promise<StoreCatalogProduct[]> => {
      const { data, error } = await supabase
        .from("store_products")
        .select(
          "key, name, description, price_cents, currency, coins, kind, sale_percent_off, sale_starts_at, sale_ends_at",
        )
        .eq("active", true)
        .order("price_cents", { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
    retry: 1,
  });
}

/** Preço com a promoção vigente (mesma regra do servidor, só para exibição). */
export function salePrice(
  p: StoreCatalogProduct,
  now = Date.now(),
): { cents: number; percent: number } {
  const pct = p.sale_percent_off ?? 0;
  const live =
    pct > 0 &&
    (!p.sale_starts_at || now >= Date.parse(p.sale_starts_at)) &&
    (!p.sale_ends_at || now <= Date.parse(p.sale_ends_at));
  return live
    ? { cents: Math.round(p.price_cents * (1 - pct / 100)), percent: pct }
    : { cents: p.price_cents, percent: 0 };
}
