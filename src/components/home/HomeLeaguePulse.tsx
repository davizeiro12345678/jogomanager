import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { LeagueDigest } from "@/lib/real-football.functions";

/** Real league leaders on the home page: fresh content for visitors and internal links for search. */
export function HomeLeaguePulse({ leagues }: { leagues: LeagueDigest[] }) {
  if (!leagues.length) return null;
  return (
    <section className="home-section" aria-labelledby="home-pulse-title">
      <div className="home-section-heading">
        <div>
          <p className="home-kicker">AGORA NAS LIGAS REAIS</p>
          <h2 id="home-pulse-title">Escolha um líder ou assuma a reconstrução.</h2>
        </div>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leagues.slice(0, 9).map((l) => (
          <li key={l.slug}>
            <Link
              to="/tabelas/$slug"
              params={{ slug: l.slug }}
              className="group flex items-center gap-3 rounded-xl border border-border/60 surface-card p-4 transition-colors hover:border-primary/60"
            >
              <span className="flex-1">
                <span className="block text-xs uppercase tracking-widest text-primary">
                  {l.name} · {l.country}
                </span>
                <strong className="mt-1 block font-display text-lg text-foreground">
                  {l.leader}
                </strong>
                <span className="block text-xs text-muted-foreground">
                  {l.leaderGap === 0 ? "Empate na ponta" : `${l.leaderGap} pts de vantagem`} ·{" "}
                  {l.goalsPerGame.toFixed(2)} gols/jogo
                </span>
              </span>
              <ChevronRight
                className="text-muted-foreground transition-transform group-hover:translate-x-1"
                size={18}
              />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/tabelas"
        className="mt-5 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        Ver todas as tabelas <ChevronRight size={14} />
      </Link>
    </section>
  );
}
