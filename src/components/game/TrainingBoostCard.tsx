import { useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Link } from "@tanstack/react-router";

import { useServerFn } from "@tanstack/react-start";

import { Dumbbell } from "lucide-react";

import { toast } from "sonner";

import { SectionCard } from "@/components/game/screen-kit";

import type { CareerState } from "@/game/types";

import { activateTrainingBoost, boostActive, getBoostState } from "@/lib/boost.functions";

const BOOST_QUERY_KEY = ["training-boost"] as const;

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Shows stored training boosts and applies one to the current career. */
export function TrainingBoostCard({
  career,
  onApply,
}: {
  career: CareerState;
  onApply: (next: CareerState) => void;
}) {
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getBoostState);
  const activate = useServerFn(activateTrainingBoost);
  const [isActivating, setIsActivating] = useState(false);
  const boostQuery = useQuery({ queryKey: BOOST_QUERY_KEY, queryFn: () => fetchState(), retry: 0 });

  const active = boostActive(boostQuery.data);
  const activeUntil = boostQuery.data?.activeUntil ?? null;
  const boostsLeft = boostQuery.data?.boostsLeft ?? 0;

  async function handleActivate() {
    if (isActivating) return;
    setIsActivating(true);
    try {
      const result = await activate();
      if (!result.ok) {
        toast.error(
          result.reason === "no_boost"
            ? "Você não tem impulsos guardados. Consiga mais na loja."
            : "Não foi possível ativar o impulso agora.",
        );
        return;
      }
      if (result.activeUntil) onApply({ ...career, boostUntil: result.activeUntil });
      await queryClient.invalidateQueries({ queryKey: BOOST_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.success("Impulso ativado: +25% de evolução e +5 de recuperação por 7 dias.");
    } catch {
      toast.error("Entre na sua conta para usar impulsos de treino.");
    } finally {
      setIsActivating(false);
    }
  }

  // Keep the career in step with a boost activated on another device.
  const careerBoostStale =
    active && activeUntil && career.boostUntil !== activeUntil ? activeUntil : null;

  return (
    <SectionCard className="mt-4 rounded-2xl border border-primary/40 surface-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Dumbbell className="text-primary" size={20} aria-hidden />
        <h2 className="font-display text-lg uppercase tracking-wide">Impulso de treino</h2>
        <span className="text-xs text-muted-foreground">
          {boostQuery.isError ? "Entre na conta para ver seus impulsos" : `${boostsLeft} guardados`}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada impulso dá +25% de evolução e +5 de recuperação por 7 dias. Vários impulsos se somam.
      </p>
      {active && activeUntil ? (
        <p role="status" className="mt-2 text-sm text-primary">
          Ativo até {formatDay(activeUntil)}.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleActivate()}
          disabled={isActivating || boostsLeft < 1}
          className="rounded-lg bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {isActivating ? "Ativando…" : active ? "Somar mais 7 dias" : "Ativar impulso"}
        </button>
        {careerBoostStale ? (
          <button
            type="button"
            onClick={() => onApply({ ...career, boostUntil: careerBoostStale })}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Aplicar nesta carreira
          </button>
        ) : null}
        {boostsLeft < 1 ? (
          <Link
            to="/loja"
            className="self-center text-sm text-primary underline underline-offset-4"
          >
            Conseguir impulsos
          </Link>
        ) : null}
      </div>
    </SectionCard>
  );
}
