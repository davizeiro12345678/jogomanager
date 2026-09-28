import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { GameShell } from "@/components/game/GameShell";
import { NoCareer } from "@/components/game/screen-kit";
import { useCareer } from "@/hooks/useCareer";
import { CLUBS, LEAGUES, getLeague } from "@/game/data/leagues";
import {
  DRILLS,
  drillDoneThisRound,
  friendlyDoneThisRound,
  getDrill,
  playFriendly,
  runDrill,
} from "@/game/training-drills";
import type { TrainingFocus } from "@/game/types";

export const Route = createFileRoute("/training")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Treino da semana · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Treino da semana · Pro Football Manager 3D: Jogo de Futebol Manager Online",
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
  component: TrainingPage,
});

const FOCUS: { key: TrainingFocus; label: string; desc: string }[] = [
  { key: "equilibrado", label: "Equilibrado", desc: "Ganho parelho em todas as áreas." },
  { key: "ataque", label: "Ataque", desc: "Melhora a finalização dos jovens." },
  { key: "defesa", label: "Defesa", desc: "Melhora a marcação e o posicionamento." },
  { key: "fisico", label: "Físico", desc: "Recuperação mais rápida entre jogos." },
  { key: "tecnica", label: "Técnica", desc: "Passe e controle de bola." },
];

const INTENSITY: { key: 0 | 1 | 2; label: string; desc: string }[] = [
  { key: 0, label: "Leve", desc: "Descanso: condição sobe rápido, evolução mais lenta." },
  { key: 1, label: "Normal", desc: "Equilíbrio entre recuperação e evolução." },
  { key: 2, label: "Intenso", desc: "Evolução acelerada, mais desgaste e risco de lesão." },
];

function TrainingPage() {
  const { career, update } = useCareer();
  const [friendlyLeague, setFriendlyLeague] = useState(() => career?.leagueId ?? LEAGUES[0]!.id);
  const [friendlyOpp, setFriendlyOpp] = useState("");
  const [friendlyMsg, setFriendlyMsg] = useState("");
  const opponents = useMemo(() => {
    const league = getLeague(friendlyLeague);
    return league.clubs.filter((c) => c.id !== career?.clubId);
  }, [friendlyLeague, career?.clubId]);

  if (!career) return <NoCareer />;

  const doneDrill = drillDoneThisRound(career);
  const doneFriendly = friendlyDoneThisRound(career);
  const lastFriendlies = (career.friendlies ?? []).slice(0, 4);

  const players = Object.values(career.players);
  const avgCond = players.reduce((s, p) => s + p.condition, 0) / Math.max(1, players.length);
  const avgMorale = players.reduce((s, p) => s + p.morale, 0) / Math.max(1, players.length);
  const intensity = career.trainingIntensity ?? 1;
  const youngsters = players
    .filter((p) => p.age <= 23)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 6);

  return (
    <GameShell career={career}>
      <h1 className="font-display text-3xl uppercase tracking-wide">Treino da semana</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        O que você escolhe aqui vale para cada rodada até você mudar.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Foco</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FOCUS.map((f) => (
              <button
                key={f.key}
                onClick={() => update({ ...career, training: f.key })}
                className={`rounded-xl border p-3 text-left transition ${
                  career.training === f.key
                    ? "border-primary bg-primary/15"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <p className="font-display text-sm uppercase tracking-wide">{f.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Intensidade</h2>
          <div className="mt-3 space-y-2">
            {INTENSITY.map((i) => (
              <button
                key={i.key}
                onClick={() => update({ ...career, trainingIntensity: i.key })}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  intensity === i.key
                    ? "border-primary bg-primary/15"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <span className="font-display text-sm uppercase tracking-wide">{i.label}</span>
                <span className="text-xs text-muted-foreground">{i.desc}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Gauge label="Condição média" value={avgCond} />
            <Gauge label="Moral média" value={avgMorale} />
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-border/60 surface-card p-5">
        <h2 className="font-display text-lg uppercase tracking-wide">Exercícios táticos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Um exercício por rodada. Ele cansa o elenco, mas desenvolve o atributo treinado.
          {doneDrill
            ? ` Esta semana você já aplicou: ${getDrill(doneDrill)?.label ?? doneDrill}.`
            : ""}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DRILLS.map((d) => {
            const applied = doneDrill === d.id;
            return (
              <button
                key={d.id}
                type="button"
                disabled={Boolean(doneDrill)}
                aria-pressed={applied}
                onClick={() => update(runDrill(career, d.id))}
                className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  applied ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
                }`}
              >
                <p className="font-display text-sm uppercase tracking-wide">{d.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{d.desc}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  desgaste {d.fatigue} · {d.targets.join(" / ")}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border/60 surface-card p-5">
        <h2 className="font-display text-lg uppercase tracking-wide">Amistoso</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Um amistoso por rodada contra qualquer clube real. Vale moral e ritmo de jogo, e cansa
          quem está relacionado.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Liga
            <select
              value={friendlyLeague}
              onChange={(e) => {
                setFriendlyLeague(e.target.value);
                setFriendlyOpp("");
              }}
              className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {LEAGUES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Adversário
            <select
              value={friendlyOpp}
              onChange={(e) => setFriendlyOpp(e.target.value)}
              className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Escolher clube…</option>
              {opponents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!friendlyOpp || doneFriendly}
            onClick={() => {
              const res = playFriendly(career, friendlyOpp);
              if (!res) return;
              update(res.state);
              setFriendlyMsg(`${res.hg} x ${res.ag} contra ${res.opponent}.`);
            }}
            className="rounded-lg bg-primary px-4 py-2 font-display text-sm uppercase tracking-wide text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Disputar amistoso
          </button>
        </div>
        <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {friendlyMsg ||
            (doneFriendly ? "Amistoso desta rodada já disputado." : "Nenhum amistoso nesta rodada.")}
        </p>
        {lastFriendlies.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {lastFriendlies.map((f) => (
              <li key={`${f.season}-${f.round}-${f.opponentId}`}>
                T{f.season} · R{f.round} — {f.hg} x {f.ag} {CLUBS[f.opponentId]?.short ?? "?"}
              </li>
            ))}
          </ul>
        )}
      </section>


      <section className="mt-4 rounded-2xl border border-border/60 surface-card p-5">
        <h2 className="font-display text-lg uppercase tracking-wide">Promessas em evolução</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {youngsters.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-3 py-2"
            >
              <div>
                <p className="text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.pos} · {p.age} anos
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg">{p.ovr}</p>
                <p className="text-[10px] uppercase text-muted-foreground">
                  teto {p.potential ?? Math.min(99, p.ovr + 6)}
                </p>
              </div>
            </div>
          ))}
          {youngsters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum jogador com 23 anos ou menos.</p>
          ) : null}
        </div>
      </section>
    </GameShell>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-secondary">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
