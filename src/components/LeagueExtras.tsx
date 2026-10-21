import { Link } from "@tanstack/react-router";

import type { LeagueTable, StandingRow, TopPlayer } from "@/lib/real-football.functions";

import { LEAGUE_LABELS } from "@/lib/league-labels";

/** Data-driven, league-specific sections; every sentence is derived from the real numbers. */

function PlayerList({
  title,
  id,
  players,
  metric,
}: {
  title: string;
  id: string;
  players: TopPlayer[];
  metric: "goals" | "assists";
}) {
  if (!players.length) return null;
  return (
    <section className="mt-10" aria-labelledby={id}>
      <h2 id={id} className="font-display text-2xl">
        {title}
      </h2>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {players.map((p, i) => (
          <li
            key={p.name + i}
            className="flex items-center gap-3 rounded-lg border border-border/60 surface-card p-3 text-sm"
          >
            <span className="w-5 font-display text-primary">{i + 1}</span>
            {p.photo && (
              <img
                src={p.photo}
                alt={p.name}
                width={36}
                height={36}
                loading="lazy"
                className="h-9 w-9 rounded-full object-cover"
              />
            )}
            <span className="flex-1">
              <strong>{p.name}</strong>
              <span className="block text-xs text-muted-foreground">
                {p.team}
                {p.age ? ` · ${p.age} anos` : ""}
                {p.nationality ? ` · ${p.nationality}` : ""}
              </span>
            </span>
            <span className="text-right">
              <strong className="font-display text-lg">{p[metric]}</strong>
              <span className="block text-xs text-muted-foreground">{p.apps} jogos</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TopPlayers({ table }: { table: LeagueTable }) {
  const top = table.scorers[0];
  const perGame = top && top.apps ? (top.goals / top.apps).toFixed(2) : null;
  const minsPerGoal = top && top.goals ? Math.round(top.minutes / top.goals) : null;
  return (
    <>
      {top && (
        <p className="mt-10 text-muted-foreground">
          O artilheiro da {table.name} é <strong className="text-foreground">{top.name}</strong> (
          {top.team}), com {top.goals} gols em {top.apps} jogos
          {perGame ? ` — ${perGame} por partida` : ""}
          {minsPerGoal ? `, um gol a cada ${minsPerGoal} minutos` : ""}.
          {table.assisters[0] &&
            ` Quem mais serve é ${table.assisters[0].name} (${table.assisters[0].team}), com ${table.assisters[0].assists} assistências.`}
        </p>
      )}
      <PlayerList title="Artilharia" id="artilharia" players={table.scorers} metric="goals" />
      <PlayerList
        title="Líderes de assistências"
        id="assistencias"
        players={table.assisters}
        metric="assists"
      />
    </>
  );
}

export function Prospects({ table }: { table: LeagueTable }) {
  const seen = new Set<string>();
  const young = [...table.scorers, ...table.assisters]
    .filter((p) => p.age !== null && p.age <= 23)
    .filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true)))
    .slice(0, 6);
  if (!young.length) return null;
  return (
    <section className="mt-10" aria-labelledby="promessas">
      <h2 id="promessas" className="font-display text-2xl">
        Promessas para contratar no modo carreira
      </h2>
      <p className="mt-3 text-muted-foreground">
        Jogadores de até 23 anos que já aparecem entre os melhores da {table.name}. No jogo, atletas
        jovens evoluem com treino e minutos em campo — contratar cedo sai mais barato do que esperar
        o valor de mercado explodir.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {young.map((p) => (
          <li key={p.name} className="rounded-lg border border-border/60 surface-card p-3 text-sm">
            <strong>{p.name}</strong>
            <span className="block text-xs text-muted-foreground">
              {p.age} anos · {p.team}
            </span>
            <span className="block text-xs text-muted-foreground">
              {p.goals} gols · {p.assists} assistências{p.rating ? ` · nota ${p.rating}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ppg = (s: StandingRow["home"]) => (s.played ? (s.win * 3 + s.draw) / s.played : 0);

export function HomeAway({ rows }: { rows: StandingRow[] }) {
  if (rows.length < 6) return null;
  const gaps = rows.map((r) => ({ r, d: ppg(r.home) - ppg(r.away) }));
  const homeDep = [...gaps].sort((a, b) => b.d - a.d).slice(0, 3);
  const travel = [...gaps].sort((a, b) => a.d - b.d).slice(0, 3);
  return (
    <section className="mt-10 text-muted-foreground" aria-labelledby="casa-fora">
      <h2 id="casa-fora" className="font-display text-2xl text-foreground">
        Casa x fora: quem depende do mando
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 surface-card p-4">
          <h3 className="text-xs uppercase tracking-widest text-primary">Fortes só em casa</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {homeDep.map(({ r }) => (
              <li key={r.team.id}>
                <strong className="text-foreground">{r.team.name}</strong>: {ppg(r.home).toFixed(2)}{" "}
                pts/jogo em casa, {ppg(r.away).toFixed(2)} fora
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border/60 surface-card p-4">
          <h3 className="text-xs uppercase tracking-widest text-primary">Rendem bem fora</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {travel.map(({ r }) => (
              <li key={r.team.id}>
                <strong className="text-foreground">{r.team.name}</strong>: {ppg(r.away).toFixed(2)}{" "}
                pts/jogo fora, {ppg(r.home).toFixed(2)} em casa
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3">
        No jogo, contra times que dependem do mando, vale escalar um meio-campo mais fechado quando
        você joga na casa deles e pressionar alto quando eles visitam o seu estádio.
      </p>
    </section>
  );
}

export function Zones({ rows }: { rows: StandingRow[] }) {
  const zones = new Map<string, string[]>();
  for (const r of rows)
    if (r.description) zones.set(r.description, [...(zones.get(r.description) ?? []), r.team.name]);
  if (!zones.size) return null;
  return (
    <section className="mt-10" aria-labelledby="zonas">
      <h2 id="zonas" className="font-display text-2xl">
        O que está em jogo
      </h2>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {[...zones].map(([d, teams]) => (
          <li key={d}>
            <strong className="text-foreground">{d}:</strong> {teams.join(", ")}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="mt-10" aria-labelledby="faq">
      <h2 id="faq" className="font-display text-2xl">
        Perguntas frequentes
      </h2>
      <dl className="mt-4 space-y-4">
        {items.map((f) => (
          <div key={f.q}>
            <dt className="font-semibold">{f.q}</dt>
            <dd className="mt-1 text-muted-foreground">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MidCta({ team, name }: { team?: string | undefined; name: string }) {
  return (
    <aside className="mt-10 rounded-xl border border-primary/40 bg-primary/10 p-5 sm:flex sm:items-center sm:justify-between">
      <p className="font-display text-lg">
        {team ? `Consegue fazer melhor que o ${team}?` : `Monte seu time na ${name}.`}
        <span className="block text-sm font-normal text-muted-foreground">
          Grátis, sem download, com elencos reais.
        </span>
      </p>
      <Link
        to="/new"
        className="mt-3 inline-block rounded-lg bg-primary px-5 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground sm:mt-0"
      >
        Assumir um clube
      </Link>
    </aside>
  );
}

export function OtherLeagues({ current }: { current: string }) {
  return (
    <nav className="mt-10" aria-label="Outras ligas">
      <h2 className="font-display text-xl">Outras tabelas</h2>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {Object.entries(LEAGUE_LABELS)
          .filter(([s]) => s !== current)
          .map(([slug, l]) => (
            <li key={slug}>
              <Link
                to="/tabelas/$slug"
                params={{ slug }}
                className="inline-block rounded-full border border-border px-3 py-1 hover:bg-secondary"
              >
                Tabela {l.name}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
