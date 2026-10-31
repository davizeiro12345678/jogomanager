import { useState } from "react";

import { useServerFn } from "@tanstack/react-start";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { claimSeasonPassCoins, exchangeCoinsForItem } from "@/lib/wallet-items.functions";

import { COIN_EXCHANGE, SEASON_PASS_WEEKLY_COINS, type ExchangeItem } from "@/lib/wallet-rules";

const EXCHANGE_LABEL: Record<ExchangeItem, string> = {
  scout_report: "1 relatório de olheiro",
  training_boost: "1 impulso de treino",
};

/** Lets a signed-in player turn coins into items and claim the pass weekly coins. */
export function WalletActions({
  coins,
  passActive,
  onChanged,
}: {
  coins: number;
  passActive: boolean;
  onChanged: () => void;
}) {
  const exchange = useServerFn(exchangeCoinsForItem);
  const claim = useServerFn(claimSeasonPassCoins);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleExchange(item: ExchangeItem) {
    if (busy) return;
    setBusy(item);
    try {
      const result = await exchange({ data: { item } });
      if (result.ok) {
        toast.success(`Trocado: ${EXCHANGE_LABEL[item]}.`);
        onChanged();
      } else {
        toast.error(
          result.reason === "not_enough_coins"
            ? "Moedas insuficientes para esta troca."
            : "Não foi possível trocar agora.",
        );
      }
    } catch {
      toast.error("Não foi possível trocar agora.");
    } finally {
      setBusy(null);
    }
  }

  async function handleClaim() {
    if (busy) return;
    setBusy("pass");
    try {
      const result = await claim();
      if (!result.ok) {
        toast.error("Não foi possível resgatar agora.");
      } else if (result.claimed) {
        toast.success(`${SEASON_PASS_WEEKLY_COINS} moedas do passe creditadas.`);
        onChanged();
      } else if (result.nextClaimAt) {
        toast.info(
          `Próximo resgate em ${new Date(result.nextClaimAt).toLocaleDateString("pt-BR")}.`,
        );
      }
    } catch {
      toast.error("Não foi possível resgatar agora.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Usar moedas:</span>
      {(Object.keys(COIN_EXCHANGE) as ExchangeItem[]).map((item) => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null || coins < COIN_EXCHANGE[item]}
          onClick={() => void handleExchange(item)}
        >
          {EXCHANGE_LABEL[item]} · {COIN_EXCHANGE[item]} moedas
        </Button>
      ))}
      {passActive ? (
        <Button type="button" size="sm" disabled={busy !== null} onClick={() => void handleClaim()}>
          Resgatar {SEASON_PASS_WEEKLY_COINS} moedas da semana
        </Button>
      ) : null}
    </div>
  );
}
