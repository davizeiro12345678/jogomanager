import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { HeartPulse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GuestSignInButton } from "@/components/store/GuestSignInNotice";
import { applyInjuryRecovery } from "@/game/coin-services";
import type { CareerState } from "@/game/types";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { spendCoinsOnService } from "@/lib/coin-services.functions";
import { CAREER_SERVICES, INJURY_RECOVERY_WEEKS } from "@/lib/wallet-rules";

const { cost, weeklyLimit } = CAREER_SERVICES.injury_recovery;

/** Medical department: spend coins to shorten one player's injury. */
export function InjuryRecoveryCard({
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
  const injured = Object.values(career.players)
    .filter((p) => p.injuryWeeks > 0)
    .sort((a, b) => b.ovr - a.ovr);
  if (injured.length === 0) return null;

  async function treat(playerId: string) {
    if (busy) return;
    setBusy(playerId);
    try {
      const result = await spend({ data: { service: "injury_recovery", requestId: crypto.randomUUID() } });
      if (!result.ok) {
        toast.error(
          result.reason === "not_enough_coins"
            ? `Você precisa de ${cost} moedas para o tratamento.`
            : result.reason === "weekly_limit"
              ? `Limite de ${weeklyLimit} tratamentos por semana atingido.`
              : "Não foi possível fazer o tratamento agora.",
        );
        return;
      }
      onApply(applyInjuryRecovery(career, playerId));
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.success(`Tratamento feito: −${INJURY_RECOVERY_WEEKS} semanas de lesão. Saldo: ${result.coins} moedas.`);
    } catch {
      toast.error("Não foi possível fazer o tratamento agora.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="medical-title" className="mb-6 rounded-2xl border border-border/60 bg-card/60 p-4">
      <h2 id="medical-title" className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.2em] text-primary">
        <HeartPulse size={16} aria-hidden="true" /> Departamento médico
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tratamento intensivo: {cost} moedas tiram {INJURY_RECOVERY_WEEKS} semanas da lesão de um jogador. Até {weeklyLimit} por semana.
      </p>
      {userId === null ? (
        <div className="mt-3">
          <GuestSignInButton />
        </div>
      ) : null}
      <ul className="mt-3 divide-y divide-border/50">
        {injured.slice(0, 6).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>
              <span className="font-medium text-foreground">{p.name}</span>
              <span className="block text-xs text-muted-foreground">
                {p.injuryWeeks} {p.injuryWeeks === 1 ? "semana" : "semanas"} fora · OVR {p.ovr}
              </span>
            </span>
            <button
              type="button"
              disabled={!userId || busy !== null}
              onClick={() => void treat(p.id)}
              className="min-h-11 shrink-0 rounded-lg border border-primary/50 px-3 text-xs font-semibold text-primary disabled:opacity-50"
            >
              {busy === p.id ? "Tratando…" : `Tratar · ${cost} moedas`}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
