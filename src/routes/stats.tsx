import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { GameShell } from "@/components/game/GameShell";
import { formOf, potentialOf } from "@/game/events";
import { useCareer } from "@/hooks/useCareer";
import type { Player } from "@/game/types";

export const Route = createFileRoute("/stats")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Estatísticas do elenco · Manager 3D" },
      {
        name: "description",
        content:
          "Artilharia, assistências, forma, potencial e comparação entre jogadores do seu elenco.",
      },
      { property: "og:title", content: "Estatísticas do elenco · Manager 3D" },
      { property: "og:description", content: "Números do seu time, rodada a rodada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatsPage,
});

type SortKey = "ovr" | "goals" | "assists" | "apps" | "form" | "potential" | "age";

const COLUMNS: { key: SortKey; label: string; get: (p: Player) => number }[] = [
  { key: "ovr", label: "OVR", get: (p) => p.ovr },
  { key: "potential", label: "POT", get: (p) => potentialOf(p) },
  { key: "age", label: "Idade", get: (p) => p.age },
  { key: "apps", label: "Jogos", get: (p) => p.apps },
  { key: "goals", label: "Gols", get: (p) => p.goals },
  { key: "assists", label: "Assist.", get: (p) => p.assists },
  { key: "form", label: "Forma", get: (p) => formOf(p) },
];

function StatsPage() {
  const { career } = useCareer();
  const [sort, setSort] = useState<SortKey>("goals");
  const [compare, setCompare] = useState<string[]>([]);

  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );

  const col = COLUMNS.find((c) => c.key === sort)!;
  const players = Object.values(career.players).sort((a, b) => col.get(b) - col.get(a));
  const selected = compare.map((id) => career.players[id]).filter(Boolean) as Player[];

  const toggle = (id: string) =>
    setCompare((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-2),
    );

  return (
    <GameShell career={career}>
      <h1 className="font-display text-2xl uppercase tracking-wide">Estatísticas</h1>

      {selected.length === 2 ? (
        <section className="mt-4 rounded-2xl border border-border/60 bg-card/70 p-4">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Comparação
          </h2>
          <div className="mt-3 space-y-2">
            {(
              [
                ["Ritmo", "pace"],
                ["Finalização", "shooting"],
                ["Passe", "passing"],
                ["Defesa", "defending"],
                ["Físico", "physical"],
              ] as const
            ).map(([label, key]) => {
              const a = selected[0]![key];
              const b = selected[1]![key];
              return (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-right font-display text-sm">{a}</span>
                  <div className="flex h-2 flex-1 justify-end rounded-full bg-secondary">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${a}%` }} />
                  </div>
                  <span className="w-24 text-center text-muted-foreground">{label}</span>
                  <div className="h-2 flex-1 rounded-full bg-secondary">
                    <div className="h-2 rounded-full bg-amber-400" style={{ width: `${b}%` }} />
                  </div>
                  <span className="w-8 font-display text-sm">{b}</span>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              {selected[0]!.name} vs {selected[1]!.name}
            </p>
          </div>
        </section>
      ) : null}

      <section className="mt-4 overflow-x-auto rounded-2xl border border-border/60 bg-card/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-3">Jogador</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="p-3">
                  <button
                    onClick={() => setSort(c.key)}
                    className={sort === c.key ? "text-primary" : ""}
                  >
                    {c.label}
                  </button>
                </th>
              ))}
              <th className="p-3">Comparar</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-border/20">
                <td className="p-3">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.pos}</span>
                  {p.unhappy ? (
                    <span className="ml-2 text-xs text-destructive">insatisfeito</span>
                  ) : null}
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="p-3">
                    {c.get(p)}
                  </td>
                ))}
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Comparar ${p.name}`}
                    checked={compare.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className="accent-primary"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </GameShell>
  );
}
