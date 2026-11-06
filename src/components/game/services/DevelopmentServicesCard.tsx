import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GuestSignInButton } from "@/components/store/GuestSignInNotice";
import {
  applyPremiumScout,
  applyTrainingUpgrade,
  canUpgradeTraining,
  premiumScoutCandidates,
} from "@/game/coin-services-training";
import type { CareerState } from "@/game/types";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { spendCoinsOnService } from "@/lib/coin-services.functions";
import { CAREER_SERVICES } from "@/lib/wallet-rules";

export function DevelopmentServicesCard({
  career,
  onApply,
  mode,
}: {
  career: CareerState;
  onApply: (next: CareerState) => void;
  mode: "training" | "scouting";
}) {
  const userId = useAuthUserId();
  const spend = useServerFn(spendCoinsOnService);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const latest = useRef(career);
  latest.current = career;
  const [target, setTarget] = useState("");
  const service = mode === "training" ? "training_upgrade" : "premium_scout";
  const rule = CAREER_SERVICES[service];
  const candidates = useMemo(
    () => (mode === "scouting" ? premiumScoutCandidates(career).slice(0, 40) : []),
    [mode, career],
  );
  const playerId = target || candidates[0]?.id || "";
  const valid =
    mode === "training"
      ? canUpgradeTraining(career)
      : candidates.some((player) => player.id === playerId);
  async function buy() {
    if (!userId || inFlight.current || !valid) return;
    inFlight.current = true;
    setBusy(true);
    const source = latest.current;
    try {
      const result = await spend({ data: { service, requestId: crypto.randomUUID() } });
      if (!result.ok) {
        toast.error(
          result.reason === "weekly_limit"
            ? "Limite semanal atingido."
            : result.reason === "not_enough_coins"
              ? `Você precisa de ${rule.cost} moedas.`
              : "Não foi possível concluir o serviço.",
        );
        return;
      }
      const current = latest.current;
      if (
        current.clubId !== source.clubId ||
        current.season !== source.season ||
        current.round !== source.round
      ) {
        toast.error(
          "A carreira mudou durante o pedido. Confira seu histórico de moedas antes de tentar novamente.",
        );
        return;
      }
      onApply(
        mode === "training" ? applyTrainingUpgrade(current) : applyPremiumScout(current, playerId),
      );
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.success(
        mode === "training"
          ? "Próximo exercício desta rodada: +50% de evolução detalhada."
          : "Relatório individual revelado.",
      );
    } catch {
      toast.error("Não foi possível concluir. Confira sua conexão e tente novamente.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const Icon = mode === "training" ? Dumbbell : Search;
  return (
    <section className="my-4 border-y border-border py-4" aria-labelledby={`service-${mode}`}>
      <h2 id={`service-${mode}`} className="flex items-center gap-2 font-display text-lg">
        <Icon size={20} aria-hidden />
        {mode === "training" ? "Aprimorar treino" : "Olheiro individual premium"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "training"
          ? "+50% de ganho nos atributos detalhados do exercício desta rodada; não acumula e não altera o desgaste."
          : "Revela a força e o potencial reais de um jogador desta carreira, sem sortear outro atleta."}{" "}
        {rule.cost} moedas · até {rule.weeklyLimit} usos em 7 dias.
      </p>
      {!userId ? (
        <div className="mt-3">
          <GuestSignInButton />
        </div>
      ) : null}
      {mode === "scouting" ? (
        <label className="mt-3 block text-sm">
          Jogador observado
          <select
            className="mt-1 block min-h-11 w-full max-w-md rounded-md border border-input bg-background px-3"
            value={playerId}
            onChange={(event) => setTarget(event.target.value)}
            disabled={busy || candidates.length === 0}
          >
            {candidates.length === 0 ? (
              <option value="">Todos os alvos já têm relatório</option>
            ) : (
              candidates.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} · {player.pos} · {player.age} anos
                </option>
              ))
            )}
          </select>
        </label>
      ) : null}
      <Button
        className="mt-3"
        variant="outline"
        disabled={!userId || busy || !valid}
        onClick={() => void buy()}
      >
        {busy
          ? "Aplicando…"
          : valid
            ? `Aplicar · ${rule.cost} moedas`
            : mode === "training"
              ? "Treino aplicado ou aprimoramento já ativo"
              : "Sem alvo disponível"}
      </Button>
    </section>
  );
}
