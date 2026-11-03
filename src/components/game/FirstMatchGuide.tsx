import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Compass, X } from "lucide-react";
import { useEffect, useState } from "react";
import { onboardingProgress, type OnboardingVisit } from "@/game/onboarding";
import type { CareerState } from "@/game/types";
import { readOnboardingVisits } from "@/lib/onboarding-progress";

const dismissKey = (clubId: string) => `onboard-done:${clubId}:1`;

/** Step-by-step guide from the chosen club to the first match. */
export function FirstMatchGuide({ career }: { career: CareerState }) {
  const [visits, setVisits] = useState<Set<OnboardingVisit>>(() => new Set());
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Storage is read after hydration so server and client markup match.
    setVisits(readOnboardingVisits(career.clubId));
    try {
      setDismissed(localStorage.getItem(dismissKey(career.clubId)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [career.clubId]);

  const progress = onboardingProgress(career, visits);
  if (dismissed || progress.complete || career.season > 1) return null;
  const pct = Math.round((progress.doneCount / progress.steps.length) * 100);

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(career.clubId), "1");
    } catch {
      // The current visit can still hide the guide.
    }
    setDismissed(true);
  };

  return (
    <section
      aria-labelledby="first-match-guide-title"
      className="mb-6 rounded-2xl border border-primary/40 bg-primary/10 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            <Compass size={14} aria-hidden="true" /> Primeiros passos
          </p>
          <h2 id="first-match-guide-title" className="mt-1 font-display text-lg text-foreground">
            Do clube escolhido à primeira partida
          </h2>
          <p className="text-sm text-muted-foreground">
            {progress.doneCount} de {progress.steps.length} passos concluídos.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Ocultar guia: já conheço o jogo"
        >
          <X size={18} />
        </button>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Progresso dos primeiros passos"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>

      {progress.next ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-primary">Próximo passo</p>
            <p className="font-medium text-foreground">{progress.next.title}</p>
            <p className="text-sm text-muted-foreground">{progress.next.hint}</p>
          </div>
          <Link
            to={progress.next.to}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {progress.next.cta} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {progress.steps.map((step, index) => (
          <li key={step.id}>
            <Link
              to={step.to}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-background/40"
            >
              <span
                className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  step.done
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {step.done ? <Check size={13} /> : index + 1}
              </span>
              <span
                className={step.done ? "text-muted-foreground line-through" : "text-foreground"}
              >
                {step.title}
              </span>
              <span className="sr-only">{step.done ? "(concluído)" : "(pendente)"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
