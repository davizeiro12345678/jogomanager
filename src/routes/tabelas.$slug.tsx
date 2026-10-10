import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicLinks } from "@/components/PublicLinks";
import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { LEAGUE_LABELS } from "@/lib/league-labels";
import { getLeagueTable, type LeagueTable, type StandingRow } from "@/lib/real-football.functions";

export const Route = createFileRoute("/tabelas/$slug")({
  loader: async ({ params }) => {
    if (!LEAGUE_LABELS[params.slug]) throw notFound();
    const table = await getLeagueTable({ data: { slug: params.slug } });
    return { table, label: LEAGUE_LABELS[params.slug]! };
  },
  head: ({ params, loaderData }) => {
    const label = loaderData?.label ?? { name: "Liga", country: "" };
    const season = loaderData?.table?.season;
    const leader = loaderData?.table?.groups[0]?.[0]?.team.name;
    const path = `/tabelas/${params.slug}`;
    const title = `Tabela ${label.name}${season ? ` ${season}` : ""}: classificação, forma e desfalques`;
    const description = `Classificação completa da ${label.name} (${label.country})${leader ? `, liderada por ${leader}` : ""}: desempenho em casa e fora, melhor ataque e defesa, forma recente e lesionados.`;
    return {
      meta: seoMeta({ title, description, path, type: "article" }),
      links: canonical(path),
      scripts: [
        breadcrumbLd([
          { name: "Início", path: "/" },
          { name: "Tabelas", path: "/tabelas" },
          { name: label.name, path },
        ]),
      ],
    };
  },
  notFoundComponent: () => (
    <main className="pitch-bg min-h-screen px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Liga não encontrada</h1>
      <Link to="/tabelas" className="mt-6 inline-block text-primary underline">Ver todas as tabelas</Link>
    </main>
  ),
  errorComponent: () => (
    <main className="pitch-bg min-h-screen px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Não foi possível carregar a tabela</h1>
      <p className="mt-3 text-muted-foreground">Tente novamente em alguns instantes.</p>
      <Link to="/tabelas" className="mt-6 inline-block text-primary underline">Voltar às tabelas</Link>
    </main>
  ),
  component: LeaguePage,
});

function best(rows: StandingRow[], score: (r: StandingRow) => number) {
  return [...rows].sort((a, b) => score(b) - score(a))[0];
}
const ppg = (s: StandingRow["home"]) => (s.played ? (s.win * 3 + s.draw) / s.played : 0);
const formPts = (f: string | null) =>
  (f ?? "").split("").reduce((n, c) => n + (c === "W" ? 3 : c === "D" ? 1 : 0), 0);

function Insights({ rows, name }: { rows: StandingRow[]; name: string }) {
  if (rows.length < 4) return null;
  const leader = rows[0]!;
  const second = rows[1]!;
  const attack = best(rows, (r) => r.all.goals.for)!;
  const defense = best(rows, (r) => -r.all.goals.against)!;
  const home = best(rows, (r) => ppg(r.home))!;
  const away = best(rows, (r) => ppg(r.away))!;
  const hot = best(rows, (r) => formPts(r.form))!;
  const gap = leader.points - second.points;
  const totalGoals = rows.reduce((n, r) => n + r.all.goals.for, 0);
  const totalPlayed = rows.reduce((n, r) => n + r.all.played, 0) / 2;
  return (
    <section className="mt-10 space-y-4 text-muted-foreground" aria-labelledby="analise">
      <h2 id="analise" className="font-display text-2xl text-foreground">Análise da temporada</h2>
      <p>
        <strong className="text-foreground">{leader.team.name}</strong> lidera a {name} com {leader.points} pontos em{" "}
        {leader.all.played} jogos, {gap === 0 ? `empatado em pontos com ${second.team.name}` : `${gap} ${gap === 1 ? "ponto" : "pontos"} à frente de ${second.team.name}`}.
        {totalPlayed > 0 && ` A média do campeonato é de ${(totalGoals / totalPlayed).toFixed(2)} gols por partida.`}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-lg border border-border/60 surface-card p-4">
          <span className="text-xs uppercase tracking-widest text-primary">Melhor ataque</span>
          <p className="mt-1 text-foreground">{attack.team.name} — {attack.all.goals.for} gols</p>
        </li>
        <li className="rounded-lg border border-border/60 surface-card p-4">
          <span className="text-xs uppercase tracking-widest text-primary">Defesa mais sólida</span>
          <p className="mt-1 text-foreground">{defense.team.name} — {defense.all.goals.against} gols sofridos</p>
        </li>
        <li className="rounded-lg border border-border/60 surface-card p-4">
          <span className="text-xs uppercase tracking-widest text-primary">Mais forte em casa</span>
          <p className="mt-1 text-foreground">{home.team.name} — {home.home.win}V {home.home.draw}E {home.home.lose}D</p>
        </li>
        <li className="rounded-lg border border-border/60 surface-card p-4">
          <span className="text-xs uppercase tracking-widest text-primary">Melhor visitante</span>
          <p className="mt-1 text-foreground">{away.team.name} — {away.away.win}V {away.away.draw}E {away.away.lose}D</p>
        </li>
      </ul>
      <p>
        Em melhor fase nas últimas cinco rodadas está <strong className="text-foreground">{hot.team.name}</strong>{" "}
        ({formPts(hot.form)} de 15 pontos possíveis). No jogo, um time em boa fase costuma ter moral alta — vale a pena
        reforçar o meio-campo para manter a sequência.
      </p>
      <h3 className="pt-2 font-display text-lg text-foreground">Que clube escolher na sua carreira?</h3>
      <p>
        Quer pressão por título desde a primeira rodada? Assuma {leader.team.name}. Prefere um desafio de reconstrução?
        Clubes da metade de baixo da tabela, como {rows[rows.length - 3]?.team.name}, exigem mercado esperto e paciência da
        diretoria — e rendem as campanhas mais marcantes.
      </p>
    </section>
  );
}

