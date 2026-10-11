import { Link } from "@tanstack/react-router";
import type { LeagueDigest } from "@/lib/real-football.functions";

const pct = (n: number) => `${Math.round(n)}%`;

/** Advice derived only from each league's real numbers; no invented facts. */
function gestaoAdvice(l: LeagueDigest) {
  const tips: string[] = [];
  if (l.homeWinPct >= 46) tips.push(`mandantes vencem ${pct(l.homeWinPct)} dos jogos: escale força máxima em casa e poupe titulares fora`);
  else if (l.awayWinPct >= 32) tips.push(`visitantes vencem ${pct(l.awayWinPct)} das vezes: jogar fora não é desculpa para recuar, mantenha a linha alta`);
  if (l.drawPct >= 28) tips.push(`${pct(l.drawPct)} de empates: um ponto fora vale ouro, e o banco precisa de um atacante para virar jogos travados`);
  if (l.goalsPerGame >= 2.9) tips.push(`média de ${l.goalsPerGame.toFixed(2)} gols por jogo: invista em zagueiros rápidos, porque a liga pune defesa lenta`);
  else if (l.goalsPerGame <= 2.4) tips.push(`só ${l.goalsPerGame.toFixed(2)} gols por jogo: cada gol decide, então bola parada e um centroavante finalizador valem mais que posse`);
  if (l.injuries >= 150) tips.push(`${l.injuries} lesões registradas: elenco de 25 é o mínimo para atravessar a temporada`);
  if (!tips.length) tips.push(`liga equilibrada (${pct(l.homeWinPct)} casa, ${pct(l.drawPct)} empates): consistência rende mais que apostas táticas`);
  return tips;
}

function scoutingAdvice(l: LeagueDigest) {
  const tips: string[] = [];
  tips.push(
    `${l.bestDefense.team} sofreu ${l.bestDefense.against} gols em ${l.bestDefense.played} jogos — a defesa mais sólida; seus zagueiros reservas são alvos seguros`,
  );
  if (l.overPerformer && l.overPerformer.goalsDiff >= 0)
    tips.push(
      `${l.overPerformer.team} está em ${l.overPerformer.rank}º, mas tem saldo ${l.overPerformer.goalsDiff >= 0 ? "+" : ""}${l.overPerformer.goalsDiff}: elenco melhor que a posição, ótimo lugar para comprar barato`,
    );
  else if (l.overPerformer)
    tips.push(`na metade de baixo, ${l.overPerformer.team} (${l.overPerformer.rank}º) tem o melhor saldo: clube sob pressão costuma vender titulares abaixo do valor`);
  if (l.injuries >= 100) tips.push(`com ${l.injuries} lesões registradas, priorize jogadores com histórico físico limpo`);
  return tips;
}

export function LeagueDataInsights({ leagues, mode }: { leagues: LeagueDigest[]; mode: "gestao" | "scouting" }) {
  if (!leagues.length) return null;
  const homeAvg = leagues.reduce((n, l) => n + l.homeWinPct, 0) / leagues.length;
  const goalsTop = [...leagues].sort((a, b) => b.goalsPerGame - a.goalsPerGame)[0]!;
  const goalsLow = [...leagues].sort((a, b) => a.goalsPerGame - b.goalsPerGame)[0]!;
  return (
    <section aria-labelledby={`dados-${mode}`} className="mt-10 space-y-5">
      <h2 id={`dados-${mode}`} className="font-display text-2xl text-foreground">
        {mode === "gestao" ? "Como cada liga real muda a sua gestão" : "Onde procurar reforços em cada liga real"}
      </h2>
      <p>
        Números das temporadas atuais de {leagues.length} ligas, tirados das tabelas oficiais. Em média os mandantes vencem{" "}
        {pct(homeAvg)} dos jogos. A liga mais aberta é a {goalsTop.name} ({goalsTop.goalsPerGame.toFixed(2)} gols por jogo) e a mais
        fechada é a {goalsLow.name} ({goalsLow.goalsPerGame.toFixed(2)}).{" "}
        {mode === "gestao"
          ? "Isso muda a forma de montar o elenco: abaixo está o que fazer em cada uma."
          : "Esses números mostram onde há bons jogadores escondidos em clubes que estão mal na tabela."}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Indicadores reais por liga</caption>
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2">Liga</th>
              <th scope="col" className="px-3 py-2 text-right">Gols/jogo</th>
              <th scope="col" className="px-3 py-2 text-right">Casa</th>
              <th scope="col" className="px-3 py-2 text-right">Empate</th>
              <th scope="col" className="px-3 py-2 text-right">Fora</th>
              <th scope="col" className="px-3 py-2">Líder</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((l) => (
              <tr key={l.slug} className="border-t border-border/40">
                <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                  <Link to="/tabelas/$slug" params={{ slug: l.slug }} className="hover:text-primary hover:underline">
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
              {l.name} <span className="text-sm font-normal text-muted-foreground">· {l.country} {l.season}</span>
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
