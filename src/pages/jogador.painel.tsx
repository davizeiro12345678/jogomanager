import { TABS, type Tab } from "@/components/game/athlete/player-tabs";
import { Link } from "@tanstack/react-router";

import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { ArrowLeft, Flag, HeartPulse, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Crest } from "@/components/game/Crest";

import { CLUBS } from "@/game/data/leagues";

import { POSITION_LABEL } from "@/game/player-career/attributes";

import { overall, seasonLength } from "@/game/player-career/engine";

import type { PlayerCareerState } from "@/game/player-career/types";

import { useAthlete } from "@/hooks/useAthlete";

import { downloadAthlete } from "@/lib/player-career-export";

import { PlayerObjectives } from "@/components/game/athlete/PlayerObjectives";

import { Bar } from "@/components/game/athlete/PlayerStats";

import { WeekTab } from "@/components/game/athlete/PlayerWeekTab";
import { PlayerCareerGuide } from "@/components/game/athlete/PlayerCareerGuide";

import "@/components/game/athlete.css";
import { getRouteApi } from "@tanstack/react-router";
import { claimCareerReturn } from "@/lib/career-analytics-id";
const Route = getRouteApi("/jogador/painel");

const AthleteHero3D = lazy(() =>
  import("@/components/game/players/AthleteHero3D").then((module) => ({
    default: module.AthleteHero3D,
  })),
);

// Non-default panels load only when selected, instead of adding all their UI to the weekly startup.
const PlayerAttributesTab = lazy(() =>
  import("@/components/game/athlete/PlayerAttributesTab").then((module) => ({
    default: module.PlayerAttributesTab,
  })),
);

const PlayerCalendarTab = lazy(() =>
  import("@/components/game/athlete/PlayerCalendarTab").then((module) => ({
    default: module.PlayerCalendarTab,
  })),
);

const PlayerHealthTab = lazy(() =>
  import("@/components/game/athlete/PlayerHealthTab").then((module) => ({
    default: module.PlayerHealthTab,
  })),
);

const NationalTeamTab = lazy(() =>
  import("@/components/game/athlete/PlayerNationalTab").then((module) => ({
    default: module.NationalTeamTab,
  })),
);

const ContractTab = lazy(() =>
  import("@/components/game/athlete/PlayerContractTab").then((module) => ({
    default: module.ContractTab,
  })),
);

const HistoryTab = lazy(() =>
  import("@/components/game/athlete/PlayerHistoryTab").then((module) => ({
    default: module.HistoryTab,
  })),
);

export function AthletePanelPage() {
  const { slot, tab } = Route.useSearch();
  const { state, commit, syncError, syncConflict, resolveWithCloud } = useAthlete(slot);
  const hasAthlete = Boolean(state);
  useEffect(() => {
    // An existing athlete reopened in a new browser session counts as a return.
    if (!hasAthlete || !claimCareerReturn("player", `slot-${slot}`)) return;
    window.__lovableEvents?.track?.("project.career_returned", {
      career_type: "player",
      entry: "player_panel",
    });
  }, [hasAthlete, slot]);
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
    <Panel
      state={state}
      commit={commit}
      syncError={syncError}
      syncConflict={syncConflict}
      resolveWithCloud={resolveWithCloud}
      initialTab={tab}
    />
  );
}

function Panel({
  state,
  commit,
  syncError,
  syncConflict,
  resolveWithCloud,
  initialTab,
}: {
  state: PlayerCareerState;
  commit: (s: PlayerCareerState) => void;
  syncError: boolean;
  syncConflict: boolean;
  resolveWithCloud: () => Promise<boolean>;
  initialTab?: Tab | undefined;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? (state.retired ? "historico" : "semana"));
  const [showPlayerModel, setShowPlayerModel] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabsRef.current
      ?.querySelector("[aria-selected=true]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [tab]);
  const [resolutionMessage, setResolutionMessage] = useState<string | null>(null);
  const club = CLUBS[state.clubId];
  const ovr = overall(state);
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="athlete-meta" role={syncConflict ? "alert" : "status"}>
                {syncConflict
                  ? "Conflito de saves: a versão local foi preservada e a nuvem não foi sobrescrita."
                  : "Sincronização pendente: confira a conexão e mantenha uma cópia local"}
              </span>
              {syncConflict && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Usar a versão atual da nuvem? Será baixado um JSON do seu progresso local e mantido um backup no aparelho antes da substituição.",
                      )
                    )
                      return;
                    downloadAthlete(state, "backup-antes-de-usar-nuvem");
                    const resolved = await resolveWithCloud();
                    setResolutionMessage(
                      resolved
                        ? "Versão da nuvem carregada. Sua antiga carreira permanece no backup local."
                        : "Não foi possível resolver o conflito; o progresso local permanece preservado.",
                    );
                  }}
                >
                  Usar versão da nuvem (com backup)
                </Button>
              )}
            </div>
          )}
          {resolutionMessage && (
            <p className="athlete-meta" role="status">
              {resolutionMessage}
            </p>
          )}
        </div>
        <PlayerCareerGuide
          state={state}
          onOpenTab={(next) => {
            setTab(next);
            requestAnimationFrame(() => {
              document.getElementById(`athlete-tab-${next}`)?.focus();
            });
          }}
        />
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
                className="h-auto min-h-11 max-w-full whitespace-normal px-2 text-center"
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
        {state.injury && (
          <p className="athlete-card flex items-center gap-2" role="status">
            <HeartPulse className="size-5 text-destructive" /> {state.injury.label} —{" "}
            {state.injury.weeksLeft} semana(s) fora
          </p>
        )}
        <div
          ref={tabsRef}
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
            const nextTab = TABS[next];
            if (!nextTab) return;
            setTab(nextTab.id);
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}
        >
          {TABS.map((t) => (
            <Button
              variant="ghost"
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
            </Button>
          ))}
        </div>
        <div
          id="athlete-active-panel"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`athlete-tab-${tab}`}
          className="min-w-0"
        >
          <Suspense
            fallback={
              <section className="athlete-card" role="status" aria-live="polite">
                Carregando o painel selecionado…
              </section>
            }
          >
            {tab === "semana" && <WeekTab state={state} commit={commit} />}
            {tab === "calendario" && <PlayerCalendarTab state={state} />}
            {tab === "saude" && <PlayerHealthTab state={state} />}
            {tab === "atributos" && <PlayerAttributesTab state={state} />}
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
          </Suspense>
        </div>
        <PlayerObjectives state={state} />
      </div>
    </main>
  );
}
