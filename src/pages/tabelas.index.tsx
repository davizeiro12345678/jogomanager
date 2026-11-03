import { StickyPlayCta } from "@/components/StickyPlayCta";

import { Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";

import { LEAGUE_LABELS } from "@/lib/league-labels";
import { TABELAS_INDEX_PATH as PATH } from "@/lib/public-route-paths";

export function TablesIndex() {
  return (
    <main className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-5xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Futebol real</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Tabelas das principais ligas
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Cada página traz a classificação da temporada atual, quem rende melhor em casa e fora, o
          melhor ataque, a defesa mais sólida, a forma das últimas cinco rodadas e os jogadores
          lesionados. Use essas informações para escolher o clube da sua carreira de técnico.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(LEAGUE_LABELS).map(([slug, l]) => (
            <li key={slug}>
              <Link
                to="/tabelas/$slug"
                params={{ slug }}
                className="block rounded-xl border border-border/60 surface-card p-5 transition hover:border-primary"
              >
                <span className="font-display text-lg">{l.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{l.country}</span>
              </Link>
            </li>
          ))}
        </ul>
        <section className="mt-14 grid gap-8 lg:grid-cols-2" aria-labelledby="tables-how">
          <div>
            <h2 id="tables-how" className="font-display text-2xl">
              O que cada tabela mostra
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Classificação completa:</strong> pontos, jogos,
                vitórias, empates, derrotas, gols pró e contra e saldo de cada clube.
              </li>
              <li>
                <strong className="text-foreground">Casa e fora:</strong> times que somam muito
                em casa e pouco fora costumam depender do mando — algo a considerar na sua tática.
              </li>
              <li>
                <strong className="text-foreground">Forma recente:</strong> os últimos cinco
                resultados mostram quem está em alta antes da próxima rodada.
              </li>
              <li>
                <strong className="text-foreground">Artilharia e assistências:</strong> os
                jogadores que mais decidem no campeonato.
              </li>
              <li>
                <strong className="text-foreground">Desfalques:</strong> atletas lesionados ou
                suspensos informados pela fonte de dados.
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl">Da tabela real para a sua carreira</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Antes de criar sua carreira de técnico, veja como o clube está de verdade. Um time na
              parte de baixo da tabela é um desafio de reconstrução; um líder exige manter o nível
              com o elenco cansado e a pressão da diretoria. Os dados são atualizados a partir de
              uma fonte esportiva externa e podem ter algumas horas de atraso em dia de rodada.
            </p>
            <Link
              to="/new"
              className="mt-4 inline-flex min-h-11 items-center text-sm text-primary"
            >
              Escolher meu clube e começar →
            </Link>
          </div>
        </section>
        <PublicLinks exclude={PATH} />
      </div>
      <StickyPlayCta />
    </main>
  );
}
