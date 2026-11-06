import { useMemo, useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyWeekAction, WEEK_ACTIONS, type WeekActionId } from "@/game/season-mode";
import { summarizeCoachSquad, suggestedWeekAction } from "@/game/coach-office";
import type { CareerState } from "@/game/types";

export function CoachWeekPlanner({
  career,
  busy,
  error,
  onRun,
}: {
  career: CareerState;
  busy: boolean;
  error: string;
  onRun: (action: WeekActionId) => void;
}) {
  const summary = useMemo(() => summarizeCoachSquad(career), [career]);
  const suggestion = suggestedWeekAction(summary, career.pressure);
  const [selected, setSelected] = useState<WeekActionId | null>(null);
  const actionId = selected ?? suggestion;
  const action = WEEK_ACTIONS.find((item) => item.id === actionId);
  const preview = useMemo(() => {
    const prepared = applyWeekAction(career, actionId);
    const next = summarizeCoachSquad(prepared);
    return [
      ["Moral", next.morale - summary.morale],
      ["Condição", next.condition - summary.condition],
      ["Forma", next.form - summary.form],
      ["Pressão", prepared.pressure - career.pressure],
    ] as const;
  }, [career, actionId, summary]);

  return (
    <section
      id="coach-week"
      className="coach-office-band"
      aria-labelledby="coach-week-title"
      aria-busy={busy}
    >
      <h2 id="coach-week-title">Trabalho da semana</h2>
      <p className="text-muted-foreground">
        Escolha o foco; avançar resolve automaticamente a próxima rodada.
      </p>
      <div className="coach-action-grid" role="group" aria-label="Foco da semana">
        {WEEK_ACTIONS.map((item) => (
          <Button
            key={item.id}
            variant="outline"
            className="coach-action"
            aria-pressed={actionId === item.id}
            disabled={busy || career.sacked}
            onClick={() => setSelected(item.id)}
          >
            <span className="coach-action-title">
              {item.label}
              {actionId === item.id ? <Check size={16} aria-hidden="true" /> : null}
            </span>
            <span className="text-muted-foreground">{item.desc}</span>
            {suggestion === item.id ? (
              <span className="text-primary">Indicado para o elenco atual</span>
            ) : null}
          </Button>
        ))}
      </div>
      <div className="coach-week-confirm">
        <div>
          <strong>{action?.label}</strong>
          <p className="text-muted-foreground">
            Efeito antes da partida; o resultado e o desgaste ainda podem alterar estes valores.
          </p>
          <dl className="coach-effect-list">
            {preview.map(([label, delta]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {delta > 0 ? "+" : ""}
                  {Math.round(delta)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <Button disabled={busy || career.sacked} onClick={() => onRun(actionId)}>
          {busy ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" size={16} />
          ) : (
            <ArrowRight size={16} />
          )}
          {busy ? "Resolvendo rodada…" : "Aplicar foco e avançar rodada"}
        </Button>
      </div>
      {career.sacked ? (
        <p role="status">
          Você está sem clube. Consulte as propostas na diretoria para voltar ao comando.
        </p>
      ) : null}
      {busy ? <p role="status">Simulando a rodada. Sua escolha está sendo processada.</p> : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
