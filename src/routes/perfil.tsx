import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";

import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import { ManagerPortrait } from "@/components/game/ManagerPortrait";
import { GuestCloudPrompt } from "@/components/GuestCloudPrompt";
import { HudBar, HudCard, HudChip, HudStat } from "@/components/ui/hud";
import { achievementById, careerMilestones, ACHIEVEMENTS } from "@/game/achievements";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney } from "@/game/economy";
import { useCareer } from "@/hooks/useCareer";
import { ClubHonoursPanel } from "@/components/game/ClubHeritagePanel";
import { AdMetricsPanel } from "@/features/ads/AdMetricsPanel";
import { SidebarAd } from "@/features/ads/AdZones";
import { exportCareerFile, importCareerFile } from "@/game/contracts/career-transfer";
import { saveLocalCareer } from "@/lib/offline/store";
import { Button } from "@/components/ui/button";
import { ActivityRanking } from "@/features/activity/ActivityRanking";

const FALLBACK_LOOK = {
  skin: 0,
  hair: 0,
  beard: 0,
  outfit: 0,
  hairColor: "#2b2118",
};

export const Route = createFileRoute("/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Perfil do treinador · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Veja sua trajetória como treinador: clubes comandados, títulos, conquistas, estatísticas de carreira e preferências do jogo.",
      },
      { property: "og:title", content: "Perfil do treinador · Pro Football Manager 3D" },
      {
        property: "og:description",
        content:
          "Veja sua trajetória como treinador: clubes comandados, títulos, conquistas, estatísticas de carreira e preferências do jogo.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { career, update, signedIn } = useCareer();
  const importRef = useRef<HTMLInputElement>(null);
  const [transferStatus, setTransferStatus] = useState("");

  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="surface-card w-full max-w-md p-8 text-center">
          <h1 className="font-display text-2xl uppercase tracking-wide">Perfil vazio</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie um treinador para começar a somar jogos, títulos e conquistas.
          </p>
          <Link
            to="/new"
            className="mt-6 inline-grid min-h-[44px] place-items-center rounded-xl bg-primary px-6 font-display text-sm uppercase tracking-wider text-primary-foreground"
          >
            Criar treinador
          </Link>
        </div>
      </div>
    );

  const club = CLUBS[career.clubId];
  const manager = career.manager;
  const log = career.matchLog ?? [];
  const mine = career.results.filter((r) => r.home === career.clubId || r.away === career.clubId);
  const tally = mine.reduce(
    (acc, r) => {
      const home = r.home === career.clubId;
      const gf = home ? r.hg : r.ag;
      const ga = home ? r.ag : r.hg;
      acc.gf += gf;
      acc.ga += ga;
      if (gf > ga) acc.w++;
      else if (gf === ga) acc.d++;
      else acc.l++;
      return acc;
    },
    { w: 0, d: 0, l: 0, gf: 0, ga: 0 },
  );
  const games = tally.w + tally.d + tally.l;
  const winRate = games ? Math.round((tally.w / games) * 100) : 0;
  const milestones = careerMilestones(career);
  const unlocked = career.achievements ?? [];
  const spells = career.managerHistory ?? [];

  return (
    <GameShell career={career}>
      <div className="mb-5">
        <GuestCloudPrompt next="/perfil" compact />
      </div>

      <header className="surface-card flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-end">
        <ManagerPortrait look={manager?.look ?? FALLBACK_LOOK} size={96} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="font-display text-3xl uppercase tracking-wide">{career.managerName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {club ? club.name : "Sem clube"} · Temporada {career.season} · Rodada {career.round}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            {manager ? <HudChip>{manager.age} anos</HudChip> : null}
            {manager ? <HudChip>Reputação {manager.reputation}/5</HudChip> : null}
            <HudChip>{career.trophies.length} troféus</HudChip>
            <HudChip>{games} jogos</HudChip>
          </div>
        </div>
        {club ? <Crest club={club} size={64} /> : null}
      </header>

      <div className="mt-5 grid items-start gap-4 hud-stagger md:grid-cols-2 lg:grid-cols-3">
        <HudCard title="Números da carreira" tone={winRate >= 50 ? "good" : "neutral"}>
          <div className="grid grid-cols-3 gap-3">
            <HudStat label="Vitórias" value={tally.w} tone="good" />
            <HudStat label="Empates" value={tally.d} />
            <HudStat label="Derrotas" value={tally.l} tone={tally.l ? "warn" : "good"} />
          </div>
          <div className="mt-4">
            <HudBar label="Aproveitamento em vitórias" value={winRate} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {tally.gf} gols marcados · {tally.ga} sofridos · {log.length} partidas registradas
          </p>
        </HudCard>

        <HudCard
          title="Progresso"
          tone="neutral"
          action={
            <Link to="/conquistas" className="text-[10px] font-bold uppercase text-tone">
              Conquistas
            </Link>
          }
        >
          <ul className="space-y-3">
            {milestones.slice(0, 4).map((m) => (
              <li key={m.id}>
                <HudBar
                  label={`${m.label} — ${m.value}/${m.target}`}
                  value={Math.min(100, (m.value / Math.max(1, m.target)) * 100)}
                />
              </li>
            ))}
          </ul>
        </HudCard>

        <HudCard title="Diretoria e torcida" tone="neutral">
          <div className="space-y-3">
            <HudBar label="Confiança da diretoria" value={career.approval} />
            <HudBar label="Aprovação da torcida" value={career.fanApproval} />
            <HudBar
              label="Pressão"
              value={career.pressure}
              tone={career.pressure > 60 ? "bad" : career.pressure > 35 ? "warn" : "good"}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Caixa atual: {formatMoney(career.finances.budget)}
          </p>
        </HudCard>

        <HudCard title="Clubes comandados" tone="neutral" className="md:col-span-2">
          <ul className="space-y-2">
            {spells.length === 0 ? (
              <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-foreground/[0.03] p-2">
                {club ? <Crest club={club} size={28} /> : null}
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                  {club?.name ?? "Clube atual"}
                </span>
                <span className="hud-num text-[11px] text-muted-foreground">
                  desde a temporada {career.season}
                </span>
              </li>
            ) : (
              spells.map((s, i) => {
                const c = CLUBS[s.clubId];
                return (
                  <li
                    key={`${s.clubId}-${s.from}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-foreground/[0.03] p-2"
                  >
                    {c ? <Crest club={c} size={28} /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{c?.name ?? s.clubId}</p>
                      <p className="text-[11px] text-muted-foreground">{s.note}</p>
                    </div>
                    <span className="hud-num text-[11px] text-muted-foreground">
                      {s.from}
                      {s.to ? `–${s.to}` : "–atual"}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </HudCard>

        <HudCard
          title="Conquistas"
          tone={unlocked.length ? "good" : "neutral"}
          badge={
            <HudChip>
              {unlocked.length}/{ACHIEVEMENTS.length}
            </HudChip>
          }
        >
          <ul className="space-y-2">
            {unlocked.slice(-5).map((id) => {
              const a = achievementById(id);
              if (!a) return null;
              return (
                <li key={id} className="rounded-lg border border-border/60 bg-foreground/[0.03] p-2">
                  <p className="text-xs font-semibold">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">{a.description}</p>
                </li>
              );
            })}
            {unlocked.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nenhuma conquista ainda — dispute a primeira partida.
              </li>
            )}
          </ul>
        </HudCard>

        <HudCard title="Troféus" tone="neutral" className="md:col-span-2">
          {career.trophies.length ? (
            <ul className="flex flex-wrap gap-2">
              {career.trophies.map((t, i) => (
                <li key={`${t.name}-${i}`}>
                  <HudChip>
                    {t.name} · {t.season}
                  </HudChip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              A sala de troféus ainda está vazia. O primeiro título aparece aqui.
            </p>
          )}
        </HudCard>

        <ClubHonoursPanel clubId={career.clubId} className="md:col-span-2" />

        <SidebarAd context="profile" />

        <AdMetricsPanel />

        <ActivityRanking career={career} signedIn={signedIn} />

        <HudCard title="Preferências" tone="neutral">
          <p className="text-xs text-muted-foreground">
            Nível gráfico, narração e legendas são ajustados dentro da partida, no painel de
            controles — e o jogo guarda a última escolha.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/match"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary/60"
            >
              Abrir partida
            </Link>
            <Link
              to="/visual"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary/60"
            >
              Estilo visual
            </Link>
            <Link
              to="/dashboard"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary/60"
            >
              Painel
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([exportCareerFile(career)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `carreira-${career.managerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pfm3d.json`;
                anchor.click();
                URL.revokeObjectURL(url);
                setTransferStatus("Cópia da carreira exportada.");
              }}
            >
              <Download size={14} /> Exportar carreira
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => importRef.current?.click()}>
              <Upload size={14} /> Importar carreira
            </Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const imported = importCareerFile(await file.text());
                  await saveLocalCareer(imported, "importação");
                  update(imported);
                  setTransferStatus("Carreira importada e salva neste aparelho.");
                } catch (error) {
                  setTransferStatus(error instanceof Error ? error.message : "Não foi possível importar a carreira.");
                } finally {
                  event.target.value = "";
                }
              }}
            />
          </div>
          {transferStatus ? <p role="status" className="mt-3 text-xs text-primary">{transferStatus}</p> : null}
        </HudCard>
      </div>
    </GameShell>
  );
}
