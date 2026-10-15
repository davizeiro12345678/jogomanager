import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { GROUP_LABEL } from "@/game/player-career/attributes";
import { advanceWeek, opponentFor, prepareMoments, trainingOutlook } from "@/game/player-career/engine";
import type { AttributeGroup, PlayerCareerState, TrainingIntensity } from "@/game/player-career/types";

export function WeekTab({
  state,
  commit,
}: {
  state: PlayerCareerState;
  commit: (s: PlayerCareerState) => void;
}) {
  const [focus, setFocus] = useState<AttributeGroup[]>(
    state.position === "GOL" ? ["goleiro", "mental"] : ["tecnico", "fisico"],
  );
  const [intensity, setIntensity] = useState<TrainingIntensity>("normal");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const outlook = trainingOutlook(state, intensity);
  if (state.retired)
    return (
      <p className="athlete-card athlete-meta">Carreira encerrada. Veja o legado em Histórico.</p>
    );
  const { club: opp, home } = opponentFor(state);
  const moments = state.pendingMoment?.week === state.week ? state.pendingMoment.moments : null;
  const options: AttributeGroup[] =
    state.position === "GOL"
      ? ["goleiro", "fisico", "mental", "tecnico"]
      : ["tecnico", "fisico", "mental", "defensivo"];
  const toggle = (g: AttributeGroup) =>
    setFocus((f) => (f.includes(g) ? f.filter((x) => x !== g) : [...f.slice(-1), g]));
  const play = () => {
    commit(advanceWeek(state, { focus: focus.length ? focus : [options[0]!], intensity, choices }));
    setChoices({});
  };
  const last = state.lastMatch;
  const lastOpp = last ? CLUBS[last.opponentId] : undefined;
  const myClub = CLUBS[state.clubId];

  return (
    <div className="athlete-grid">
      <section className="athlete-card grid gap-4">
        <div>
          <h2 className="font-bold">Próximo jogo</h2>
          <div className="athlete-score my-2">
            {myClub && <Crest club={myClub} size={44} />}
            <span className="athlete-meta">{home ? "casa" : "fora"}</span>
            <span>×</span>
            {opp && <Crest club={opp} size={44} />}
          </div>
          <p className="athlete-meta text-center">
            {myClub?.short} × {opp?.name}
          </p>
        </div>
        <div>
          <h2 className="font-bold">
            Treino da semana <span className="athlete-meta">(escolha 2 áreas)</span>
          </h2>
          <div className="athlete-chips mt-2">
            {options.map((g) => (
              <button
                key={g}
                type="button"
                className="athlete-chip"
                aria-pressed={focus.includes(g)}
                onClick={() => toggle(g)}
              >
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <div className="athlete-chips mt-2">
            {(["leve", "normal", "pesado"] as TrainingIntensity[]).map((i) => (
              <button
                key={i}
                type="button"
                className="athlete-chip"
                aria-pressed={intensity === i}
                onClick={() => setIntensity(i)}
              >
                {i[0]!.toUpperCase() + i.slice(1)}
                <br />
                <small className="athlete-meta">
                  risco de lesão {(trainingOutlook(state, i).injuryRisk * 100).toFixed(1)}%
                </small>
              </button>
            ))}
          </div>
          <div className="grid gap-1 mt-3" aria-live="polite">
            <p className="athlete-meta">Energia atual: {Math.round(state.energy)}%</p>
            <p className="athlete-meta">
              Energia prevista após o treino: {Math.round(outlook.energyAfter)}%
            </p>
            <p className="athlete-meta">
              Risco estimado de lesão: {(outlook.injuryRisk * 100).toFixed(1)}%
            </p>
            {outlook.energyAfter < 40 && (
              <p className="athlete-meta" role="status">
                Energia baixa: prefira treino leve ou recuperação antes de jogar.
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-2">
          <h2 className="font-bold">Seus lances decisivos</h2>
          {!moments ? (
            <>
              <p className="athlete-meta">
                Decida você mesmo os momentos importantes do jogo, ou deixe a simulação decidir pelo
                jeito mais seguro.
              </p>
              <Button variant="outline" onClick={() => commit(prepareMoments(state))}>
                Decidir meus lances
              </Button>
            </>
          ) : (
            moments.map((m) => (
              <div key={m.id} className="athlete-moment">
                <strong>
                  {m.minute}' — {m.prompt}
                </strong>
                <div className="athlete-chips">
                  {m.options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="athlete-chip"
                      aria-pressed={choices[m.id] === o.id}
                      onClick={() => setChoices((c) => ({ ...c, [m.id]: o.id }))}
                    >
                      {o.label}
                      <br />
                      <small className="athlete-meta">risco {Math.round(o.risk * 100)}%</small>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="athlete-card athlete-report" aria-live="polite">
        <h2 className="font-bold">Último jogo</h2>
        {!last ? (
          <p className="athlete-meta">Ainda não houve jogo. Escolha o treino e jogue a semana.</p>
        ) : (
          <>
            <div className="athlete-score">
              {myClub?.short} {last.goalsFor} × {last.goalsAgainst} {lastOpp?.short}
            </div>
            <p className="athlete-meta text-center">
              {last.role === "titular"
                ? "Titular"
                : last.role === "reserva"
                  ? "Reserva"
                  : "Fora do jogo"}{" "}
              · {last.minutes} min
            </p>
            {last.rating !== null && (
              <div className="text-center">
                <div className="athlete-rating">{last.rating.toFixed(1)}</div>
                {last.motm && <p className="font-bold">Melhor em campo</p>}
              </div>
            )}
            <p className="text-center">
              {last.goals} gol(s) · {last.assists} assistência(s)
            </p>
            <ul className="athlete-news">
              {last.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      <div className="athlete-sticky">
        <Button size="lg" onClick={play}>
          Jogar semana
        </Button>
      </div>
    </div>
  );
}
