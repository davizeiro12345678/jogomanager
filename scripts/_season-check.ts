import { initCareer, advanceRound, migrateCareer } from "../src/game/career";
import { computeTable, nextFixture } from "../src/game/season";
import { quickSimulate } from "../src/game/career";

let s = initCareer("bra", "fla", "Davi");
const start = { league: s.leagueId, season: s.season };
let guard = 0;
while (s.season <= 2 && guard++ < 3000) {
  const f = nextFixture(s);
  if (!f) break;
  const r = quickSimulate(f.home, f.away, `t-${s.season}-${s.round}`);
  s = advanceRound(s, { hg: r.hg ?? r.homeGoals ?? 1, ag: r.ag ?? r.awayGoals ?? 0 });
  if (s.season > 2) break;
}
console.log("rodadas simuladas:", guard);
console.log("temporada final:", s.season, "liga:", s.leagueId, "(inicial", start.league + ")");
console.log("acessos:", s.records?.promotions ?? 0, "rebaixamentos:", s.records?.relegations ?? 0);
console.log("histórico de temporadas:", s.history.length);
console.log("tabela ok:", computeTable(s).length, "times");
const bad = Object.values(s.players).filter((p: any) => !Number.isFinite(p.overall));
console.log("jogadores inválidos:", bad.length);

// save antigo (v1) preservado
const legacy = { version: 1, leagueId: "bra", clubId: "fla", managerName: "Antigo", season: 4, round: 7, players: {}, fixtures: [], results: [], lineup: [], bench: [], tactics: { formation: "4-4-2", mentality: 2, pressing: 1, width: 1, tempo: 1 } };
const m = migrateCareer(legacy as any);
console.log("save antigo -> versão", m.version, "temporada", m.season, "rodada", m.round, "clube", m.clubId);
