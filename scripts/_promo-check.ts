import { initCareer, advanceRound, quickSimulate } from "../src/game/career";
import { nextFixture } from "../src/game/season";
import { CLUBS } from "../src/game/data/leagues";

const second = Object.values(CLUBS).find((c: any) => c.league === "bra2") as any;
console.log("clube 2ª divisão:", second?.id, second?.league);
let s = initCareer("bra2", second.id, "Davi");
let guard = 0;
while (s.season <= 2 && guard++ < 3000) {
  const f = nextFixture(s);
  if (!f) break;
  const user = f.home === s.clubId;
  const r = quickSimulate(f.home, f.away, `p-${s.season}-${s.round}`);
  // força vitórias do usuário para disputar o acesso
  s = advanceRound(s, user ? { hg: 4, ag: 0 } : { hg: 0, ag: 3 });
}
console.log("temporada:", s.season, "liga atual:", s.leagueId);
console.log("acessos:", s.records?.promotions ?? 0, "rebaixamentos:", s.records?.relegations ?? 0);
console.log("notícias de acesso:", s.news.filter((n: any) => /acesso|rebaixad/i.test(n.title)).length);
const bad = Object.values(s.players).filter((p: any) => !Number.isFinite(p.ovr));
console.log("jogadores inválidos:", bad.length);
