// ============================================================================
//  regen.ts
//  Fim de carreira e novas gerações: veteranos se aposentam, garotos da base
//  sobem ao elenco principal com potencial próprio.
// ============================================================================

import { CLUBS } from "./data/leagues";
import { poolForLeague } from "./data/names";
import { makeRng } from "./rng";
import { PERSONALITIES } from "./attributes";
import type { NewsItem, Player, Position } from "./types";

const SHAPE: Position[] = ["GK", "DF", "DF", "MF", "MF", "FW", "DF", "MF", "FW"];

function chanceToRetire(p: Player, rnd: () => number) {
  if (p.age < 33) return false;
  const base = (p.age - 32) * 0.18 + Math.max(0, (72 - p.ovr) / 100);
  return rnd() < Math.min(0.95, base);
}

function attrs(pos: Position, ovr: number, rnd: () => number) {
  const j = (v: number) => Math.max(35, Math.min(99, Math.round(v + rnd() * 8 - 4)));
  if (pos === "GK")
    return { pace: j(ovr - 20), shooting: j(ovr - 40), passing: j(ovr - 12), defending: j(ovr), physical: j(ovr - 4) };
  if (pos === "DF")
    return { pace: j(ovr - 4), shooting: j(ovr - 25), passing: j(ovr - 8), defending: j(ovr + 4), physical: j(ovr + 3) };
  if (pos === "MF")
    return { pace: j(ovr - 2), shooting: j(ovr - 8), passing: j(ovr + 4), defending: j(ovr - 6), physical: j(ovr - 2) };
  return { pace: j(ovr + 3), shooting: j(ovr + 4), passing: j(ovr - 6), defending: j(ovr - 22), physical: j(ovr - 2) };
}

/** Cria um jovem da base do clube, já com potencial e personalidade. */
export function makeYouth(clubId: string, index: number, season: number, rnd: () => number): Player {
  const club = CLUBS[clubId];
  const pool = poolForLeague(club?.league ?? "bra");
  const name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
  const pos = SHAPE[index % SHAPE.length]!;
  const strength = club?.strength ?? 70;
  const ovr = Math.max(48, Math.round(strength - 16 + rnd() * 10));
  const potential = Math.min(94, ovr + 6 + Math.floor(rnd() * 22));
  return {
    id: `${clubId}-y${season}-${index}-${Math.floor(rnd() * 9999)}`,
    clubId,
    name,
    pos,
    age: 16 + Math.floor(rnd() * 3),
    number: 30 + index,
    ovr,
    ...attrs(pos, ovr, rnd),
    condition: 92 + Math.floor(rnd() * 8),
    morale: 78 + Math.floor(rnd() * 18),
    goals: 0,
    assists: 0,
    apps: 0,
    wage: Math.round((ovr / 12) * 10) / 10,
    value: Math.round((ovr / 8) * 10) / 10,
    yellows: 0,
    suspended: false,
    injuryWeeks: 0,
    potential,
    personality: PERSONALITIES[Math.floor(rnd() * PERSONALITIES.length)]!,
    form: 60 + Math.floor(rnd() * 20),
    contractYears: 3 + Math.floor(rnd() * 2),
  };
}

export interface RegenResult {
  players: Record<string, Player>;
  news: NewsItem[];
  retired: Player[];
  promoted: Player[];
}

/**
 * Aplica aposentadorias e promove garotos da base para repor o elenco.
 * Chamado na virada de temporada, depois do envelhecimento.
 */
export function applyRegens(
  players: Record<string, Player>,
  clubId: string,
  season: number,
  round: number,
): RegenResult {
  const rnd = makeRng(`regen-${clubId}-${season}`);
  const next: Record<string, Player> = {};
  const retired: Player[] = [];
  const news: NewsItem[] = [];

  for (const [id, p] of Object.entries(players)) {
    if (chanceToRetire(p, rnd)) {
      retired.push(p);
      continue;
    }
    next[id] = p;
  }

  for (const p of retired) {
    news.push({
      id: `retire-${p.id}-${season}`,
      season,
      round,
      kind: "sistema",
      title: `${p.name} pendura as chuteiras`,
      body: `Aos ${p.age} anos, ${p.name} anuncia a aposentadoria depois de ${p.apps} jogos na temporada. O clube prepara uma homenagem.`,
    });
  }

  const promoted: Player[] = [];
  const target = Math.max(18, Object.keys(players).length);
  let i = 0;
  while (Object.keys(next).length < target && i < 12) {
    const y = makeYouth(clubId, i, season, rnd);
    next[y.id] = y;
    promoted.push(y);
    i++;
  }

  if (promoted.length) {
    const gems = promoted.filter((p) => (p.potential ?? 0) >= 84);
    news.push({
      id: `youth-${clubId}-${season}`,
      season,
      round,
      kind: "sistema",
      title: `${promoted.length} garoto(s) sobem da base`,
      body: gems.length
        ? `A base entrega reforços, e ${gems.map((g) => g.name).join(", ")} chama(m) atenção do departamento técnico como possível joia.`
        : `Os novos nomes: ${promoted.map((p) => p.name).join(", ")}. Vão brigar por espaço na pré-temporada.`,
    });
  }

  return { players: next, news, retired, promoted };
}
