/**
 * Carreira de treinador: cada semana você escolhe o foco do trabalho, vê o
 * efeito no elenco e na diretoria, e a rodada é resolvida. Momentos marcantes
 * abrem cutscenes 2D (treino, vestiário, sala de troféus, comissão técnica).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clapperboard, Sparkles } from "lucide-react";

import { GameShell } from "@/components/game/GameShell";
import { Crest } from "@/components/game/Crest";
import { Cutscene } from "@/components/game/Cutscene";
import { CLUBS } from "@/game/data/leagues";
import { coachWeek, WEEK_ACTIONS, type CoachWeek, type WeekActionId } from "@/game/season-mode";
import { CUTSCENES, SCENE_LIST } from "@/content/cutscenes";
import { prefersReducedMotion } from "@/game/device";
import { useCareer } from "@/hooks/useCareer";
import type { ManagerLook } from "@/game/types";

export const Route = createFileRoute("/carreira")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Carreira de treinador · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Carreira de treinador · Pro Football Manager 3D: Jogo de Futebol Manager Online",
      },
      {
        property: "og:description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachCareerPage,
});

const DEFAULT_LOOK: ManagerLook = {
  skin: 2,
  hair: 1,
  hairColor: "#2b1d14",
  beard: 0,
  outfit: 0,
};

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: tone }}
        />
      </div>
    </div>
  );
}

function CoachCareerPage() {
  const { career, update } = useCareer();
  const [weeks, setWeeks] = useState<CoachWeek[]>([]);
  const [scene, setScene] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  const calm = prefersReducedMotion();

  const club = career ? CLUBS[career.clubId] : undefined;
  const look = career?.manager?.look ?? DEFAULT_LOOK;

  const squad = useMemo(() => {
    if (!career) return { morale: 0, condition: 0, form: 0 };
    const mine = Object.values(career.players).filter((p) => p.clubId === career.clubId);
    if (!mine.length) return { morale: 0, condition: 0, form: 0 };
    const avg = (fn: (p: (typeof mine)[number]) => number) =>
      mine.reduce((s, p) => s + fn(p), 0) / mine.length;
    return {
      morale: avg((p) => p.morale),
      condition: avg((p) => p.condition),
      form: avg((p) => p.form ?? 60),
    };
  }, [career]);

  // capitão: jogador de melhor média no elenco do clube da campanha
  const captainName = useMemo(() => {
    if (!career) return undefined;
    const mine = Object.values(career.players).filter((p) => p.clubId === career.clubId);
    if (!mine.length) return undefined;
    return mine.reduce((best, p) => (p.ovr > best.ovr ? p : best), mine[0]!).name;
  }, [career]);

  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );

  function run(action: WeekActionId) {
    if (!career) return;
    const w = coachWeek(career, action);
    if (!w) return;
    setWeeks((cur) => [w, ...cur].slice(0, 40));
    update(w.state);
    if (w.scene && CUTSCENES[w.scene]) setScene(w.scene);
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
          captainName={captainName}
          onDone={() => setScene(null)}
        />
      ) : null}

      <header className="rounded-2xl border border-border/60 surface-card p-5">
        <div className="flex items-center gap-3">
          {club ? <Crest club={club} size={44} detail="simple" /> : null}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl uppercase tracking-wide">Carreira de treinador</h1>
            <p className="text-sm text-muted-foreground">
              Temporada {career.season} · Rodada {career.round} · {club?.name ?? career.clubId}
            </p>
          </div>
          <button
            onClick={() => setGallery((g) => !g)}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"
          >
            <Clapperboard size={16} /> Cenas
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Bar label="Moral do elenco" value={squad.morale} tone="var(--color-primary)" />
          <Bar label="Condição física" value={squad.condition} tone="#3b82f6" />
          <Bar label="Forma recente" value={squad.form} tone="#f0a500" />
          <Bar label="Diretoria" value={career.approval} tone="#22c55e" />
          <Bar label="Torcida" value={career.fanApproval} tone="#a855f7" />
          <Bar label="Pressão" value={career.pressure} tone="#ef4444" />
        </div>

        <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
          Caixa: € {career.finances.budget.toFixed(1)}M · Objetivo: {career.objective}º lugar
        </p>
      </header>

      {gallery ? (
        <section className="mt-4 rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Galeria de cenas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {seen.size} de {SCENE_LIST.length} cenas vistas nesta carreira.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {SCENE_LIST.map((s) => {
              const unlocked = seen.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setScene(s.id)}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                    unlocked
                      ? "border-primary/40 bg-primary/10 hover:bg-primary/20"
                      : "border-border/50 text-muted-foreground hover:bg-card"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} /> {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Trabalho da semana</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WEEK_ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => run(a.id)}
              className="rounded-2xl border border-border/60 surface-card p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/50"
            >
              <p className="font-display text-sm uppercase tracking-wide">{a.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {weeks.map((w, i) => {
          const opp = CLUBS[w.opponentId];
          const win = w.gf > w.ga;
          const draw = w.gf === w.ga;
          return (
            <article
              key={`${w.round}-${w.opponentId}-${i}`}
              className={`rounded-2xl border p-4 ${calm ? "" : "animate-fade-in"} ${
                win
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : draw
                    ? "border-border/60 surface-card"
                    : "border-destructive/40 bg-destructive/10"
              }`}
              style={calm ? undefined : { animationDelay: `${Math.min(i, 10) * 45}ms` }}
            >
              <div className="flex items-center gap-3">
                {opp ? <Crest club={opp} size={30} detail="simple" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{w.headline}</p>
                  <p className="text-xs text-muted-foreground">
                    Rodada {w.round} · {WEEK_ACTIONS.find((a) => a.id === w.action)?.label}
                  </p>
                </div>
                <span className="font-display text-2xl tabular-nums">
                  {w.gf}–{w.ga}
                </span>
              </div>
              {w.scorers.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  ⚽{" "}
                  {w.scorers
                    .map((s) => `${s.name}${s.goals > 1 ? ` (${s.goals})` : ""}`)
                    .join(", ")}
                </p>
              ) : null}
              {w.scene ? (
                <button
                  onClick={() => setScene(w.scene!)}
                  className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
                >
                  Rever a cena
                </button>
              ) : null}
            </article>
          );
        })}
        {!weeks.length ? (
          <p className="text-sm text-muted-foreground">
            Escolha o trabalho da semana para começar a temporada.
          </p>
        ) : null}
      </section>
    </GameShell>
  );
}
