import { useState } from "react";

import { useServerFn } from "@tanstack/react-start";

import { Link } from "@tanstack/react-router";

import { toast } from "sonner";

import { Crest } from "@/components/game/Crest";

import { GameShell } from "@/components/game/GameShell";

import { NoCareer, ScreenHeader } from "@/components/game/screen-kit";

import { runPremiumScouting, runScouting } from "@/game/career";

import { CLUBS } from "@/game/data/leagues";

import { formatMoney } from "@/game/economy";

import { useCareer } from "@/hooks/useCareer";

import { spendScoutReportFn } from "@/lib/wallet-items.functions";

import { PREMIUM_SCOUT_REPORT_SIZE } from "@/lib/wallet-rules";

export function ScoutingPage() {
  const { career, update } = useCareer();
  const spendReport = useServerFn(spendScoutReportFn);
  const [isUsingReport, setIsUsingReport] = useState(false);
  if (!career) return <NoCareer />;

  async function handlePremiumScouting() {
    if (!career || isUsingReport) return;
    setIsUsingReport(true);
    try {
      const result = await spendReport();
      if (!result.ok) {
        toast.error(
          result.reason === "no_report"
            ? "Você não tem relatórios premium. Consiga mais na loja."
            : "Não foi possível usar o relatório agora. Tente novamente.",
        );
        return;
      }
      update(runPremiumScouting(career, `${Date.now()}`, PREMIUM_SCOUT_REPORT_SIZE));
      toast.success(
        result.freeWithPass
          ? "Relatório do passe usado: 5 joias mapeadas."
          : `Relatório usado: 5 joias mapeadas. Restam ${result.scoutReports}.`,
      );
    } catch {
      toast.error("Entre na sua conta para usar relatórios premium.");
    } finally {
      setIsUsingReport(false);
    }
  }

  return (
    <GameShell career={career}>
      <div className="flex flex-wrap items-center gap-3">
        <ScreenHeader title="Olheiros" />
        <span className="text-xs text-muted-foreground">
          Departamento nível {career.staff.olheiro}/5
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePremiumScouting()}
            disabled={isUsingReport}
            className="rounded-lg border border-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary disabled:opacity-50"
          >
            {isUsingReport ? "Mapeando…" : "Relatório premium"}
          </button>
          <button
            type="button"
            onClick={() => update(runScouting(career))}
            className="rounded-lg bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground"
          >
            Enviar olheiros
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        O relatório premium mapeia as {PREMIUM_SCOUT_REPORT_SIZE} maiores promessas de até 23 anos
        de clubes sorteados. Relatórios vêm nos pacotes da{" "}
        <Link to="/loja" className="text-primary underline underline-offset-4">
          loja
        </Link>{" "}
        e são ilimitados com o passe de temporada.
      </p>

      {career.scoutReports.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum relatório ainda. Envie seus olheiros para mapear o mercado.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {career.scoutReports.map((r) => {
            const c = CLUBS[r.clubId];
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-border/40 surface-card p-3"
              >
                {c ? <Crest club={c} size={36} /> : null}
                <div>
                  <p className="font-medium">
                    {r.name} <span className="text-xs text-muted-foreground">{r.pos}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c?.name} · {r.age} anos · OVR {r.ovr} · potencial {r.potential}
                  </p>
                </div>
                <span className="ml-auto font-display text-sm">{formatMoney(r.value)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </GameShell>
  );
}
