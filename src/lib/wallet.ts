import { supabase } from "@/integrations/supabase/client";

export interface WalletState {
  coins: number;
  seasonPass: boolean;
}

const EMPTY_WALLET: WalletState = { coins: 0, seasonPass: false };

/** Reads the signed-in user's wallet, creating a zeroed one if it doesn't exist yet. */
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
 * Spends coins from the signed-in user's wallet if the balance allows it.
 * Returns the resulting wallet, or `null` if the balance was insufficient.
 * Other game features (training boosts, cosmetics, etc.) can reuse this to
 * charge coins without duplicating the wallet update logic.
 */
export async function spendCoins(amount: number): Promise<WalletState | null> {
  if (amount <= 0) throw new Error("O valor a gastar deve ser positivo.");

  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("É preciso estar logado para gastar moedas.");

  const wallet = await getWallet();
  if (wallet.coins < amount) return null;

  const { data, error } = await supabase
    .from("user_wallet")
    .update({ coins: wallet.coins - amount })
    .eq("user_id", userId)
    .select("coins, season_pass")
    .single();
  if (error) throw new Error(error.message);
  return { coins: data.coins, seasonPass: data.season_pass };
}
