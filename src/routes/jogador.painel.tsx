import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Flag, HeartPulse, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crest } from "@/components/game/Crest";
const AthleteHero3D = lazy(() =>
  import("@/components/game/players/AthleteHero3D").then((module) => ({
    default: module.AthleteHero3D,
  })),
);
import { CLUBS } from "@/game/data/leagues";
import {
  ATTRIBUTES,
  GROUP_LABEL,
  POSITION_LABEL,
  TRAITS,
  keyAttributes,
} from "@/game/player-career/attributes";
import { overall, seasonLength } from "@/game/player-career/engine";
import type { AttributeGroup, PlayerCareerState } from "@/game/player-career/types";
import { useAthlete } from "@/hooks/useAthlete";
import { seasonObjectives } from "@/game/player-career/objectives";
import { Bar } from "@/components/game/athlete/PlayerStats";
import { NationalTeamTab } from "@/components/game/athlete/PlayerNationalTab";
import { WeekTab } from "@/components/game/athlete/PlayerWeekTab";
import { ContractTab } from "@/components/game/athlete/PlayerContractTab";
import { HistoryTab } from "@/components/game/athlete/PlayerHistoryTab";
import { PlayerCalendarTab } from "@/components/game/athlete/PlayerCalendarTab";
import { PlayerHealthTab } from "@/components/game/athlete/PlayerHealthTab";
import "@/components/game/athlete.css";

export const Route = createFileRoute("/jogador/painel")({
  ssr: false,
  validateSearch: z.object({
    slot: z.number().int().min(1).max(3).catch(1),
    tab: z
      .enum(["semana", "calendario", "saude", "atributos", "selecao", "contrato", "noticias", "historico"])
      .optional(),
  }),
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

type Tab =
  | "semana"
  | "calendario"
  | "saude"
  | "atributos"
  | "selecao"
  | "contrato"
  | "noticias"
  | "historico";
const TABS: { id: Tab; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "calendario", label: "Calendário" },
  { id: "saude", label: "Saúde" },
  { id: "atributos", label: "Atributos" },
  { id: "selecao", label: "Seleção" },
  { id: "contrato", label: "Contrato e propostas" },
  { id: "noticias", label: "Notícias" },
  { id: "historico", label: "Histórico" },
];

function AthletePanelPage() {
  const { slot, tab } = Route.useSearch();
  const { state, commit, syncError, syncConflict } = useAthlete(slot);
  if (state === undefined)
    return (
      <main className="athlete-shell">
        <p className="athlete-meta">Carregando…</p>
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
  return (
    <Panel state={state} commit={commit} syncError={syncError} syncConflict={syncConflict} initialTab={tab} />
  );
}

function Panel({
  state,
  commit,
  syncError,
  syncConflict,
  initialTab,
}: {
  state: PlayerCareerState;
  commit: (s: PlayerCareerState) => void;
  syncError: boolean;
  syncConflict: boolean;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? (state.retired ? "historico" : "semana"));
  const [showPlayerModel, setShowPlayerModel] = useState(false);
  const club = CLUBS[state.clubId];
  const ovr = overall(state);
  const objectives = seasonObjectives(state, seasonLength(state));
  const finished = objectives.filter((objective) => objective.complete).length;
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
            <span className="athlete-meta" role={syncConflict ? "alert" : "status"}>
              {syncConflict
                ? "Conflito entre dispositivos: seu progresso local foi preservado. Exporte o save no arquivo de atletas."
                : "Sincronização pendente: confira a conexão e mantenha uma cópia local"}
            </span>
          )}
        </div>
        <section className="athlete-card athlete-hero">
          {showPlayerModel ? (
            <Suspense
              fallback={
                <div className="athlete-hero-model grid place-items-center" role="status">
                  Preparando atleta 3D…
                </div>
              }
            >
              <AthleteHero3D athlete={heroAthlete} className="athlete-hero-model" />
            </Suspense>
          ) : (
            <div className="athlete-hero-model grid place-items-center">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowPlayerModel(true)}
                aria-label={`Abrir modelo 3D de ${state.nickname}`}
              >
                Ver atleta em 3D
              </Button>
            </div>
          )}
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
        {!state.retired && (
          <section className="athlete-card athlete-objectives" aria-labelledby="career-goals-heading">
            <div className="athlete-objectives-heading">
              <div>
                <p className="athlete-eyebrow">PLANO DA TEMPORADA</p>
                <h2 id="career-goals-heading" className="text-xl font-bold">Seus objetivos e consequências</h2>
                <p className="athlete-meta">
                  ${finished} de ${objectives.length} metas cumpridas. Resultados são avaliados no fim da temporada e afetam moral, confiança e reputação.
                </p>
              </div>
              <span className="athlete-objectives-score" aria-label={`${finished} de ${objectives.length} metas alcançadas`}>
                ${finished}/${objectives.length}
              </span>
            </div>
            <div className="athlete-objectives-list">
              {objectives.map((objective) => (
                <article key={objective.id} className="athlete-objective" data-complete={objective.complete}>
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
                    <span style={{ width: `${Math.min(100, Math.max(0, objective.current / objective.target * 100))}%` }} />
                  </div>
                  <p className="athlete-meta">{objective.detail}</p>
                  <p className="athlete-objective-impact">{objective.consequence}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        {state.injury && (
          <p className="athlete-card flex items-center gap-2" role="status">
            <HeartPulse className="size-5 text-destructive" /> {state.injury.label} —{" "}
            {state.injury.weeksLeft} semana(s) fora
          </p>
        )}
        <div
          className="athlete-tabs"
          role="tablist"
          aria-label="Áreas da carreira de jogador"
          onKeyDown={(event) => {
            if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const current = TABS.findIndex((item) => item.id === tab);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? TABS.length - 1
                  : (current + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
            setTab(TABS[next]!.id);
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`athlete-tab-${t.id}`}
              type="button"
              role="tab"
              aria-controls="athlete-active-panel"
              tabIndex={tab === t.id ? 0 : -1}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "contrato" && state.offers.length ? ` (${state.offers.length})` : ""}
            </button>
          ))}
        </div>
        <div
          id="athlete-active-panel"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`athlete-tab-${tab}`}
          className="min-w-0"
        >
          {tab === "semana" && <WeekTab state={state} commit={commit} />}
          {tab === "calendario" && <PlayerCalendarTab state={state} />}
          {tab === "saude" && <PlayerHealthTab state={state} />}
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
        </div>
      </div>
    </main>
  );
}
