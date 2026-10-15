import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { GameShell } from "@/components/game/GameShell";
import { NoCareer, SectionCard, ScreenHeader } from "@/components/game/screen-kit";
import { ACHIEVEMENTS, careerMilestones, type AchievementTier } from "@/game/achievements";
import { syncAchievements } from "@/lib/achievements.functions";
import { useCareer, useSignedIn } from "@/hooks/useCareer";

export const Route = createFileRoute("/conquistas")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Conquistas · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Acompanhe as conquistas do treinador e consulte os objetivos da sua carreira de futebol.",
      },
      {
        property: "og:title",
        content: "Conquistas · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Acompanhe as conquistas do treinador e consulte os objetivos da sua carreira de futebol.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConquistasPage,
});

const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
};

const TIER_CLASS: Record<AchievementTier, string> = {
  bronze: "border-amber-700/40 bg-amber-700/10 text-amber-300",
  prata: "border-slate-400/40 bg-slate-400/10 text-slate-200",
  ouro: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300",
};

const EMPTY_UNLOCKED_IDS: string[] = [];

function ConquistasPage() {
  const { career, signedIn } = useCareer();
  const sync = useServerFn(syncAchievements);
  const synced = useRef<string | null>(null);

  const unlockedIds = career?.achievements ?? EMPTY_UNLOCKED_IDS;
  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);

  useEffect(() => {
    if (!signedIn || unlockedIds.length === 0) return;
    const key = unlockedIds.slice().sort().join(",");
    if (synced.current === key) return;
    synced.current = key;
    void sync();
  }, [signedIn, unlockedIds, sync]);

  if (!career) return <NoCareer />;

  const total = ACHIEVEMENTS.length;
  const unlockedCount = unlockedIds.length;
  const progress = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const tierCounts = (["bronze", "prata", "ouro"] as const).map((tier) => {
    const items = ACHIEVEMENTS.filter((a) => a.tier === tier);
    const unlocked = items.filter((a) => unlockedSet.has(a.id)).length;
    return { tier, unlocked, total: items.length };
  });

  const history = career.managerHistory ?? [];
  const clubsCoached = new Set(history.map((h) => h.clubId)).size;
  const seasonsCompleted = career.history.length;
  const titles = career.trophies.length;
  const log = career.matchLog ?? [];
  const wins = log.filter((m) => m.gf > m.ga).length;
  const draws = log.filter((m) => m.gf === m.ga).length;
  const played = log.length;
  const winRate = played > 0 ? Math.round(((wins + draws * 0.34) / played) * 100) : 0;
  const milestones = careerMilestones(career);

  return (
    <GameShell career={career}>
      <div className="space-y-4">
        <SectionCard className="rounded-2xl border border-border/60 surface-card p-5">
          <ScreenHeader title="Conquistas" />
          <p className="mt-1 text-sm text-muted-foreground">
            {unlockedCount} de {total} conquistas desbloqueadas.
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {tierCounts.map(({ tier, unlocked, total: t }) => (
              <span
                key={tier}
                className={`rounded-full border px-3 py-1 text-xs font-display uppercase tracking-wide ${TIER_CLASS[tier]}`}
              >
                {TIER_LABEL[tier]}: {unlocked}/{t}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-xl uppercase tracking-wide">Carreira do treinador</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Clubes" value={String(clubsCoached)} />
            <Stat label="Temporadas" value={String(seasonsCompleted)} />
            <Stat label="Títulos" value={String(titles)} />
            <Stat label="Aproveitamento" value={`${winRate}%`} />
          </div>
        </SectionCard>

        <SectionCard className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-xl uppercase tracking-wide">Marcos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O quanto falta para o próximo degrau da carreira.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {milestones.map((m) => {
              const pct = Math.min(100, Math.round((m.value / Math.max(1, m.target)) * 100));
              return (
                <div key={m.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{m.label}</span>
                    <span className="font-display text-muted-foreground">
                      {m.value}
                      {m.suffix ?? ""} / {m.target}
                      {m.suffix ?? ""}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedSet.has(a.id);
            const date = career.achievementsUnlockedAt?.[a.id];
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                  unlocked
                    ? TIER_CLASS[a.tier]
                    : "border-border/40 bg-muted/20 text-muted-foreground opacity-70 grayscale"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {unlocked ? a.icon : "🔒"}
                </span>
                <div>
                  <p className="font-display uppercase tracking-wide">{a.title}</p>
                  <p className="text-xs">{unlocked ? a.description : `Dica: ${a.description}`}</p>
                  {unlocked && date ? (
                    <p className="mt-1 text-[11px] opacity-80">
                      Desbloqueada em {new Date(date).toLocaleDateString("pt-BR")}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </GameShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-center">
      <p className="font-display text-xl">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
