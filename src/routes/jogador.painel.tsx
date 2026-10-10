import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ScreenTabs, SkeletonRows } from "@/components/game/screen-kit";
import { z } from "zod";
import { ArrowLeft, Flag, HeartPulse, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crest } from "@/components/game/Crest";
import { AthleteHero3D } from "@/components/game/players/AthleteHero3D";
import { CLUBS } from "@/game/data/leagues";
import {
  ATTRIBUTES,
  GROUP_LABEL,
  POSITION_LABEL,
  TRAITS,
  keyAttributes,
} from "@/game/player-career/attributes";
import {
  acceptOffer,
  advanceWeek,
  careerTotals,
  declineOffer,
  negotiateOffer,
  opponentFor,
  overall,
  prepareMoments,
  retire,
  seasonLength,
  TRAINING_INJURY,
} from "@/game/player-career/engine";
import type {
  AttributeGroup,
  PlayerCareerState,
  TrainingIntensity,
} from "@/game/player-career/types";
import { useAthlete } from "@/hooks/useAthlete";
import "@/components/game/athlete.css";

export const Route = createFileRoute("/jogador/painel")({
  ssr: false,
  validateSearch: z.object({ slot: z.number().int().min(1).max(3).catch(1) }),
  head: () => ({
    meta: [
      { title: "Painel do atleta — Football Manager 3D" },
      {
        name: "description",
        content:
          "Treino da semana, lances decisivos, contrato, propostas e histórico do seu jogador.",
      },
      { property: "og:title", content: "Painel do atleta — Football Manager 3D" },
      {
        property: "og:description",
        content: "Acompanhe a evolução do seu jogador semana a semana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: AthletePanelPage,
});

type Tab = "semana" | "atributos" | "selecao" | "contrato" | "noticias" | "historico";
const TABS: { id: Tab; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "atributos", label: "Atributos" },
  { id: "selecao", label: "Seleção" },
  { id: "contrato", label: "Contrato e propostas" },
  { id: "noticias", label: "Notícias" },
  { id: "historico", label: "Histórico" },
];
const money = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

function AthletePanelPage() {
  const { slot } = Route.useSearch();
  const { state, commit, syncError } = useAthlete(slot);
  if (state === undefined)
    return (
      <main className="athlete-shell">
        <div className="athlete-wrap">
          <SkeletonRows />
        </div>
      </main>
    );
  if (!state)
    return (
      <main className="athlete-shell">
        <div className="athlete-wrap athlete-card text-center grid gap-3 place-items-center py-10">
          <h1 className="text-2xl font-bold">Nenhum atleta neste espaço</h1>
          <Button asChild size="lg">
            <Link to="/jogador/novo" search={{ slot }}>
              Criar atleta
            </Link>
          </Button>
        </div>
      </main>
    );
  return <Panel state={state} commit={commit} syncError={syncError} />;
}

function Panel({
  state,
  commit,
  syncError,
}: {
  state: PlayerCareerState;
  commit: (s: PlayerCareerState) => void;
  syncError: boolean;
}) {
  const [tab, setTab] = useState<Tab>(state.retired ? "historico" : "semana");
  const club = CLUBS[state.clubId];
  const ovr = overall(state);
  const groups: AttributeGroup[] =
    state.position === "GOL"
      ? ["goleiro", "mental", "fisico", "tecnico", "defensivo"]
      : ["tecnico", "fisico", "mental", "defensivo"];
  const groupAvg = (g: AttributeGroup) => {
    const list = ATTRIBUTES.filter((a) => a.group === g);
    return Math.round(list.reduce((s, a) => s + (state.attrs[a.key] ?? 0), 0) / list.length);
  };
  const heroAthlete = {
    seed: state.seed,
    nickname: state.nickname,
    clubId: state.clubId,
    position: state.position,
    shirtNumber: state.shirtNumber,
    heightCm: state.heightCm,
    weightKg: state.weightKg,
    build: state.build,
    appearance: state.appearance,
    appearanceV1: state.appearanceV1,
  };

  return (
    <main className="athlete-shell" style={{ ["--club" as string]: club?.primary }}>
      <div className="athlete-wrap">
        <div className="athlete-top">
          <Button asChild variant="ghost" size="sm">
            <Link to="/jogador">
              <ArrowLeft className="size-4" /> Atletas
            </Link>
          </Button>
          {syncError && (
            <span className="athlete-meta">Sem conexão com a nuvem — salvo no aparelho</span>
          )}
        </div>
        <section className="athlete-card athlete-hero">
          <AthleteHero3D athlete={heroAthlete} className="athlete-hero-model" />
          <div className="athlete-hero-copy min-w-0">
            <div className="athlete-hero-badges">
              <span className="athlete-quality-badge">
                <Sparkles className="size-3" /> Modelo Hero
              </span>
              {state.nationalCaps > 0 && (
                <span className="athlete-national-badge">
                  <Flag className="size-3" /> Seleção
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {club && <Crest club={club} size={34} />}
              <h1 className="text-2xl font-bold truncate">
                {state.nickname} <span className="athlete-meta">#{state.shirtNumber}</span>
              </h1>
            </div>
            <p className="athlete-meta">
              {POSITION_LABEL[state.position]} · {state.age} anos · {club?.name ?? "Sem clube"} ·{" "}
              {state.nation}
            </p>
            <p className="athlete-meta">
              {state.retired
                ? "Carreira encerrada"
                : `Temporada ${state.season} · semana ${state.week} de ${seasonLength(state)}`}{" "}
              · Potencial {state.potentialSeenRange[0]}–{state.potentialSeenRange[1]}
            </p>
          </div>
          <div className="athlete-ovr">
            <div className="text-center">
              {ovr}
              <small>Geral</small>
            </div>
          </div>
        </section>
        <section className="athlete-card athlete-bars" aria-label="Condição">
          <Bar label="Energia" value={state.energy} />
          <Bar label="Forma" value={state.form} />
          <Bar label="Moral" value={state.morale} />
          <Bar label="Confiança do técnico" value={state.trust} />
          <Bar label="Entrosamento" value={state.chemistry} />
        </section>
        {state.injury && (
          <p className="athlete-card flex items-center gap-2" role="status">
            <HeartPulse className="size-5 text-destructive" /> {state.injury.label} —{" "}
            {state.injury.weeksLeft} semana(s) fora
          </p>
        )}
        <ScreenTabs
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          label="Carreira do atleta"
          tabs={TABS.map((item) => ({
            value: item.id,
            label:
              item.label +
              (item.id === "contrato" && state.offers.length ? ` (${state.offers.length})` : ""),
          }))}
        >
          {tab === "semana" && <WeekTab state={state} commit={commit} />}
          {tab === "atributos" && (
            <section className="athlete-card grid gap-4">
              {groups.map((g) => (
                <div key={g}>
                  <h2 className="font-bold mb-2">
                    {GROUP_LABEL[g]} <span className="athlete-meta">· média {groupAvg(g)}</span>
                  </h2>
                  <div className="athlete-attrs">
                    {ATTRIBUTES.filter((a) => a.group === g).map((a) => {
                      const v = Math.round(state.attrs[a.key] ?? 0);
                      const key = keyAttributes(state.position).slice(0, 5).includes(a.key);
                      return (
                        <div key={a.key} className="athlete-attr">
                          <span>
                            {a.label}
                            {key ? " ★" : ""}
                          </span>
                          <b className={v >= 75 ? "hi" : v < 45 ? "lo" : ""}>{v}</b>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div>
                <h2 className="font-bold mb-2">Características</h2>
                <div className="athlete-chips">
                  {TRAITS.map((t) => (
                    <span
                      key={t.key}
                      className="athlete-chip"
                      aria-pressed={state.traits.includes(t.key)}
                      title={t.hint}
                      style={{ opacity: state.traits.includes(t.key) ? 1 : 0.45 }}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
                <p className="athlete-meta mt-2">
                  Características apagadas ainda não foram conquistadas.
                </p>
              </div>
            </section>
          )}
          {tab === "selecao" && <NationalTeamTab state={state} />}
          {tab === "contrato" && <ContractTab state={state} commit={commit} />}
          {tab === "noticias" && (
            <section className="athlete-card">
              {state.news.length ? (
                <ul className="athlete-news">
                  {state.news.map((n) => (
                    <li key={n.id} data-tone={n.tone}>
                      <span className="athlete-meta">
                        T{n.season} · S{n.week} —{" "}
                      </span>
                      {n.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="athlete-meta">Nenhuma notícia ainda. Jogue a primeira semana.</p>
              )}
            </section>
          )}
          {tab === "historico" && <HistoryTab state={state} />}
        </ScreenTabs>
      </div>
    </main>
  );
}

function NationalTeamTab({ state }: { state: PlayerCareerState }) {
  const isInternational = state.nationalCaps > 0;
  const reputationGap = Math.max(0, 36 - Math.round(state.reputation));
  const formGap = Math.max(0, 71 - Math.round(state.form));
  return (
    <div className="athlete-grid athlete-national-grid">
      <section className="athlete-card athlete-national-callup">
        <div className="athlete-national-mark">
          <Flag aria-hidden />
        </div>
        <div>
          <p className="athlete-eyebrow">Carreira internacional</p>
          <h2>{state.nation}</h2>
          <p className="athlete-meta">
            {isInternational
              ? "Você já vestiu a camisa da seleção principal."
              : "Seu desempenho está sendo acompanhado pela comissão técnica."}
          </p>
        </div>
      </section>
      <section className="athlete-card athlete-national-stats">
        <Stat label="Jogos" value={state.nationalCaps} />
        <Stat label="Gols" value={state.nationalGoals} />
        <Stat label="Reputação" value={Math.round(state.reputation)} />
      </section>
      <section className="athlete-card athlete-selection-path">
        <div className="athlete-section-heading">
          <div>
            <p className="athlete-eyebrow">Caminho da convocação</p>
            <h2 className="font-bold">Status atual</h2>
          </div>
          <ShieldCheck aria-hidden />
        </div>
        <div className="athlete-selection-step" data-complete={state.reputation >= 36}>
          <span>01</span>
          <div>
            <strong>Reconhecimento nacional</strong>
            <p className="athlete-meta">
              {reputationGap
                ? `Faltam ${reputationGap} pontos de reputação.`
                : "Patamar alcançado."}
            </p>
          </div>
        </div>
        <div className="athlete-selection-step" data-complete={state.form >= 71}>
          <span>02</span>
          <div>
            <strong>Boa fase</strong>
            <p className="athlete-meta">
              {formGap ? `Eleve a forma em ${formGap} pontos.` : "Forma de convocação."}
            </p>
          </div>
        </div>
        <div className="athlete-selection-step" data-complete={isInternational}>
          <span>03</span>
          <div>
            <strong>Convocação</strong>
            <p className="athlete-meta">
              {isInternational
                ? `${state.nationalCaps} partida(s) pela seleção.`
                : "Pode acontecer ao avançar uma semana em grande fase."}
            </p>
          </div>
        </div>
      </section>
      <section className="athlete-card athlete-national-honours">
        <Trophy aria-hidden />
        <div>
          <h2 className="font-bold">Legado internacional</h2>
          <p className="athlete-meta">
            {state.nationalGoals > 0
              ? `${state.nationalGoals} gol(s) marcados pelo seu país.`
              : "A primeira convocação abre a corrida por recordes e títulos."}
          </p>
        </div>
      </section>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="athlete-bar">
      <label>
        <span>{label}</span>
        <b>{Math.round(value)}</b>
      </label>
      <div className="athlete-track">
        <span className="athlete-fill" style={{ width: `${Math.round(value)}%` }} />
      </div>
    </div>
  );
}

function WeekTab({
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
                  risco de lesão {(TRAINING_INJURY[i] * 100).toFixed(1)}%
                </small>
              </button>
            ))}
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

function ContractTab({
  state,
  commit,
}: {
  state: PlayerCareerState;
  commit: (s: PlayerCareerState) => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="athlete-grid">
      <section className="athlete-card grid gap-2">
        <h2 className="font-bold">Contrato atual</h2>
        <p>{CLUBS[state.contract.clubId]?.name}</p>
        <p className="athlete-meta">
          Salário {money(state.contract.salary)}/semana · bônus por gol{" "}
          {money(state.contract.goalBonus)}
        </p>
        <p className="athlete-meta">
          Até a temporada {state.contract.untilSeason} · multa {money(state.contract.releaseClause)}
        </p>
        <p className="athlete-meta">
          Patrimônio {money(state.money)} · {state.followers.toLocaleString("pt-BR")} seguidores ·
          reputação {Math.round(state.reputation)}
        </p>
        {!state.retired && state.age >= 30 && (
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm("Encerrar a carreira agora?")) commit(retire(state));
            }}
          >
            Anunciar aposentadoria
          </Button>
        )}
      </section>
      <section className="athlete-card grid gap-3">
        <h2 className="font-bold">Propostas</h2>
        {msg && (
          <p role="status" className="athlete-meta">
            {msg}
          </p>
        )}
        {!state.offers.length ? (
          <p className="athlete-meta">
            Nenhuma proposta agora. A janela abre no meio e no fim da temporada.
          </p>
        ) : (
          state.offers.map((o) => {
            const c = CLUBS[o.clubId];
            return (
              <div key={o.id} className="athlete-moment">
                <div className="flex items-center gap-2">
                  {c && <Crest club={c} size={32} />}
                  <strong>{c?.name ?? o.clubId}</strong>
                  <span className="athlete-meta ml-auto">nível {c?.strength}</span>
                </div>
                <p className="athlete-meta">
                  {o.loan ? "Empréstimo" : "Contrato"} de {o.years} temporada(s) · {money(o.salary)}
                  /semana
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => commit(acceptOffer(state, o.id))}>
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const r = negotiateOffer(state, o.id);
                      commit(r.state);
                      setMsg(
                        r.accepted
                          ? "Proposta melhorada em 15%."
                          : "O clube desistiu da negociação.",
                      );
                    }}
                  >
                    Pedir +15%
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => commit(declineOffer(state, o.id))}
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function HistoryTab({ state }: { state: PlayerCareerState }) {
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="athlete-meta text-xs uppercase">{label}</div>
    </div>
  );
}
