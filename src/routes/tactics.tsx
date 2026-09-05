import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { MENTALITIES, PRESSING, TEMPOS, WIDTHS } from "@/game/formations";
import { pickLineup } from "@/game/career";
import { useCareer } from "@/hooks/useCareer";
import type { FormationKey } from "@/game/types";

const FORMATION_KEYS: FormationKey[] = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"];

export const Route = createFileRoute("/tactics")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Táticas · Pro Football Manager 3D" },
      {
        name: "description",
        content: "Defina formação, mentalidade, pressão, largura e ritmo do seu time.",
      },
      { property: "og:title", content: "Táticas · Pro Football Manager 3D" },
      { property: "og:description", content: "Ajuste o plano de jogo antes de entrar em campo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TacticsPage,
});

function TacticsPage() {
  const { career, update } = useCareer();
  if (!career) return <div className="p-10 text-muted-foreground">Nenhuma carreira ativa.</div>;

  const t = career.tactics;

  function setFormation(formation: FormationKey) {
    if (!career) return;
    const { lineup, bench } = pickLineup(Object.values(career.players), formation);
    update({ ...career, tactics: { ...career.tactics, formation }, lineup, bench });
  }

  function setSlider(key: "mentality" | "pressing" | "width" | "tempo", value: number) {
    if (!career) return;
    update({ ...career, tactics: { ...career.tactics, [key]: value } });
  }

  return (
    <GameShell career={career}>
      <h1 className="font-display text-3xl uppercase tracking-wide">Plano de jogo</h1>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Formação</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {FORMATION_KEYS.map((f) => (
              <button
                key={f}
                onClick={() => setFormation(f)}
                className={`rounded-lg border px-4 py-3 font-display text-lg transition ${
                  f === t.formation
                    ? "border-primary bg-primary/15"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-5">
          <Option
            label="Mentalidade"
            options={MENTALITIES}
            value={t.mentality}
            onChange={(v) => setSlider("mentality", v)}
          />
          <Option
            label="Pressão"
            options={PRESSING}
            value={t.pressing}
            onChange={(v) => setSlider("pressing", v)}
          />
          <Option
            label="Largura"
            options={WIDTHS}
            value={t.width}
            onChange={(v) => setSlider("width", v)}
          />
          <Option
            label="Ritmo"
            options={TEMPOS}
            value={t.tempo}
            onChange={(v) => setSlider("tempo", v)}
          />
        </section>
      </div>
    </GameShell>
  );
}

function Option({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => onChange(i)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              i === value ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
