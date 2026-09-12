import { createFileRoute } from "@tanstack/react-router";

import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import { resign, takeJob, upgradeStaff } from "@/game/career";
import { CLUBS, getLeague } from "@/game/data/leagues";
import { formatMoney } from "@/game/economy";
import { staffBill } from "@/game/events";
import { useCareer } from "@/hooks/useCareer";
import type { Staff } from "@/game/types";

export const Route = createFileRoute("/board")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Sala da diretoria · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:title", content: "Sala da diretoria · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      { property: "og:description", content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});

const STAFF_LABEL: Record<keyof Staff, string> = {
  assistente: "Treinador auxiliar",
  preparador: "Preparador físico",
  medico: "Departamento médico",
  olheiro: "Olheiros",
};

function BoardPage() {
  const { career, update } = useCareer();
  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );

  const club = CLUBS[career.clubId]!;
  const risk = career.pressure >= 80 ? "alto" : career.pressure >= 50 ? "médio" : "baixo";

  return (
    <GameShell career={career}>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 surface-card p-5">
          <h1 className="font-display text-2xl uppercase tracking-wide">Sala da diretoria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {club.name} espera terminar em {career.objective}º ou melhor.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Aprovação diretoria</dt>
              <dd className="font-display text-xl">{career.approval}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Aprovação torcida</dt>
              <dd className="font-display text-xl">{career.fanApproval}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pressão</dt>
              <dd className="font-display text-xl">{career.pressure}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Risco de demissão</dt>
              <dd className="font-display text-xl capitalize">{risk}</dd>
            </div>
          </dl>

          {!career.sacked ? (
            <button
              onClick={() => update(resign(career))}
              className="mt-4 rounded-lg border border-destructive/60 px-4 py-2 font-display text-sm uppercase tracking-wider text-destructive hover:bg-destructive/10"
            >
              Pedir demissão
            </button>
          ) : (
            <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Você está sem clube. Escolha um convite abaixo para voltar a trabalhar.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-xl uppercase tracking-wide">Comissão técnica</h2>
          <p className="text-xs text-muted-foreground">
            Custo semanal: {formatMoney(staffBill(career))}
          </p>
          <ul className="mt-3 space-y-2">
            {(Object.keys(STAFF_LABEL) as (keyof Staff)[]).map((role) => (
              <li
                key={role}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{STAFF_LABEL[role]}</p>
                  <p className="text-xs text-muted-foreground">Nível {career.staff[role]}/5</p>
                </div>
                <button
                  disabled={career.staff[role] >= 5}
                  onClick={() => update(upgradeStaff(career, role))}
                  className="ml-auto rounded-md bg-secondary px-3 py-1.5 text-xs uppercase tracking-wider disabled:opacity-40"
                >
                  Melhorar (€{((career.staff[role] + 1) * 1.2).toFixed(1)}M)
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 surface-card p-5 lg:col-span-2">
          <h2 className="font-display text-xl uppercase tracking-wide">Clubes interessados em você</h2>
          {career.jobOffers.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum convite no momento. Bons resultados atraem propostas.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {career.jobOffers.map((j) => {
                const c = CLUBS[j.clubId];
                if (!c) return null;
                return (
                  <li
                    key={j.id}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
                  >
                    <Crest club={c} size={40} />
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getLeague(j.leagueId).name} · orçamento {formatMoney(j.budget)} · objetivo{" "}
                        {j.objective}º
                      </p>
                    </div>
                    <button
                      onClick={() => update(takeJob(career, j.id))}
                      className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs uppercase tracking-wider text-primary-foreground"
                    >
                      Assinar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border/60 surface-card p-5 lg:col-span-2">
          <h2 className="font-display text-xl uppercase tracking-wide">Carreira do treinador</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {career.managerHistory.map((h, i) => {
              const c = CLUBS[h.clubId];
              return (
                <li key={i} className="flex items-center gap-3">
                  {c ? <Crest club={c} size={26} /> : null}
                  <span className="font-medium">{c?.name ?? h.clubId}</span>
                  <span className="text-muted-foreground">
                    Temporada {h.from}
                    {h.to ? `–${h.to}` : " · atual"} · {h.note}
                  </span>
                </li>
              );
            })}
          </ul>
          {career.trophies.length > 0 ? (
            <div className="mt-4">
              <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
                Sala de troféus
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {career.trophies.map((t, i) => (
                  <li key={i} className="rounded-lg bg-yellow-500/15 px-3 py-1 text-yellow-400">
                    🏆 {t.name} · T{t.season}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </GameShell>
  );
}
