import { Link } from "@tanstack/react-router";
import type { LeagueDigest } from "@/lib/real-football.functions";

const pct = (n: number) => `${Math.round(n)}%`;

/** Imported statistics provide context, not causal rules for the simulation. */
function gestaoAdvice(l: LeagueDigest) {
  const tips: string[] = [];
  if (l.homeWinPct >= 46)
    tips.push(
      `mandantes vencem ${pct(l.homeWinPct)} dos jogos registrados; compare o mando com a força dos rivais antes de planejar o rodízio`,
    );
  else if (l.awayWinPct >= 32)
    tips.push(
      `visitantes vencem ${pct(l.awayWinPct)} dos jogos registrados; o mando sozinho não determina a altura da linha defensiva`,
    );
  if (l.drawPct >= 28)
    tips.push(
      `${pct(l.drawPct)} de empates nos registros; avalie o valor de um ponto conforme a classificação e a meta da sua carreira`,
    );
  if (l.goalsPerGame >= 2.9)
    tips.push(
      `média de ${l.goalsPerGame.toFixed(2)} gols por jogo; observe criação e proteção defensiva sem atribuir a média a um único perfil de jogador`,
    );
  else if (l.goalsPerGame <= 2.4)
    tips.push(
      `média de ${l.goalsPerGame.toFixed(2)} gols por jogo; esse dado não mede isoladamente a qualidade da posse ou da finalização`,
    );
  if (l.injuries >= 150)
    tips.push(
      `${l.injuries} registros de lesão na cobertura disponível; confira período e abrangência antes de comparar ligas ou definir o tamanho do elenco`,
    );
  if (!tips.length)
    tips.push(
      `${pct(l.homeWinPct)} de vitórias em casa e ${pct(l.drawPct)} de empates na amostra; use os percentuais como contexto para observar seus próximos adversários`,
    );
  return tips;
}

function scoutingAdvice(l: LeagueDigest) {
  const tips: string[] = [];
  tips.push(
    `${l.bestDefense.team} sofreu ${l.bestDefense.against} gols em ${l.bestDefense.played} jogos nos dados disponíveis; avalie os atletas individualmente, pois o desempenho coletivo não garante a qualidade dos reservas`,
  );
  if (l.overPerformer && l.overPerformer.goalsDiff >= 0)
    tips.push(
      `${l.overPerformer.team} está em ${l.overPerformer.rank}º com saldo +${l.overPerformer.goalsDiff}; compare adversários e minutos dos candidatos antes de inferir qualidade ou preço`,
    );
  else if (l.overPerformer)
    tips.push(
      `${l.overPerformer.team} ocupa o ${l.overPerformer.rank}º lugar com saldo ${l.overPerformer.goalsDiff}; a posição na tabela não confirma disponibilidade nem desconto no mercado`,
    );
  if (l.injuries >= 100)
    tips.push(
      `com ${l.injuries} lesões registradas, priorize jogadores com histórico físico limpo`,
    );
  return tips;
}

export function LeagueDataInsights({
  leagues,
  mode,
}: {
  leagues: LeagueDigest[];
  mode: "gestao" | "scouting";
}) {
  if (!leagues.length) return null;
  const homeAvg = leagues.reduce((n, l) => n + l.homeWinPct, 0) / leagues.length;
  const goalsTop = [...leagues].sort((a, b) => b.goalsPerGame - a.goalsPerGame)[0]!;
  const goalsLow = [...leagues].sort((a, b) => a.goalsPerGame - b.goalsPerGame)[0]!;
  return (
    <section aria-labelledby={`dados-${mode}`} className="mt-10 space-y-5">
      <h2 id={`dados-${mode}`} className="font-display text-2xl text-foreground">
        {mode === "gestao"
          ? "Contexto das ligas reais para estudar a gestão"
          : "Contexto das ligas reais para observar jogadores"}
      </h2>
      <p>
        Indicadores importados de {leagues.length} ligas nas temporadas informadas abaixo. A média
        simples dos percentuais de vitórias dos mandantes é {pct(homeAvg)}; cada liga tem o mesmo
        peso, independentemente do número de partidas. A maior média de gols nesta amostra é da{" "}
        {goalsTop.name} ({goalsTop.goalsPerGame.toFixed(2)} gols por jogo) e a menor é da{" "}
        {goalsLow.name} ({goalsLow.goalsPerGame.toFixed(2)}).{" "}
        {mode === "gestao"
          ? "Use esses dados para formular perguntas; sua temporada simulada tem resultados próprios."
          : "Os indicadores ajudam a organizar observações, mas não confirmam potencial, preço ou disponibilidade no modo carreira."}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Indicadores reais por liga</caption>
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2">
                Liga
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Gols/jogo
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Casa
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Empate
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Fora
              </th>
              <th scope="col" className="px-3 py-2">
                Líder
              </th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((l) => (
              <tr key={l.slug} className="border-t border-border/40">
                <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                  <Link
                    to="/tabelas/$slug"
                    params={{ slug: l.slug }}
                    className="hover:text-primary hover:underline"
                  >
                    {l.name}
                  </Link>
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{l.goalsPerGame.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(l.homeWinPct)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(l.drawPct)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(l.awayWinPct)}</td>
                <td className="px-3 py-2">
                  {l.leader}
                  <span className="text-muted-foreground"> (+{l.leaderGap})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {leagues.map((l) => (
          <article key={l.slug} className="rounded-xl border border-border/60 surface-card p-4">
            <h3 className="font-display text-lg text-foreground">
              {l.name}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {l.country} {l.season}
              </span>
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              {(mode === "gestao" ? gestaoAdvice(l) : scoutingAdvice(l)).map((t) => (
                <li key={t}>{t[0]!.toUpperCase() + t.slice(1)}.</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
