import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "História e troféus · Manager 3D" },
      {
        name: "description",
        content: "A trajetória da sua carreira: temporadas, posições e títulos conquistados.",
      },
      { property: "og:title", content: "História e troféus · Manager 3D" },
      { property: "og:description", content: "Sala de troféus e retrospecto da carreira." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { career } = useCareer();
  if (!career) return <Empty />;

  return (
    <GameShell career={career}>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
          <h1 className="font-display text-2xl uppercase tracking-wide">Sala de troféus</h1>
          {career.trophies.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum título ainda. Vença a liga para levantar o primeiro troféu!
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {career.trophies.map((t) => (
                <li
                  key={`${t.season}-${t.name}`}
                  className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3"
                >
                  <span className="text-2xl" aria-hidden>
                    🏆
                  </span>
                  <div>
                    <p className="font-display uppercase tracking-wide">{t.name}</p>
                    <p className="text-xs text-muted-foreground">Temporada {t.season}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
          <h2 className="font-display text-2xl uppercase tracking-wide">Temporadas</h2>
          {career.history.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Complete a primeira temporada para registrar seu retrospecto.
            </p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Temp</th>
                  <th className="p-2">Pos</th>
                  <th className="p-2">Pts</th>
                  <th className="p-2">V-E-D</th>
                  <th className="p-2 text-left">Campeão</th>
                </tr>
              </thead>
              <tbody>
                {career.history.map((h) => {
                  const champion = CLUBS[h.championId];
                  return (
                    <tr key={h.season} className="border-t border-border/40">
                      <td className="p-2">{h.season}</td>
                      <td className="p-2 text-center font-display">{h.position}º</td>
                      <td className="p-2 text-center">{h.pts}</td>
                      <td className="p-2 text-center text-muted-foreground">
                        {h.w}-{h.d}-{h.l}
                      </td>
                      <td className="p-2">
                        {champion ? (
                          <span className="flex items-center gap-2">
                            <Crest club={champion} size={20} />
                            {champion.short}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
