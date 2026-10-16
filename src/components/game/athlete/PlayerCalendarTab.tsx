import { CLUBS } from "@/game/data/leagues";
import { opponentFor, seasonLength } from "@/game/player-career/engine";
import type { PlayerCareerState } from "@/game/player-career/types";

export function PlayerCalendarTab({ state }: { state: PlayerCareerState }) {
  const end = seasonLength(state);
  const count = state.retired ? 0 : Math.min(8, Math.max(0, end - state.week + 1));
  const upcoming = Array.from({ length: count }, (_, index) => {
    const week = state.week + index;
    const fixture = opponentFor({ ...state, week });
    return { week, ...fixture };
  });

  return (
    <div className="grid gap-4">
      <section className="athlete-card">
        <h2 className="text-lg font-bold">Próximos compromissos</h2>
        <p className="athlete-meta mt-1">
          Calendário da liga na temporada {state.season}, segundo a simulação do jogo.
        </p>
        {upcoming.length === 0 ? (
          <p className="athlete-meta mt-3">Não há rodadas restantes nesta carreira.</p>
        ) : (
          <ol className="athlete-news mt-3">
            {upcoming.map(({ week, club, home }) => (
              <li key={week} className="flex flex-wrap items-center justify-between gap-2">
                <strong>Semana {week}</strong>
                <span>
                  {home ? "Casa" : "Fora"} · {club.name}
                </span>
                {week === state.week && <span className="athlete-meta">Próximo jogo</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="athlete-card">
        <h2 className="text-lg font-bold">Partidas recentes</h2>
        {!state.recent.length ? (
          <p className="athlete-meta mt-3">Seu atleta ainda não disputou uma rodada.</p>
        ) : (
          <ol className="athlete-news mt-3">
            {state.recent.map((match, index) => (
              <li key={`${match.week}-${match.opponentId}-${index}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>Semana {match.week}</strong>
                  <span>
                    {match.home ? "Casa" : "Fora"} ·{" "}
                    {CLUBS[match.opponentId]?.name ?? match.opponentId}
                  </span>
                </div>
                <p className="athlete-meta mt-1">
                  {match.goalsFor} × {match.goalsAgainst} · {match.minutes} minutos
                  {" · "}Nota {match.rating?.toFixed(1) ?? "—"}
                  {" · "}
                  {match.goals} gols · {match.assists} assistências
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
