import { createFileRoute } from "@tanstack/react-router";

import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import { runScouting } from "@/game/career";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney } from "@/game/economy";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/scouting")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Olheiros e relatórios · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:title", content: "Olheiros e relatórios · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      { property: "og:description", content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScoutingPage,
});

function ScoutingPage() {
  const { career, update } = useCareer();
  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );

  return (
    <GameShell career={career}>
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl uppercase tracking-wide">Olheiros</h1>
        <span className="text-xs text-muted-foreground">
          Departamento nível {career.staff.olheiro}/5
        </span>
        <button
          onClick={() => update(runScouting(career))}
          className="ml-auto rounded-lg bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground"
        >
          Enviar olheiros
        </button>
      </div>

      {career.scoutReports.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum relatório ainda. Envie seus olheiros para mapear o mercado.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {career.scoutReports.map((r) => {
            const c = CLUBS[r.clubId];
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-border/40 surface-card p-3"
              >
                {c ? <Crest club={c} size={36} /> : null}
                <div>
                  <p className="font-medium">
                    {r.name} <span className="text-xs text-muted-foreground">{r.pos}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c?.name} · {r.age} anos · OVR {r.ovr} · potencial {r.potential}
                  </p>
                </div>
                <span className="ml-auto font-display text-sm">{formatMoney(r.value)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </GameShell>
  );
}
