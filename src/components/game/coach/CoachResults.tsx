import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { coachResults } from "@/game/coach-office";
import type { CareerState } from "@/game/types";

export function CoachResults({ career }: { career: CareerState }) {
  const results = coachResults(career);
  return (
    <section id="coach-results" className="coach-office-band" aria-labelledby="coach-results-title">
      <div className="coach-section-heading">
        <h2 id="coach-results-title">Resultados da carreira</h2>
        <Link to="/history">Histórico completo</Link>
      </div>
      <p className="text-muted-foreground">
        <Trophy size={16} className="inline" aria-hidden="true" /> {career.trophies.length} títulos
        · {career.history.length} temporadas concluídas
      </p>
      {results.length ? (
        <ol className="coach-results-list">
          {results.map((result, index) => {
            const opponent = CLUBS[result.opponentId];
            return (
              <li key={`${result.season}-${result.round}-${result.comp}-${index}`}>
                {opponent ? <Crest club={opponent} size={32} detail="simple" /> : null}
                <div>
                  <strong>{opponent?.name ?? result.opponentId}</strong>
                  <p className="text-muted-foreground">
                    Temporada {result.season} · Rodada {result.round} · {result.comp} ·{" "}
                    {result.home ? "Casa" : "Fora"}
                  </p>
                </div>
                <span className="coach-result-score">
                  {result.gf}–{result.ga}
                  <small>
                    {result.gf > result.ga
                      ? "Vitória"
                      : result.gf === result.ga
                        ? "Empate"
                        : "Derrota"}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="coach-empty">
          Nenhuma partida registrada ainda. Escolha o trabalho da semana para disputar a primeira
          rodada.
        </p>
      )}
    </section>
  );
}
