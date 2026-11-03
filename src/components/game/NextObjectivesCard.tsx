import { Link } from "@tanstack/react-router";
import { ArrowRight, Flag, Hourglass, Target, Trophy, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { CareerState } from "@/game/types";
import { nextObjectives, returnReminder, type NextObjective } from "@/game/next-objectives";

const ICONS: Record<NextObjective["id"], typeof Target> = {
  pressure: TriangleAlert,
  board: Target,
  match: Flag,
  milestone: Trophy,
  season: Flag,
};

const visitKey = (career: CareerState) => `jm.last-visit:${career.clubId}`;

/** Next clear goals for the season plus a welcome-back reminder after a break. */
export function NextObjectivesCard({ career }: { career: CareerState }) {
  const objectives = nextObjectives(career);
  const [reminder, setReminder] = useState<string | null>(null);

  useEffect(() => {
    // Read storage after hydration so server and client markup match.
    try {
      const raw = localStorage.getItem(visitKey(career));
      const last = raw ? Number(raw) : null;
      setReminder(returnReminder(last, career, Date.now())?.message ?? null);
      localStorage.setItem(visitKey(career), String(Date.now()));
    } catch {
      setReminder(null);
    }
    // Only on entering the screen for this club, not on every save update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career.clubId]);

  if (objectives.length === 0) return null;
  return (
    <section
      aria-labelledby="next-objectives-title"
      className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4"
    >
      {reminder ? (
        <p
          role="status"
          className="mb-3 flex items-start gap-2 rounded-lg bg-background/60 p-3 text-sm text-foreground"
        >
          <Hourglass size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {reminder} Seu próximo objetivo: <strong>{objectives[0]!.title}</strong>.
          </span>
        </p>
      ) : null}
      <h2
        id="next-objectives-title"
        className="font-display text-sm uppercase tracking-[0.2em] text-primary"
      >
        Próximos objetivos
      </h2>
      <ol className="mt-3 grid gap-3 md:grid-cols-3">
        {objectives.map((objective) => {
          const Icon = ICONS[objective.id];
          return (
            <li
              key={objective.id}
              className="flex flex-col rounded-xl border border-border/60 bg-card/60 p-3"
            >
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Icon size={16} className="shrink-0 text-primary" aria-hidden="true" />
                {objective.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{objective.detail}</p>
              {objective.progress !== null ? (
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`Progresso: ${objective.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(objective.progress * 100)}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(objective.progress * 100)}%` }}
                  />
                </div>
              ) : null}
              <Link
                to={objective.to}
                className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {objective.cta} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
