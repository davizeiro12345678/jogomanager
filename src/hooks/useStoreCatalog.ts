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
  "key" | "name" | "description" | "price_cents" | "currency" | "coins" | "kind"
>;

export function useStoreCatalog() {
  return useQuery({
    queryKey: ["store_products", "public-catalog"],
    queryFn: async (): Promise<StoreCatalogProduct[]> => {
      const { data, error } = await supabase
        .from("store_products")
        .select("key, name, description, price_cents, currency, coins, kind")
        .eq("active", true)
        .order("price_cents", { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
    retry: 1,
  });
}
