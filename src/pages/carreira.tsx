/**
 * Carreira de treinador: cada semana você escolhe o foco do trabalho, vê o
 * efeito no elenco e na diretoria, e a rodada é resolvida. Momentos marcantes
 * abrem cenas 3D (treino, vestiário, sala de troféus, comissão técnica).
 */

import { useMemo, useRef, useState } from "react";

import { Clapperboard, Sparkles, ArrowRight } from "lucide-react";

import { GameShell } from "@/components/game/GameShell";

import { NoCareer, ScreenHeader, SectionCard, SkeletonRows } from "@/components/game/screen-kit";

import { Crest } from "@/components/game/Crest";

import { Cutscene } from "@/components/game/Cutscene";

import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { CoachWeekPlanner } from "@/components/game/coach/CoachWeekPlanner";
import { CoachResults } from "@/components/game/coach/CoachResults";
import { summarizeCoachSquad } from "@/game/coach-office";

import { CareerWorldPanel } from "@/components/game/CareerWorldPanel";

import { CLUBS } from "@/game/data/leagues";

import { coachWeekAsync, type WeekActionId } from "@/game/season-mode";

import { CUTSCENES, SCENE_LIST } from "@/content/cutscenes";

import { castFor } from "@/game/cast";

import { applyChoiceEffect } from "@/game/choice-effects";

import { worldFor } from "@/game/career-world";

import { useCareer } from "@/hooks/useCareer";

import type { ManagerLook } from "@/game/types";

const DEFAULT_LOOK: ManagerLook = {
  skin: 2,
  hair: 1,
  hairColor: "#2b1d14",
  beard: 0,
  outfit: 0,
};

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="coach-meter">
      <div className="coach-meter-label">
        <span>{label}</span>
        <strong>
          {score}
          <small>/100</small>
        </strong>
      </div>
      <meter min={0} max={100} value={score} aria-label={label} style={{ color: tone }} />
    </div>
  );
}

