import { supabase } from "@/integrations/supabase/client";

export interface WalletState {
  coins: number;
  seasonPass: boolean;
}

const EMPTY_WALLET: WalletState = { coins: 0, seasonPass: false };

/** Reads the signed-in user's wallet. The wallet row is read-only for users:
 *  every credit or debit happens on the server (purchases, rewards, spends). */
export async function getWallet(): Promise<WalletState> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return EMPTY_WALLET;

  const { data, error } = await supabase
    .from("user_wallet")
    .select("coins, season_pass")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return EMPTY_WALLET;
  return { coins: data.coins, seasonPass: data.season_pass };
}

/**
 * Spends coins from the signed-in user's wallet through the server-side
 * `spend_coins` function, which verifies the balance atomically before
 * debiting. Returns the resulting wallet, or `null` when the balance is
 * insufficient. Users can no longer write their own balance directly.
 */
export async function spendCoins(amount: number): Promise<WalletState | null> {
  if (amount <= 0) throw new Error("O valor a gastar deve ser positivo.");

  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user.id) {
    throw new Error("É preciso estar logado para gastar moedas.");
  }

  const { data, error } = await supabase.rpc("spend_coins", { amount });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null; // saldo insuficiente
  return { coins: row.coins, seasonPass: row.season_pass };
}
