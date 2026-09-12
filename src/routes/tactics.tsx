import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { GameShell } from "@/components/game/GameShell";
import { FORMATIONS, MENTALITIES, PRESSING, TEMPOS, WIDTHS } from "@/game/formations";
import { pickLineup } from "@/game/career";
import { useCareer } from "@/hooks/useCareer";
import type { FormationKey, Player, Tactics } from "@/game/types";

const FORMATION_KEYS: FormationKey[] = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"];

const PRESETS: { name: string; desc: string; tactics: Omit<Tactics, "formation"> }[] = [
  {
    name: "Posse de bola",
    desc: "Ritmo baixo, campo largo, pressão média.",
    tactics: { mentality: 2, pressing: 1, width: 2, tempo: 0 },
  },
  {
    name: "Contra-ataque",
    desc: "Bloco baixo e saída rápida.",
    tactics: { mentality: 1, pressing: 0, width: 1, tempo: 2 },
  },
  {
    name: "Pressão alta",
    desc: "Sufoca a saída de bola adversária.",
    tactics: { mentality: 3, pressing: 2, width: 1, tempo: 2 },
  },
  {
    name: "Tudo ou nada",
    desc: "Para quando só a vitória serve.",
    tactics: { mentality: 4, pressing: 2, width: 2, tempo: 2 },
  },
];

export const Route = createFileRoute("/tactics")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Táticas · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Táticas · Pro Football Manager 3D: Jogo de Futebol Manager Online",
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
  component: TacticsPage,
});

/** Quão bem o jogador serve à posição do slot. */
function fit(player: Player, slotPos: string) {
  if (player.pos === slotPos) return "ok" as const;
  const near: Record<string, string[]> = {
    GK: [],
    DF: ["MF"],
    MF: ["DF", "FW"],
    FW: ["MF"],
  };
  return near[slotPos]?.includes(player.pos) ? ("meio" as const) : ("ruim" as const);
}

function TacticsPage() {
  const { career, update } = useCareer();
  const [picked, setPicked] = useState<number | null>(null);

  if (!career) return <div className="p-10 text-muted-foreground">Nenhuma carreira ativa.</div>;

  const t = career.tactics;
  const slots = FORMATIONS[t.formation];
  const lineup = career.lineup.map((id) => career.players[id]);

  function setFormation(formation: FormationKey) {
    if (!career) return;
    const { lineup: l, bench } = pickLineup(Object.values(career.players), formation);
    update({ ...career, tactics: { ...career.tactics, formation }, lineup: l, bench });
  }

  function setSlider(key: "mentality" | "pressing" | "width" | "tempo", value: number) {
    if (!career) return;
    update({ ...career, tactics: { ...career.tactics, [key]: value } });
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    if (!career) return;
    update({ ...career, tactics: { ...career.tactics, ...p.tactics } });
  }

  /** Troca dois jogadores de posição dentro do onze inicial. */
  function swapSlots(a: number, b: number) {
    if (!career || a === b) return;
    const next = [...career.lineup];
    const tmp = next[a]!;
    next[a] = next[b]!;
    next[b] = tmp;
    update({ ...career, lineup: next });
  }

  function onSlotActivate(i: number) {
    if (picked === null) setPicked(i);
    else {
      swapSlots(picked, i);
      setPicked(null);
    }
  }

  const activePreset = PRESETS.find(
    (p) =>
      p.tactics.mentality === t.mentality &&
      p.tactics.pressing === t.pressing &&
      p.tactics.width === t.width &&
      p.tactics.tempo === t.tempo,
  );

  const outOfPosition = lineup.filter((p, i) => {
    const slot = slots[i];
    return p && slot ? fit(p, slot.pos) === "ruim" : false;
  }).length;
  const adapted = lineup.filter((p, i) => {
    const slot = slots[i];
    return p && slot ? fit(p, slot.pos) === "meio" : false;
  }).length;

  return (
    <GameShell career={career}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide sm:text-4xl">
            Plano de jogo
          </h1>
          <p className="hud-num mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            Arraste um jogador sobre outro para trocar — no celular, toque nos dois.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <HudStat label="Formação" value={t.formation} />
          <HudStat label="Estilo" value={activePreset?.name ?? "Personalizado"} />
          <HudStat
            label="Encaixe"
            value={`${11 - outOfPosition - adapted}/11`}
            hint={`${adapted} adaptados · ${outOfPosition} fora de posição`}
            tone={outOfPosition > 1 ? "bad" : outOfPosition || adapted > 2 ? "warn" : "good"}
          />
        </div>
      </div>

      <div className="mt-5 grid items-start gap-4 hud-stagger lg:grid-cols-[1.05fr_1fr]">
        <HudCard
          title={`Campo · ${t.formation}`}
          badge={<HudChip>{MENTALITIES[t.mentality]}</HudChip>}
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border/60 bg-[linear-gradient(180deg,#14472c,#0d3521)]">

            <div className="absolute inset-x-5 inset-y-4 rounded-md border border-white/20" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
            {lineup.map((p, i) => {
              const slot = slots[i];
              if (!p || !slot) return null;
              const f = fit(p, slot.pos);
              return (
                <button
                  key={p.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    if (!Number.isNaN(from)) swapSlots(from, i);
                    setPicked(null);
                  }}
                  onClick={() => onSlotActivate(i)}
                  aria-label={`${p.name}, ${slot.label}`}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center active:cursor-grabbing"
                  style={{ left: `${50 + slot.z * 40}%`, top: `${50 - slot.x * 42}%` }}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-sm shadow-lg ring-2 transition ${
                      picked === i ? "scale-110 ring-white" : "ring-transparent"
                    } ${
                      f === "ok"
                        ? "bg-primary text-primary-foreground"
                        : f === "meio"
                          ? "bg-amber-400 text-black"
                          : "bg-destructive text-white"
                    }`}
                  >
                    {p.number}
                  </span>
                  <span className="mt-1 max-w-24 truncate rounded bg-black/65 px-1 text-[10px] text-white">
                    {p.name.split(" ").slice(-1)[0]}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-white/60">
                    {slot.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Verde: jogador na posição natural · amarelo: posição adaptada · vermelho: fora de
            posição (rende menos).
          </p>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/60 surface-card p-5">
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

          <section className="rounded-2xl border border-border/60 surface-card p-5">
            <h2 className="font-display text-lg uppercase tracking-wide">Estilos prontos</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className={`rounded-xl border p-3 text-left transition ${
                    activePreset?.name === p.name
                      ? "border-primary bg-primary/15"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <p className="font-display text-sm uppercase tracking-wide">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/60 surface-card p-5">
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
