import { seasonLength } from "@/game/player-career/engine";
import { seasonObjectives } from "@/game/player-career/objectives";
import type { PlayerCareerState } from "@/game/player-career/types";
export function PlayerObjectives({ state }: { state: PlayerCareerState }) {
  const objectives = seasonObjectives(state, seasonLength(state));
  const finished = objectives.filter((objective) => objective.complete).length;
  return (
    <>
      {" "}
      {!state.retired && (
        <section className="athlete-card athlete-objectives" aria-labelledby="career-goals-heading">
          <div className="athlete-objectives-heading">
            <div>
              <p className="athlete-eyebrow">PLANO DA TEMPORADA</p>
              <h2 id="career-goals-heading" className="text-xl font-bold">
                Seus objetivos e consequências
              </h2>
              <p className="athlete-meta">
                {finished} de {objectives.length} metas cumpridas. Resultados são avaliados no fim
                da temporada e afetam moral, confiança e reputação.
              </p>
            </div>
            <span
              className="athlete-objectives-score"
              aria-label={`${finished} de ${objectives.length} metas alcançadas`}
            >
              {finished}/{objectives.length}
            </span>
          </div>
          <div className="athlete-objectives-list">
            {objectives.map((objective) => (
              <article
                key={objective.id}
                className="athlete-objective"
                data-complete={objective.complete}
              >
                <div className="athlete-objective-title">
                  <h3 className="font-bold">{objective.title}</h3>
                  <span>{objective.complete ? "Meta alcançada" : objective.display}</span>
                </div>
                <div
                  className="athlete-objective-track"
                  role="progressbar"
                  aria-label={objective.title}
                  aria-valuemin={0}
                  aria-valuemax={objective.target}
                  aria-valuenow={Math.max(0, Math.min(objective.current, objective.target))}
                  aria-valuetext={objective.display}
                >
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, (objective.current / objective.target) * 100))}%`,
                    }}
                  />
                </div>
                <p className="athlete-meta">{objective.detail}</p>
                <p className="athlete-objective-impact">{objective.consequence}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
