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
import { positionalOverall, potentialFor } from "./overall";

const SHAPE: Position[] = ["GK", "DF", "DF", "MF", "MF", "FW", "DF", "MF", "FW"];

/**
 * Aposentadoria: idade é o fator principal; físico baixo, lesão longa e nível
 * baixo antecipam; goleiros duram mais. Ninguém passa dos 41.
 */
export function retireChance(p: Player): number {
  const start = p.pos === "GK" ? 34 : 32;
  if (p.age >= 41) return 1;
  if (p.age < start - 2) return 0;
  let c = Math.max(0, p.age - start) * 0.17;
  c += Math.max(0, (70 - p.physical) / 120);
  c += Math.max(0, (68 - p.ovr) / 90);
  if (p.injuryWeeks > 8) c += 0.12;
  if (p.age < start) c *= 0.3;
  return Math.min(0.97, c);
}

function chanceToRetire(p: Player, rnd: () => number) {
  return rnd() < retireChance(p);
}

function attrs(pos: Position, ovr: number, rnd: () => number) {
  const j = (v: number) => Math.max(35, Math.min(99, Math.round(v + rnd() * 8 - 4)));
  if (pos === "GK")
    return {
      pace: j(ovr - 20),
      shooting: j(ovr - 40),
      passing: j(ovr - 12),
      defending: j(ovr),
      physical: j(ovr - 4),
    };
  if (pos === "DF")
    return {
      pace: j(ovr - 4),
      shooting: j(ovr - 25),
      passing: j(ovr - 8),
      defending: j(ovr + 4),
      physical: j(ovr + 3),
    };
  if (pos === "MF")
    return {
      pace: j(ovr - 2),
      shooting: j(ovr - 8),
      passing: j(ovr + 4),
      defending: j(ovr - 6),
      physical: j(ovr - 2),
    };
  return {
    pace: j(ovr + 3),
    shooting: j(ovr + 4),
    passing: j(ovr - 6),
    defending: j(ovr - 22),
    physical: j(ovr - 2),
  };
}

/** Cria um jovem da base do clube, já com potencial e personalidade. */
export function makeYouth(
  clubId: string,
  index: number,
  season: number,
  rnd: () => number,
): Player {
  const club = CLUBS[clubId];
  const pool = poolForLeague(club?.league ?? "bra");
  const name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
  const pos = SHAPE[index % SHAPE.length]!;
  const strength = club?.strength ?? 70;
  // ~4% de chance de "joia rara": nível inicial e teto bem acima da base.
  const gem = rnd() < 0.04;
  const baseOvr = Math.max(46, Math.round(strength - 16 + rnd() * 10 + (gem ? 6 : 0)));
  const a = attrs(pos, baseOvr, rnd);
  const ovr = Math.max(44, positionalOverall(pos, a));
  const age = 16 + Math.floor(rnd() * 3);
  const potential = gem
    ? Math.min(96, Math.max(88, potentialFor(ovr, age, 0.3, `${clubId}-${season}-${index}`) + 8))
    : Math.min(92, potentialFor(ovr, age, 0.1, `${clubId}-${season}-${index}`));
  return {
    id: `${clubId}-y${season}-${index}-${Math.floor(rnd() * 9999)}`,
    clubId,
    name,
    pos,
    age,
    number: 30 + index,
    ovr,
    ...a,
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
