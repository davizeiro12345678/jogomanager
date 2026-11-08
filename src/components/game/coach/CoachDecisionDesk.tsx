import { useId, useRef, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyCoachDecision, coachDecision, coachDecisionId } from "@/game/coach-decisions";
import type { CareerState } from "@/game/types";

export function CoachDecisionDesk({
  career,
  busy,
  onCommit,
}: {
  career: CareerState;
  busy: boolean;
  onCommit: (career: CareerState) => void;
}) {
  const groupId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState("");
  const event = coachDecision(career);
  const latest = career.world?.memories.find(({ id }) => id === coachDecisionId(career));
  const review = career.world?.memories.find(
    ({ id, clubId }) =>
      clubId === career.clubId && id.startsWith("coach-decision:") && id.endsWith(":review"),
  );
  const activeChoice = event?.options.find(({ id }) => id === selected);
  return (
    <section
      className="coach-office-band coach-decisions"
      id="coach-decisions"
      aria-labelledby="coach-decisions-title"
    >
      <div className="coach-section-heading">
        <h2 id="coach-decisions-title" ref={heading} tabIndex={-1}>
          <ClipboardList size={20} aria-hidden="true" /> Mesa de decisões
        </h2>
        <span className="coach-decision-kicker">Rodada {career.round}</span>
      </div>
      {review ? (
        <details className="coach-decision-review">
          <summary>Última avaliação da diretoria</summary>
          <p>
            <strong>{review.title}</strong> · Rodada {review.round}
          </p>
          <p className="text-muted-foreground">{review.detail}</p>
        </details>
      ) : null}
      {latest ? (
        <p className="coach-decision-receipt" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>
            <strong>{latest.title}</strong>
            {latest.detail}
          </span>
        </p>
      ) : event ? (
        <>
          <p className="coach-decision-kicker">{event.category}</p>
          <h3>{event.title}</h3>
          <p className="text-muted-foreground">{event.context}</p>
          <fieldset className="coach-decision-options" disabled={busy}>
            <legend>Escolha como conduzir a situação</legend>
            {event.options.map((option) => (
              <label className="coach-decision-option" key={option.id}>
                <input
                  type="radio"
                  name={groupId}
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => setSelected(option.id)}
                />
                <span>
                  <strong>{option.title}</strong>
                  <span>{option.tradeoff}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="coach-decision-footer">
            <p>
              Você pode avançar sem responder. Se confirmar, a decisão fica no histórico desta
              rodada.
            </p>
            <Button
              type="button"
              disabled={!activeChoice || busy}
              onClick={() => {
                if (!activeChoice) return;
                const next = applyCoachDecision(career, event.id, activeChoice.id);
                if (next !== career) {
                  onCommit(next);
                  heading.current?.focus({ preventScroll: true });
                }
              }}
            >
              Confirmar decisão
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">
          A comissão não tem uma decisão urgente nesta rodada.
        </p>
      )}
    </section>
  );
}
