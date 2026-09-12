// ============================================================================
//  ai-budget.server.ts
//  Teto de gasto mensal com IA: R$ 350 para texto/moderação e R$ 150 para voz.
//  Toda chamada reserva o custo estimado ANTES de sair; quando o mês estoura o
//  teto, o pedido é recusado em vez de gerar custo.
// ============================================================================

export type BudgetKind = "text" | "voice";

/** Custo estimado por pedido, em centavos de real. */
export const ESTIMATED_COST_CENTS: Record<BudgetKind, number> = {
  text: 3,
  voice: 2,
};

/**
 * Reserva o custo de um pedido. Devolve false quando o teto do mês já foi
 * atingido — nesse caso o chamador deve recusar o pedido sem chamar o provedor.
 */
export async function reserveAiBudget(
  kind: BudgetKind,
  cents = ESTIMATED_COST_CENTS[kind],
): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("reserve_ai_budget", {
      _kind: kind,
      _cents: cents,
    });
    if (error) {
      console.error("reserve_ai_budget falhou", error.message);
      // Falha de contabilidade não pode derrubar o jogo: segue e registra.
      return true;
    }
    return data === true;
  } catch (err) {
    console.error("reserve_ai_budget indisponível", err);
    return true;
  }
}
