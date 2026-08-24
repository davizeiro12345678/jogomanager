import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { FORMATIONS } from "@/game/formations";
import { useCareer } from "@/hooks/useCareer";
import type { Player } from "@/game/types";

export const Route = createFileRoute("/_authenticated/squad")({
  head: () => ({
    meta: [
      { title: "Elenco e escalação · Manager 3D" },
      {
        name: "description",
        content:
          "Monte o time titular, veja atributos, condição física e moral de cada jogador do elenco.",
      },
      { property: "og:title", content: "Elenco e escalação · Manager 3D" },
      { property: "og:description", content: "Escale seus onze e ajuste o banco." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SquadPage,
});

function SquadPage() {
  const { career, update } = useCareer();
  if (!career) return <Empty />;

  const players = Object.values(career.players);
  const slots = FORMATIONS[career.tactics.formation];
  const lineup = career.lineup.map((id) => career.players[id]).filter(Boolean) as Player[];
  const reserves = players.filter((p) => !career.lineup.includes(p.id));

  function swap(outId: string, inId: string) {
    if (!career) return;
    const idx = career.lineup.indexOf(outId);
    if (idx < 0) return;
    const lineupNext = [...career.lineup];
    lineupNext[idx] = inId;
    update({
      ...career,
      lineup: lineupNext,
      bench: career.bench.map((b) => (b === inId ? outId : b)),
    });
  }

  return (
    <GameShell career={career}>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <h1 className="font-display text-xl uppercase tracking-wide">
            Escalação · {career.tactics.formation}
          </h1>
          <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-xl border border-border/60 bg-[linear-gradient(180deg,#12452a,#0e3a23)]">
            <div className="absolute inset-x-6 inset-y-4 rounded-md border border-white/25" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
            {lineup.map((p, i) => {
              const slot = slots[i]!;
              return (
                <div
                  key={p.id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{
                    left: `${50 + slot.z * 40}%`,
                    top: `${50 - slot.x * 42}%`,
                  }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-sm text-primary-foreground shadow">
                    {p.number}
                  </span>
                  <span className="mt-1 max-w-20 truncate rounded bg-black/60 px-1 text-[10px] text-white">
                    {p.name.split(" ").slice(-1)[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <h2 className="font-display text-xl uppercase tracking-wide">Elenco</h2>
          <div className="mt-3 max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-1 text-left">Jogador</th>
                  <th className="p-1">Pos</th>
                  <th className="p-1">OVR</th>
                  <th className="p-1">Cond</th>
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody>
                {[...lineup, ...reserves].map((p) => {
                  const starting = career!.lineup.includes(p.id);
                  return (
                    <tr key={p.id} className="border-t border-border/40">
                      <td className="p-1">
                        <span className="text-muted-foreground">{p.number} </span>
                        {p.name}
                      </td>
                      <td className="p-1 text-center text-muted-foreground">{p.pos}</td>
                      <td className="p-1 text-center font-display">{p.ovr}</td>
                      <td className="p-1 text-center">
                        <span
                          className={
                            p.condition > 80
                              ? "text-primary"
                              : p.condition > 60
                                ? "text-amber-400"
                                : "text-destructive"
                          }
                        >
                          {p.condition}%
                        </span>
                      </td>
                      <td className="p-1 text-right">
                        {starting ? (
                          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                            Titular
                          </span>
                        ) : (
                          <select
                            className="rounded border border-input bg-background/60 px-1 py-0.5 text-xs"
                            value=""
                            onChange={(e) => e.target.value && swap(e.target.value, p.id)}
                          >
                            <option value="">Entrar por…</option>
                            {lineup.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </GameShell>
  );
}

function Empty() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Nenhuma carreira ativa.
    </div>
  );
}
