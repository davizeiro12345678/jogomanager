import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GuestSignInButton } from "@/components/store/GuestSignInNotice";
import { opponentReport } from "@/game/coin-services";
import type { CareerState } from "@/game/types";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useStoredServices } from "@/hooks/useStoredServices";
import { spendCoinsOnService } from "@/lib/coin-services.functions";
import { CAREER_SERVICES } from "@/lib/wallet-rules";

const { cost } = CAREER_SERVICES.opponent_report;

/** Tactical report on the next opponent, unlocked with coins for that match. */
export function OpponentReportCard({ career }: { career: CareerState }) {
  const report = opponentReport(career);
  const userId = useAuthUserId();
  const spend = useServerFn(spendCoinsOnService);
  const queryClient = useQueryClient();
  const stored = useStoredServices(userId).data?.opponentReports ?? 0;
  const key = report ? `jm.opp-report:${career.clubId}:${career.season}:${report.round}` : "";
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(Boolean(key) && localStorage.getItem(key) === "1");
    } catch {
      setUnlocked(false);
    }
  }, [key]);

  if (!report) return null;

  async function unlock() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await spend({
        data: { service: "opponent_report", requestId: crypto.randomUUID() },
      });
      if (!result.ok) {
        toast.error(
          result.reason === "not_enough_coins"
            ? `Você precisa de ${cost} moedas para o relatório.`
            : result.reason === "weekly_limit"
              ? "Limite semanal de relatórios atingido."
              : "Não foi possível gerar o relatório agora.",
        );
        return;
      }
      try {
        localStorage.setItem(key, "1");
      } catch {
        // Still shown for this visit.
      }
      setUnlocked(true);
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch {
      toast.error("Não foi possível gerar o relatório agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="opp-report-title"
      className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-4"
    >
      <h2
        id="opp-report-title"
        className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.2em] text-primary"
      >
        <FileSearch size={16} aria-hidden="true" /> Relatório do adversário
      </h2>
      {unlocked ? (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="block text-xs text-muted-foreground">Situação</span>
            {report.opponentName} ·{" "}
            {report.position ? `${report.position}º na tabela` : "sem posição"} ·{" "}
            {report.atHome ? "você joga em casa" : "você joga fora"}
          </p>
          <p>
            <span className="block text-xs text-muted-foreground">Últimos jogos</span>
            {report.form.length ? report.form.join(" ") : "Ainda sem jogos"}
          </p>
          <p>
            <span className="block text-xs text-muted-foreground">Média de gols</span>
            {report.goalsForAvg} marcados · {report.goalsAgainstAvg} sofridos por jogo
            {report.secondHalfGoalShare !== null
              ? ` · ${report.secondHalfGoalShare}% no 2º tempo`
              : ""}
          </p>
          <p>
            <span className="block text-xs text-muted-foreground">Como devem jogar</span>
            {report.approach}
          </p>
          <p className="sm:col-span-2 rounded-lg bg-primary/10 p-3 text-foreground">
            <span className="block text-xs text-primary">Recomendação do auxiliar</span>
            {report.advice}
          </p>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Forma, média de gols, estilo provável e uma recomendação tática para enfrentar{" "}
            {report.opponentName}.
          </p>
          {userId === null ? (
            <GuestSignInButton />
          ) : (
            <button
              type="button"
              disabled={busy || !userId}
              onClick={() => void unlock()}
              className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy
                ? "Gerando…"
                : stored > 0
                  ? `Ver relatório · usar 1 de ${stored} guardados`
                  : `Ver relatório · ${cost} moedas`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
