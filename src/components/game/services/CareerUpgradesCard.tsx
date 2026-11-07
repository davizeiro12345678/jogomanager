import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, FileSignature, Sprout } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GuestSignInButton } from "@/components/store/GuestSignInNotice";
import { Button } from "@/components/ui/button";
import { StadiumUpgradePreview } from "./StadiumUpgradePreview";
import {
  applyContractRenewal,
  applyStadiumUpgrade,
  contractRenewalCandidates,
  applyYouthBoost,
  canUpgradeStadium,
  youthBoostCandidates,
} from "@/game/coin-services";
import type { CareerState } from "@/game/types";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { spendCoinsOnService } from "@/lib/coin-services.functions";
import {
  CAREER_SERVICES,
  CONTRACT_MAX_YEARS,
  CONTRACT_RENEWAL_YEARS,
  STADIUM_UPGRADE_MAX_LEVEL,
  STADIUM_UPGRADE_RATE,
  YOUTH_BOOST_MAX_AGE,
  YOUTH_BOOST_POTENTIAL,
  type CareerService,
} from "@/lib/wallet-rules";

const youth = CAREER_SERVICES.youth_boost;
const stadium = CAREER_SERVICES.stadium_upgrade;
const renewal = CAREER_SERVICES.contract_renewal;

/** Coin investments: youth development and stadium expansion, charged by the server first. */
export function CareerUpgradesCard({
  career,
  onApply,
}: {
  career: CareerState;
  onApply: (next: CareerState) => void;
}) {
  const userId = useAuthUserId();
  const spend = useServerFn(spendCoinsOnService);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const candidates = youthBoostCandidates(career).slice(0, 5);
  const expiring = contractRenewalCandidates(career).slice(0, 5);

  async function buy(service: CareerService, key: string, apply: () => CareerState, done: string) {
    if (busy) return;
    setBusy(key);
    try {
      const result = await spend({ data: { service, requestId: crypto.randomUUID() } });
      if (!result.ok) {
        const { cost, weeklyLimit } = CAREER_SERVICES[service];
        toast.error(
          result.reason === "not_enough_coins"
            ? `Você precisa de ${cost} moedas.`
            : result.reason === "weekly_limit"
              ? `Limite de ${weeklyLimit} por semana atingido.`
              : "Não foi possível concluir agora. Suas moedas não foram gastas.",
        );
        return;
      }
      onApply(apply());
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.success(`${done} Saldo: ${result.coins} moedas.`);
    } catch {
      toast.error("Não foi possível concluir agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="upgrades-title" className="mb-6 border-y border-border py-4">
      <h2
        id="upgrades-title"
        className="font-display text-sm uppercase tracking-[0.2em] text-primary"
      >
        Investimentos com moedas
      </h2>
      {userId === null ? (
        <div className="mt-3">
          <GuestSignInButton />
        </div>
      ) : null}

      <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sprout size={16} aria-hidden="true" /> Acelerar evolução
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        +{YOUTH_BOOST_POTENTIAL} de potencial para um jogador de até {YOUTH_BOOST_MAX_AGE} anos ·{" "}
        {youth.cost} moedas · até {youth.weeklyLimit} por semana.
      </p>
      {candidates.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhum jovem no elenco pode receber o reforço agora.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border/50">
          {candidates.map((p) => {
            const now = p.potential ?? p.ovr;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.age} anos · potencial {now} → {Math.min(99, now + YOUTH_BOOST_POTENTIAL)}
                  </span>
                </span>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!userId || busy !== null}
                  onClick={() =>
                    void buy(
                      "youth_boost",
                      p.id,
                      () => applyYouthBoost(career, p.id),
                      `${p.name} ganhou +${YOUTH_BOOST_POTENTIAL} de potencial.`,
                    )
                  }
                  className="min-h-11 shrink-0 rounded-lg border border-primary/50 px-3 text-xs font-semibold text-primary disabled:opacity-50"
                >
                  {busy === p.id ? "Aplicando…" : `Evoluir · ${youth.cost} moedas`}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Building2 size={16} aria-hidden="true" /> Melhoria do estádio
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        +{Math.round(STADIUM_UPGRADE_RATE * 100)}% de capacidade · até {STADIUM_UPGRADE_MAX_LEVEL}{" "}
        ampliações · {stadium.cost} moedas · até {stadium.weeklyLimit} por semana.
      </p>
      <StadiumUpgradePreview career={career} />
      <div className="mt-2 text-sm">
        <Button
          variant="outline"
          type="button"
          disabled={!userId || busy !== null || !canUpgradeStadium(career)}
          onClick={() =>
            void buy(
              "stadium_upgrade",
              "stadium",
              () => applyStadiumUpgrade(career),
              "Estádio ampliado.",
            )
          }
          className="min-h-11 shrink-0 rounded-lg border border-primary/50 px-3 text-xs font-semibold text-primary disabled:opacity-50"
        >
          {!canUpgradeStadium(career)
            ? "Nível máximo"
            : busy === "stadium"
              ? "Ampliando…"
              : `Ampliar · ${stadium.cost} moedas`}
        </Button>
      </div>
      <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileSignature size={16} aria-hidden="true" /> Renegociar contrato
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        +{CONTRACT_RENEWAL_YEARS} anos de contrato com o mesmo salário (máx. {CONTRACT_MAX_YEARS}) ·{" "}
        {renewal.cost} moedas · até {renewal.weeklyLimit} por semana.
      </p>
      {expiring.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Todos os contratos já estão no máximo.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border/50">
          {expiring.map((p) => {
            const years = p.contractYears ?? 2;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Contrato: {years} →{" "}
                    {Math.min(CONTRACT_MAX_YEARS, years + CONTRACT_RENEWAL_YEARS)} anos
                  </span>
                </span>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!userId || busy !== null}
                  onClick={() =>
                    void buy(
                      "contract_renewal",
                      `c-${p.id}`,
                      () => applyContractRenewal(career, p.id),
                      `Contrato de ${p.name} renovado.`,
                    )
                  }
                  className="min-h-11 shrink-0 rounded-lg border border-primary/50 px-3 text-xs font-semibold text-primary disabled:opacity-50"
                >
                  {busy === `c-${p.id}` ? "Renovando…" : `Renovar · ${renewal.cost} moedas`}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
