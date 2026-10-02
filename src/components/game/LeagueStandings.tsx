import { Fragment, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { CLUBS } from "@/game/data/leagues";
import { computeTable } from "@/game/season";
import { pyramidZones, REGIONAL_LINKS } from "@/game/pyramid";
import { leagueQualificationPreview } from "@/game/competition-season";
import { tableDetails } from "@/game/standings";
import type { CareerState, TableRow } from "@/game/types";
import { Crest } from "./Crest";

type Zone = "principal" | "preliminar" | "secondary" | "acesso" | "playoff" | "rebaixamento" | null;
const LABELS: Record<Exclude<Zone, null>, string> = {
  principal: "Continental · principal",
  preliminar: "Continental · preliminar",
  secondary: "Continental · secundária",
  acesso: "Acesso direto",
  playoff: "Mata-mata / playoff",
  rebaixamento: "Rebaixamento",
};
export function LeagueStandings({ career, table }: { career: CareerState; table: TableRow[] }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [expanded, setExpanded] = useState<string | null>(null);
  const zones = pyramidZones(
    career.leagueId,
    table.length,
    career.pyramidSlots,
    career.calendarYear ?? career.season,
  );
  const entries = leagueQualificationPreview(career, table);
  const regional = REGIONAL_LINKS[career.leagueId];
  const zoneOf = (row: TableRow, index: number): Zone => {
    if (regional)
      return index < Math.min(career.leagueId === "x5686" ? 8 : 4, table.length) ? "playoff" : null;
    if (zones[index]) return zones[index]!;
    const primary = entries.find(
      (e) => e.clubId === row.clubId && e.competitionId.startsWith("continental:"),
    );
    if (primary) return primary.phase;
    return entries.some(
      (e) =>
        e.clubId === row.clubId &&
        (e.competitionId.startsWith("secondary:") || e.competitionId.startsWith("conference:")),
    )
      ? "secondary"
      : null;
  };
  const lastRound = Math.max(
    0,
    ...career.fixtures.filter((f) => f.homeGoals !== null).map((f) => f.round),
  );
  const previous = lastRound
    ? computeTable({ ...career, fixtures: career.fixtures.filter((f) => f.round < lastRound) })
    : [];
  const rows = table.map((row, index) => ({
    row,
    index,
    zone: zoneOf(row, index),
    details: tableDetails(career.fixtures, row.clubId),
  }));
  const visible = rows.filter(
    ({ row, zone }) =>
      (CLUBS[row.clubId]?.name ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")) &&
      (filter === "all" || filter === zone || (filter === "mine" && row.clubId === career.clubId)),
  );
  const activeZones = [
    ...new Set(rows.map((r) => r.zone).filter((z): z is Exclude<Zone, null> => Boolean(z))),
  ];
  return (
    <section className="league-standings surface-card" aria-labelledby="league-standings-heading">
      <div className="league-table-heading">
        <div>
          <span className="career-eyebrow">Liga · {table.length} clubes</span>
          <h2 id="league-standings-heading">Classificação detalhada</h2>
        </div>
        <span className="league-table-status">
          {lastRound ? `Atualizada após a rodada ${lastRound}` : "Temporada ainda não iniciada"}
        </span>
      </div>
      <div className="league-table-filters">
        <label className="league-search">
          <Search aria-hidden size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clube"
            aria-label="Buscar clube na classificação"
          />
        </label>
        <label className="league-zone-filter">
          <span className="sr-only">Filtrar classificação</span>
          <select
            aria-label="Filtrar classificação"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos os clubes</option>
            <option value="mine">Meu clube</option>
            {activeZones.map((zone) => (
              <option key={zone} value={zone}>
                {LABELS[zone]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="league-zone-legend" aria-label="Legenda das zonas">
        {activeZones.map((zone) => (
          <span key={zone}>
            <i data-zone={zone} />
            {LABELS[zone]} <b>{rows.filter((r) => r.zone === zone).length}</b>
          </span>
        ))}
      </div>
      <div
        className="career-table-scroll league-table-scroll"
        role="region"
        tabIndex={0}
        aria-label="Tabela de classificação; role para ver todas as estatísticas"
      >
        <table className="league-details-table">
          <caption className="sr-only">
            Posição, pontos, jogos, vitórias, empates, derrotas, gols, aproveitamento, últimos cinco
            resultados e destino de cada clube
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col" className="league-club-column">
                Clube
              </th>
              <th scope="col">
                <abbr title="Pontos">Pts</abbr>
              </th>
              <th scope="col">
                <abbr title="Jogos">J</abbr>
              </th>
              <th scope="col">
                <abbr title="Vitórias">V</abbr>
              </th>
              <th scope="col">
                <abbr title="Empates">E</abbr>
              </th>
              <th scope="col">
                <abbr title="Derrotas">D</abbr>
              </th>
              <th scope="col">
                <abbr title="Gols marcados">GP</abbr>
              </th>
              <th scope="col">
                <abbr title="Gols sofridos">GC</abbr>
              </th>
              <th scope="col">
                <abbr title="Saldo de gols">SG</abbr>
              </th>
              <th scope="col">
                <abbr title="Aproveitamento de pontos">%</abbr>
              </th>
              <th scope="col">Últimos 5</th>
              <th scope="col">Destino atual</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row: r, index, zone, details }) => {
              const club = CLUBS[r.clubId];
              if (!club) return null;
              const delta =
                lastRound > 1 ? previous.findIndex((p) => p.clubId === r.clubId) - index : 0;
              const open = expanded === r.clubId,
                qualification = entries.find((e) => e.clubId === r.clubId);
              return (
                <Fragment key={r.clubId}>
                  <tr
                    className={r.clubId === career.clubId ? "league-my-club" : ""}
                    data-zone={zone ?? undefined}
                  >
                    <td>
                      <div className="league-position">
                        <i data-zone={zone ?? undefined} />
                        <strong>{index + 1}</strong>
                        <span
                          className={`league-position-change ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}
                          aria-label={
                            delta
                              ? `${Math.abs(delta)} posição(ões) ${delta > 0 ? "acima" : "abaixo"} da rodada anterior`
                              : "Posição mantida"
                          }
                        >
                          {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${-delta}` : "–"}
                        </span>
                      </div>
                    </td>
                    <th scope="row" className="league-club-column">
                      <button
                        className="league-club-button"
                        onClick={() => setExpanded(open ? null : r.clubId)}
                        aria-expanded={open}
                        aria-controls={`club-details-${r.clubId}`}
                      >
                        <Crest club={club} size={24} />
                        <span>
                          {club.name}
                          {r.clubId === career.clubId && <small>Seu clube</small>}
                        </span>
                        <ChevronDown aria-hidden size={15} />
                      </button>
                    </th>
                    <td className="league-points">{r.pts}</td>
                    <td>{r.p}</td>
                    <td>{r.w}</td>
                    <td>{r.d}</td>
                    <td>{r.l}</td>
                    <td>{r.gf}</td>
                    <td>{r.ga}</td>
                    <td>
                      {r.gf - r.ga > 0 ? "+" : ""}
                      {r.gf - r.ga}
                    </td>
                    <td>{r.p ? Math.round((r.pts / (r.p * 3)) * 100) : 0}%</td>
                    <td>
                      <div className="league-form">
                        {details.form.length ? (
                          details.form.map(({ result, fixture }, i) => (
                            <span
                              key={i}
                              data-result={result}
                              title={`Rodada ${fixture.round}: ${CLUBS[fixture.home]?.short} ${fixture.homeGoals}–${fixture.awayGoals} ${CLUBS[fixture.away]?.short}`}
                              aria-label={`${result === "V" ? "Vitória" : result === "E" ? "Empate" : "Derrota"} na rodada ${fixture.round}`}
                            >
                              {result}
                            </span>
                          ))
                        ) : (
                          <span className="league-empty-form">Sem jogos</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="league-zone-label" data-zone={zone ?? undefined}>
                        {zone ? LABELS[zone] : "Permanência"}
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr className="league-club-expanded">
                      <td colSpan={13}>
                        <div id={`club-details-${r.clubId}`} className="league-club-detail-grid">
                          <div>
                            <small>Em casa / fora</small>
                            <strong>
                              {details.homePoints} / {details.awayPoints} pontos
                            </strong>
                          </div>
                          <div>
                            <small>Gols por jogo</small>
                            <strong>
                              {r.p ? (r.gf / r.p).toFixed(2) : "0,00"} marcados ·{" "}
                              {r.p ? (r.ga / r.p).toFixed(2) : "0,00"} sofridos
                            </strong>
                          </div>
                          <div>
                            <small>Próximo adversário</small>
                            <strong>
                              {details.next
                                ? `${CLUBS[details.next.home === r.clubId ? details.next.away : details.next.home]?.name} · ${details.next.home === r.clubId ? "casa" : "fora"} · R${details.next.round}`
                                : "Calendário concluído"}
                            </strong>
                          </div>
                          <div>
                            <small>Classificação projetada</small>
                            <strong>
                              {qualification
                                ? `${qualification.name} · ${qualification.phase}`
                                : zone
                                  ? LABELS[zone]
                                  : "Permanência na divisão"}
                            </strong>
                            <span>
                              {qualification?.reason ??
                                "A posição atual ainda pode mudar até o fechamento da temporada."}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={13} className="league-no-results">
                  Nenhum clube encontrado. Altere a busca ou o filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="league-table-footnote">
        Clique no nome de um clube para abrir os detalhes. As zonas indicam projeções; vagas e
        acessos são confirmados no fechamento e nos playoffs. ↔ Role a tabela para ver todas as
        colunas.
      </p>
    </section>
  );
}
