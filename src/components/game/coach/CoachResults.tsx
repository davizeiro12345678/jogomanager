import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { coachResults } from "@/game/coach-office";
import type { CareerState, MatchLogEntry } from "@/game/types";

type ResultTone = "V" | "E" | "D";

function toneOf(result: MatchLogEntry): ResultTone {
  return result.gf > result.ga ? "V" : result.gf === result.ga ? "E" : "D";
}

const TONE_LABEL: Record<ResultTone, string> = {
  V: "Vitória",
  E: "Empate",
  D: "Derrota",
};

export function CoachResults({ career }: { career: CareerState }) {
  const results = coachResults(career);
  const competitions = useMemo(() => [...new Set(results.map((result) => result.comp))], [results]);
  const [competition, setCompetition] = useState("all");
  const visible = useMemo(
    () =>
      competition === "all" ? results : results.filter((result) => result.comp === competition),
    [results, competition],
  );
  const totals = useMemo(() => {
    const wins = visible.filter((r) => r.gf > r.ga).length;
    const draws = visible.filter((r) => r.gf === r.ga).length;
    const goalsFor = visible.reduce((sum, r) => sum + r.gf, 0);
    const goalsAgainst = visible.reduce((sum, r) => sum + r.ga, 0);
    return { wins, draws, losses: visible.length - wins - draws, goalsFor, goalsAgainst };
  }, [visible]);
  // Forma: os 5 jogos mais recentes do recorte, do mais antigo ao mais novo.
  const form = useMemo(() => visible.slice(0, 5).map(toneOf).reverse(), [visible]);

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
        <>
          {competitions.length > 1 ? (
            <div className="coach-results-filters" role="group" aria-label="Filtrar por competição">
              <button
                type="button"
                aria-pressed={competition === "all"}
                onClick={() => setCompetition("all")}
              >
                Todas
              </button>
              {competitions.map((comp) => (
                <button
                  key={comp}
                  type="button"
                  aria-pressed={competition === comp}
                  onClick={() => setCompetition(comp)}
                >
                  {comp}
                </button>
              ))}
            </div>
          ) : null}
          <div className="coach-results-summary">
            <dl>
              <div>
                <dt>Jogos</dt>
                <dd>{visible.length}</dd>
              </div>
              <div>
                <dt>V–E–D</dt>
                <dd>
                  {totals.wins}–{totals.draws}–{totals.losses}
                </dd>
              </div>
              <div>
                <dt>Gols</dt>
                <dd>
                  {totals.goalsFor}–{totals.goalsAgainst}
                </dd>
              </div>
            </dl>
            {form.length ? (
              <ol className="coach-results-form" aria-label="Últimos cinco resultados">
                {form.map((tone, index) => (
                  <li key={index} data-result={tone} aria-label={TONE_LABEL[tone]}>
                    {tone}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          <ol className="coach-results-list">
            {visible.map((result, index) => {
              const opponent = CLUBS[result.opponentId];
              const tone = toneOf(result);
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
                  <span className="coach-result-score" data-result={tone}>
                    {result.gf}–{result.ga}
                    <small>{TONE_LABEL[tone]}</small>
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="coach-empty">
          Nenhuma partida registrada ainda. Escolha o trabalho da semana para disputar a primeira
          rodada.
        </p>
      )}
    </section>
  );
}
