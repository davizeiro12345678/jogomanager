import { Link } from "@tanstack/react-router";
import { useState } from "react";
import "./competition-interface.css";
import { ArrowRight, BookOpen, Trophy } from "lucide-react";
import { CLUBS, LEAGUES, getLeague } from "@/game/data/leagues";
import {
  calendarYear,
  CONTINENTAL_NAMES,
  countryRegulation,
  promotionRule,
  REGULATION_EDITION,
  REGULATION_SOURCES,
} from "@/game/competition-regulations";
import { pyramidTiers, REGIONAL_LINKS } from "@/game/pyramid";
import type { CareerState } from "@/game/types";

export function CompetitionRules({ career }: { career: CareerState }) {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const league = getLeague(selectedLeague ?? career.leagueId),
    rules = countryRegulation(league.country, calendarYear(career));
  const ownLeague = league.id === career.leagueId;
  const countries = [...new Set(LEAGUES.map((l) => l.country))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const divisions = LEAGUES.filter((l) => l.country === league.country);
  const tiers = pyramidTiers(league.id),
    index = tiers?.findIndex((tier) => tier.includes(league.id)) ?? -1;
  const regional = REGIONAL_LINKS[league.id];
  const upward = index > 0 ? promotionRule(tiers![index - 1]![0]!, calendarYear(career)) : null;
  const downward =
    tiers && index >= 0 && index < tiers.length - 1
      ? promotionRule(tiers[index]![0]!, calendarYear(career))
      : null;
  const personal =
    (ownLeague ? career.qualifications : [])?.filter(
      (e) => e.clubId === career.clubId && e.season === career.season,
    ) ?? [];
  const source = regional?.source ?? upward?.source ?? downward?.source ?? rules.source;
  const record = career.competitionHistory?.at(-1);
  const playoffs =
    (ownLeague ? record?.playoffs : [])?.filter(
      (p) => p.home === career.clubId || p.away === career.clubId,
    ) ?? [];
  const path =
    league.country === "Brasil"
      ? ["Estadual", "Série D", "Série C", "Série B", "Série A", "Libertadores", "Mundial"]
      : [
          ...(tiers?.map((t) => getLeague(t[0]!).name).reverse() ?? [league.name]),
          rules.confederation ? CONTINENTAL_NAMES[rules.confederation] : "Continental",
          "Mundial",
        ];
  return (
    <section className="competition-rules surface-card" aria-labelledby="competition-rules-heading">
      <div className="competition-rules-heading">
        <div>
          <span className="career-eyebrow">Caminhos da carreira · edição {REGULATION_EDITION}</span>
          <h2 id="competition-rules-heading">
            <BookOpen aria-hidden size={19} /> Regulamento e classificação
          </h2>
        </div>
        <Link to="/cup" className="career-secondary-action">
          <Trophy aria-hidden size={16} /> Ver copas
        </Link>
      </div>
      <div className="competition-rule-selectors">
        <label>
          País
          <select
            value={league.country}
            onChange={(event) =>
              setSelectedLeague(LEAGUES.find((l) => l.country === event.target.value)!.id)
            }
          >
            {countries.map((country) => (
              <option value={country} key={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label>
          Campeonato
          <select value={league.id} onChange={(event) => setSelectedLeague(event.target.value)}>
            {divisions.map((division) => (
              <option value={division.id} key={division.id}>
                {division.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {league.clubs.length} clubes no catálogo
        {league.membershipSeason ? ` · Base ${league.membershipSeason}` : " · Base anterior"}
        {league.membershipSource && (
          <>
            {" "}
            ·{" "}
            <a
              href={league.membershipSource}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Composição dos participantes ↗
            </a>
          </>
        )}
      </p>
      <ol className="competition-path" aria-label="Caminho entre competições">
        {path.map((name, i) => (
          <li key={`${name}-${i}`}>
            <span>{name}</span>
            {i < path.length - 1 && <ArrowRight aria-hidden size={14} />}
          </li>
        ))}
      </ol>
      <details className="competition-rule-details">
        <summary>Como funcionam as vagas, acessos e campeonatos deste país</summary>
        <div className="competition-rule-grid">
          <div>
            <h3>{regional ? "Entrada no nacional" : "Acesso e permanência"}</h3>
            {regional ? (
              <p>
                {league.id === "x5686"
                  ? "Os oito primeiros disputam o mata-mata em ida e volta. O campeão ganha uma vaga na Série D seguinte; campeão e vice entram na Copa do Brasil. A vaga na D passa ao próximo elegível quando o vencedor já estiver na A, B ou C."
                  : "Os melhores disputam o título estadual. O campeão elegível entra na Série D seguinte; finalistas classificam para a Copa do Brasil. Cotas e fases adaptadas para os estaduais disponíveis."}{" "}
                Divisões estaduais inferiores não disponíveis no catálogo ainda não têm rebaixamento
                simulado.
              </p>
            ) : tiers ? (
              <p>
                {upward
                  ? `${upward.direct} acesso(s) direto(s) e ${upward.playoff} vaga(s) por disputa entre ${upward.candidates} candidato(s)${upward.againstUpper ? ", com confronto contra a divisão superior" : ""}. `
                  : "Esta é a primeira divisão nacional. "}
                {downward
                  ? league.id === "bra3" && calendarYear(career) < 2028
                    ? "Dois clubes caem; seis vêm da D, ampliando a Série C para 24 em 2027 e 28 em 2028."
                    : `${downward.direct + (downward.againstUpper ? 0 : downward.playoff)} rebaixamento(s)${downward.againstUpper ? " e um confronto de permanência" : ""}.`
                  : "Não há divisão inferior conectada no catálogo."}{" "}
                {ownLeague && career.pyramidSlots
                  ? "Seu save usa uma quantidade personalizada de vagas."
                  : ""}
              </p>
            ) : (
              <p>
                {["Estados Unidos", "Canadá", "Austrália", "México"].includes(league.country)
                  ? "Esta competição não tem acesso ou rebaixamento conectado nesta edição."
                  : "Não há divisão nacional parceira disponível no catálogo. As vagas continentais continuam ligadas à classificação."}
              </p>
            )}
          </div>
          <div>
            <h3>Do país para o continente</h3>
            <p>
              {rules.confederation
                ? `${rules.primary} vaga(s) em ${CONTINENTAL_NAMES[rules.confederation]}, incluindo as vagas da copa quando aplicável. ${rules.secondary ? `${rules.secondary} vaga(s) na competição continental secundária. ` : ""}`
                : "País sem associação continental mapeada. "}
              {rules.note}
            </p>
          </div>
          <div>
            <h3>Do continente para o mundo</h3>
            <p>
              Campeões dos seis continentes disputam a Intercontinental seguinte; o campeão europeu
              entra na final. O Mundial segue um ciclo de quatro anos, com títulos e pontos
              continentais da carreira, limite de dois clubes por país no ranking e exceção para
              campeões.
            </p>
          </div>
        </div>
      </details>
      {personal.length > 0 && (
        <div className="competition-earned">
          <h3>Suas vagas nesta temporada</h3>
          <ul>
            {personal.map((e) => (
              <li key={e.competitionId}>
                <strong>{e.name}</strong>
                <span>
                  {e.phase === "preliminar" ? "Preliminar" : "Principal"} · {e.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {playoffs.length > 0 && (
        <details className="competition-sources">
          <summary>Resultados do seu último mata-mata</summary>
          <ul>
            {playoffs.map((p, i) => (
              <li key={i}>
                {CLUBS[p.home]?.short} {p.first.hg}–{p.first.ag} {CLUBS[p.away]?.short} · volta{" "}
                {p.second.hg}–{p.second.ag}. Classificado: {CLUBS[p.winner]?.name}
                {p.penalties ? " (pênaltis)" : ""}.
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="competition-sources">
        <summary>Critérios, adaptações e fontes</summary>
        <p>
          Desempate: pontos,{" "}
          {rules.tieBreakers
            .map(
              (c) =>
                ({
                  wins: "vitórias",
                  goalDifference: "saldo de gols",
                  goalsFor: "gols marcados",
                  headToHead: "confronto direto",
                  redCards: "menos expulsões",
                })[c],
            )
            .join(", ")}
          . Sem dados suficientes para o último critério, o motor usa a identidade do clube para
          manter o save determinístico.
        </p>
        <p>
          Grupos nacionais, estaduais e copas usam o catálogo existente. Calendários, licenciamento,
          sorteios oficiais, Apertura/Clausura e fases continentais ainda têm adaptações. As regras
          são versionadas; anos futuros usam esta edição e o desempenho simulado da carreira. Cotas
          da Série D usam 96 clubes em 16 grupos de seis, com quatro classificados por grupo. Cotas
          do Mundial seguem 2025, com sede EUA adaptada; não representam uma confirmação da sede de
          2029.
        </p>
        <div className="competition-source-links">
          {source && (
            <a href={source} target="_blank" rel="noreferrer">
              Regulamento da liga / associação ↗
            </a>
          )}
          {rules.source && rules.source !== source && (
            <a href={rules.source} target="_blank" rel="noreferrer">
              Vagas continentais ↗
            </a>
          )}
          <a href={REGULATION_SOURCES.world} target="_blank" rel="noreferrer">
            Cotas do Mundial ↗
          </a>
        </div>
      </details>
    </section>
  );
}