function Table({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="p-2">#</th><th className="p-2">Clube</th><th className="p-2 text-right">P</th>
            <th className="p-2 text-right">J</th><th className="p-2 text-right">V</th><th className="p-2 text-right">E</th>
            <th className="p-2 text-right">D</th><th className="p-2 text-right">GP</th><th className="p-2 text-right">GC</th>
            <th className="p-2 text-right">SG</th><th className="p-2">Forma</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team.id} className="border-t border-border/40">
              <td className="p-2">{r.rank}</td>
              <td className="p-2">
                <span className="flex items-center gap-2">
                  <img src={r.team.logo} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 object-contain" />
                  {r.team.name}
                </span>
              </td>
              <td className="p-2 text-right font-semibold">{r.points}</td>
              <td className="p-2 text-right">{r.all.played}</td>
              <td className="p-2 text-right">{r.all.win}</td>
              <td className="p-2 text-right">{r.all.draw}</td>
              <td className="p-2 text-right">{r.all.lose}</td>
              <td className="p-2 text-right">{r.all.goals.for}</td>
              <td className="p-2 text-right">{r.all.goals.against}</td>
              <td className="p-2 text-right">{r.goalsDiff}</td>
              <td className="p-2 font-mono text-xs">{(r.form ?? "").replace(/W/g, "V").replace(/D/g, "E").replace(/L/g, "D")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaguePage() {
  const { table, label } = Route.useLoaderData() as { table: LeagueTable | null; label: { name: string; country: string } };
  return (
    <main className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-5xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">{label.country}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Tabela da {label.name}{table ? ` ${table.season}` : ""}
        </h1>
        {!table ? (
          <p className="mt-6 text-muted-foreground">A classificação desta liga ainda está sendo atualizada. Volte em breve.</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Atualizado em {new Date(table.updatedAt).toLocaleDateString("pt-BR")}. V = vitória, E = empate, D = derrota.
            </p>
            {table.groups.map((g, i) => (
              <div key={i}>
                <Table rows={g} />
                {i === 0 && <Insights rows={g} name={label.name} />}
              </div>
            ))}
            {table.injuries.length > 0 && (
              <section className="mt-10" aria-labelledby="desfalques">
                <h2 id="desfalques" className="font-display text-2xl">Desfalques recentes</h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {table.injuries.map((i) => (
                    <li key={i.player} className="rounded-lg border border-border/60 surface-card p-3 text-sm">
                      <strong>{i.player}</strong> <span className="text-muted-foreground">· {i.team}</span>
                      <span className="block text-xs text-muted-foreground">{i.reason || i.type}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/new" className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground hover:brightness-110">
            Comandar um clube desta liga
          </Link>
          <Link to="/tabelas" className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest hover:bg-secondary">
            Outras tabelas
          </Link>
        </div>
        <PublicLinks />
      </article>
    </main>
  );
}
