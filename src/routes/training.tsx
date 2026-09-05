import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { useCareer } from "@/hooks/useCareer";
import type { TrainingFocus } from "@/game/types";

export const Route = createFileRoute("/training")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Treino da semana · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Escolha o foco e a intensidade do treino semanal e acompanhe condição física, moral e evolução do elenco.",
      },
      { property: "og:title", content: "Treino da semana · Pro Football Manager 3D" },
      { property: "og:description", content: "Foco, intensidade e evolução do elenco." },
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
  if (!career) return <div className="p-10 text-muted-foreground">Nenhuma carreira ativa.</div>;

  const players = Object.values(career.players);
  const avgCond = players.reduce((s, p) => s + p.condition, 0) / Math.max(1, players.length);
  const avgMorale = players.reduce((s, p) => s + p.morale, 0) / Math.max(1, players.length);
  const intensity = career.trainingIntensity ?? 1;
  const youngsters = players.filter((p) => p.age <= 23).sort((a, b) => b.ovr - a.ovr).slice(0, 6);

  return (
    <GameShell career={career}>
      <h1 className="font-display text-3xl uppercase tracking-wide">Treino da semana</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        O que você escolhe aqui vale para cada rodada até você mudar.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
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

        <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
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

      <section className="mt-4 rounded-2xl border border-border/60 bg-card/70 p-5">
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