export function CoachCareerPage() {
  const { career, update, isLoading } = useCareer();
  const [scene, setScene] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [weekError, setWeekError] = useState("");

  const club = career ? CLUBS[career.clubId] : undefined;
  const look = career?.manager?.look ?? DEFAULT_LOOK;

  const squad = useMemo(() => (career ? summarizeCoachSquad(career) : null), [career]);
  const clubPlayers = useMemo(() => squad?.players ?? [], [squad]);
  const captain = squad?.captain;
  const captainName = captain?.name;

  const cast = useMemo(
    () => (career ? castFor(career.clubId, career.season, career.managerName) : null),
    [career],
  );
  const world = useMemo(() => (career ? worldFor(career) : null), [career]);
  const choicePlayer = useMemo(() => {
    if (!captain) return undefined;
    if (scene === "unhappy-knock") {
      const unsettled = clubPlayers
        .filter((player) => player.unhappy || player.morale < 45)
        .sort((a, b) => a.morale - b.morale || b.ovr - a.ovr)[0];
      return unsettled ?? captain;
    }
    if (scene === "doctor-gamble") {
      const injured = clubPlayers
        .filter((player) => player.injuryWeeks > 0)
        .sort((a, b) => b.ovr - a.ovr || b.injuryWeeks - a.injuryWeeks)[0];
      return injured ?? captain;
    }
    return captain;
  }, [captain, clubPlayers, scene]);
  const choiceContext = useMemo(() => {
    if (!captain || !choicePlayer || !world) return undefined;
    const participant = (player: typeof choicePlayer) => ({
      playerId: player.id,
      relationship: world.relationships[player.id],
      personality: player.personality,
    });
    return {
      participants: {
        captain: participant(scene === "unhappy-knock" ? choicePlayer : captain),
        ...(scene === "agent-demands" ? { agent: participant(choicePlayer) } : {}),
        ...(scene === "doctor-gamble" ? { doctor: participant(choicePlayer) } : {}),
      },
    };
  }, [captain, choicePlayer, scene, world]);

  if (isLoading)
    return (
      <GameShell career={null}>
        <SkeletonRows label="Carregando sua carreira" />
      </GameShell>
    );
  if (!career || !squad) return <NoCareer />;

  async function run(action: WeekActionId) {
    if (!career || career.sacked || running.current) return;
    running.current = true;
    setBusy(true);
    setWeekError("");
    try {
      const w = await coachWeekAsync(career, action);
      if (!w) return;
      update(w.state);
      setPreview(false);
      if (w.scene && CUTSCENES[w.scene]) setScene(w.scene);
    } catch {
      setWeekError(
        "Não foi possível concluir a semana. Sua carreira foi preservada; tente novamente.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const seen = new Set(career.seenScenes ?? []);

  return (
    <GameShell career={career}>
      {scene ? (
        <Cutscene
          scene={scene}
          look={look}
          cinematic
          accent={club?.primary ?? "#0a8f3c"}
          accent2={club?.secondary ?? "#0b1220"}
          trophies={career.trophies.length}
          club={club}
          managerName={career.managerName}
          captainName={
            scene === "unhappy-knock" ? (choicePlayer?.name ?? captainName) : captainName
          }
          cast={cast ?? undefined}
          manner={world?.identity}
          choiceContext={choiceContext}
          onEffect={
            preview
              ? undefined
              : (effect, reaction) => update(applyChoiceEffect(career, effect, reaction))
          }
          onDone={() => setScene(null)}
        />
      ) : null}

      <div className="coach-office">
        <header className="coach-office-header">
          {club ? <Crest club={club} size={56} detail="simple" /> : null}
          <ScreenHeader
            title="Carreira de treinador"
            description={`Temporada ${career.season} · Rodada ${career.round} · ${club?.name ?? career.clubId}`}
          />
          <Button
            variant="outline"
            aria-expanded={gallery}
            aria-controls="coach-scenes"
            disabled={busy}
            onClick={() => setGallery((open) => !open)}
          >
            <Clapperboard size={16} /> Cenas
          </Button>
        </header>
        <nav className="coach-office-nav" aria-label="Áreas da carreira">
          <a href="#coach-week">Trabalho da semana</a>
          <a href="#coach-club">Situação do clube</a>
          <a href="#coach-story">Relações e imprensa</a>
          <a href="#coach-results">Resultados</a>
        </nav>
        <CoachWeekPlanner
          key={`${career.clubId}-${career.season}-${career.round}`}
          career={career}
          busy={busy}
          error={weekError}
          onRun={run}
        />
        <section id="coach-club" className="coach-office-band" aria-labelledby="coach-club-title">
          <div className="coach-section-heading">
            <h2 id="coach-club-title">Situação do clube</h2>
            <Link to="/board">
              Diretoria <ArrowRight size={16} />
            </Link>
          </div>
          <div className="coach-meters">
            <Bar label="Moral do elenco" value={squad.morale} tone="var(--primary)" />
            <Bar label="Condição física" value={squad.condition} tone="var(--career-focus)" />
            <Bar label="Forma recente" value={squad.form} tone="var(--career-warning)" />
            <Bar label="Diretoria" value={career.approval} tone="var(--career-success)" />
            <Bar label="Torcida" value={career.fanApproval} tone="var(--primary)" />
            <Bar
              label="Pressão · menor é melhor"
              value={career.pressure}
              tone="var(--career-danger)"
            />
          </div>
          <dl className="coach-club-facts">
            <div>
              <dt>Caixa</dt>
              <dd>€ {career.finances.budget.toFixed(1)}M</dd>
            </div>
            <div>
              <dt>Objetivo na liga</dt>
              <dd>{career.objective}º lugar</dd>
            </div>
            <div>
              <dt>Propostas de clubes</dt>
              <dd>
                <Link to="/board">{career.jobOffers.length} disponíveis</Link>
              </dd>
            </div>
          </dl>
        </section>
        <section
          id="coach-story"
          className="coach-office-band"
          aria-label="Relações e imprensa"
          inert={busy || undefined}
        >
          <CareerWorldPanel career={career} update={update} />
        </section>
        <CoachResults career={career} />
        {gallery ? (
          <SectionCard id="coach-scenes" className="mt-4 p-5">
            <h2 className="font-display text-lg uppercase tracking-wide">Galeria de cenas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {seen.size} de {SCENE_LIST.length} cenas vistas nesta carreira. Reassistir não altera
              o save.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {SCENE_LIST.map((s) => {
                const unlocked = seen.has(s.id);
                return (
                  <Button
                    variant="outline"
                    disabled={busy}
                    key={s.id}
                    onClick={() => {
                      setPreview(true);
                      setScene(s.id);
                    }}
                    className={`h-auto whitespace-normal justify-start rounded-lg border p-3 text-left text-sm transition-colors ${
                      unlocked
                        ? "border-primary/40 bg-primary/10 hover:bg-primary/20"
                        : "border-border/50 text-muted-foreground hover:bg-card"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles size={14} /> {s.title}
                    </span>
                  </Button>
                );
              })}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </GameShell>
  );
}
