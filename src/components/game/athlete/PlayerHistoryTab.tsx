import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CLUBS } from "@/game/data/leagues";
import { careerTotals } from "@/game/player-career/engine";
import type { PlayerCareerState } from "@/game/player-career/types";
import { Stat } from "./PlayerStats";

export function HistoryTab({ state }: { state: PlayerCareerState }) {
  const t = careerTotals(state);
  const lines = [...state.history, ...(state.retired ? [] : [state.current])];
  return (
    <div className="grid gap-4">
      <section className="athlete-card athlete-bars">
        <Stat label="Jogos" value={t.apps} />
        <Stat label="Gols" value={t.goals} />
        <Stat label="Assist." value={t.assists} />
        <Stat label="Nota média" value={t.avg ? t.avg.toFixed(2) : "—"} />
        <Stat label="Seleção" value={`${state.nationalCaps} j / ${state.nationalGoals} g`} />
      </section>
      <section className="athlete-card athlete-scroll">
        <h2 className="font-bold mb-2">Temporadas</h2>
        <table className="athlete-table">
          <thead>
            <tr>
              <th>Temp.</th>
              <th>Idade</th>
              <th>Clube</th>
              <th>J</th>
              <th>G</th>
              <th>A</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>{l.season}</td>
                <td>{l.age}</td>
                <td>{CLUBS[l.clubId]?.short ?? l.clubId}</td>
                <td>{l.apps}</td>
                <td>{l.goals}</td>
                <td>{l.assists}</td>
                <td>{l.apps ? (l.ratingSum / l.apps).toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="athlete-card">
        <h2 className="font-bold mb-2">Prêmios</h2>
        {state.awards.length ? (
          <ul className="athlete-news">
            {state.awards.map((a, i) => (
              <li key={i} data-tone="good">
                {a}
              </li>
            ))}
          </ul>
        ) : (
          <p className="athlete-meta">Nenhum prêmio ainda.</p>
        )}
        {state.retired && (
          <Button asChild className="mt-3">
            <Link to="/new">Seguir como técnico</Link>
          </Button>
        )}
      </section>
    </div>
  );
}
