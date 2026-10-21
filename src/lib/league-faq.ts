import type { LeagueTable } from "@/lib/real-football.functions";

export function leagueFaq(table: LeagueTable, name: string) {
  const rows = table.groups[0] ?? [];
  const out: { q: string; a: string }[] = [];
  if (rows[0])
    out.push({
      q: `Quem lidera a ${name} ${table.season}?`,
      a: `${rows[0].team.name}, com ${rows[0].points} pontos em ${rows[0].all.played} jogos.`,
    });
  if (table.scorers[0])
    out.push({
      q: `Quem é o artilheiro da ${name}?`,
      a: `${table.scorers[0].name} (${table.scorers[0].team}), com ${table.scorers[0].goals} gols.`,
    });
  if (table.assisters[0])
    out.push({
      q: `Quem tem mais assistências na ${name}?`,
      a: `${table.assisters[0].name} (${table.assisters[0].team}), com ${table.assisters[0].assists} assistências.`,
    });
  out.push({
    q: `Dá para treinar um clube da ${name} no jogo?`,
    a: `Sim. Todos os clubes da ${name} estão no Pro Football Manager 3D, grátis no navegador, com elencos reais.`,
  });
  return out;
}
