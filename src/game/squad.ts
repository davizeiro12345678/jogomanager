// ============================================================================
//  squad.ts
//  Montagem determinística do elenco de um clube.
//
//  Regras de sobrevivência (cada uma cobre uma falha real já encontrada):
//   - clube inexistente não derruba a tela: cai num clube genérico;
//   - entrada de elenco nomeado malformada é descartada em vez de virar
//     jogador sem posição / com idade NaN;
//   - overall, idade e atributos são sempre limitados a faixas válidas;
//   - o elenco tem ao menos dois goleiros (sem goleiro a simulação deixa o
//     gol aberto e qualquer chute entra);
//   - números de camisa e nomes nunca se repetem no mesmo time.
// ============================================================================

import { safeClub } from "./club-reference";
import { NAMED_SQUADS } from "./data/squads";
import { poolForLeague } from "./data/names";
import { makeRng } from "./rng";
import type { Club, Player, Position } from "./types";

// Keep the existing API for match/career consumers while selection can use
// the lightweight lookup without loading named squads and player name pools.
export { safeClub } from "./club-reference";

const SHAPE: Position[] = [
  "GK",
  "DF",
  "DF",
  "DF",
  "DF",
  "MF",
  "MF",
  "MF",
  "FW",
  "FW",
  "FW",
  "MF",
  "DF",
  "GK",
  "FW",
  "MF",
];

const POSITIONS = new Set<Position>(["GK", "DF", "MF", "FW"]);

/** Profundidade mínima para calendário, lesões e suspensões; não é uma lista oficial. */
export const SQUAD_SIZE = 26;
export const MIN_GOALKEEPERS = 3;
const LEGACY_SQUAD_SIZE = 18;

// Previous built-in priors, only for recognizing untouched players in old saves.
const LEGACY_STRENGTH: Record<string, number> = {
  fla: 88,
  pal: 87,
  bot: 84,
  cru: 83,
  mgo: 82,
  sao: 81,
  flu: 80,
  int: 79,
  gre: 79,
  cor: 79,
  bah: 78,
  vas: 77,
  for: 76,
  san: 76,
  rbb: 75,
  mir: 73,
  cea: 72,
  spt: 71,
  vit: 71,
  juv: 69,
  cor_pr: 71,
  ath: 73,
  cha: 67,
  rem: 65,
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Números preferenciais: 1 e 12 para os goleiros, depois a fila natural. */
function shirtNumbers(count: number, gkIndexes: Set<number>): number[] {
  const pool: number[] = [];
  pool.push(1, 12);
  for (let n = 2; n <= 11; n++) pool.push(n);
  for (let n = 13; n <= 40; n++) pool.push(n);
  const out: number[] = new Array(count).fill(0);
  const taken = new Set<number>();
  // goleiros primeiro, para garantir 1 e 12
  for (const i of [...gkIndexes].sort((a, b) => a - b)) {
    const n = pool.find((candidate) => !taken.has(candidate))!;
    taken.add(n);
    out[i] = n;
  }
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    if (gkIndexes.has(i)) continue;
    while (cursor < pool.length && taken.has(pool[cursor]!)) cursor++;
    const n = pool[cursor] ?? 40 + i;
    taken.add(n);
    out[i] = clamp(n, 1, 99);
  }
  return out;
}

function attrsFor(pos: Position, ovr: number, rnd: () => number) {
  const j = (v: number) => clamp(Math.round(v + (rnd() * 8 - 4)), 35, 99);
  switch (pos) {
    case "GK":
      return {
        pace: j(ovr - 20),
        shooting: j(ovr - 40),
        passing: j(ovr - 12),
        defending: j(ovr),
        physical: j(ovr - 4),
      };
    case "DF":
      return {
        pace: j(ovr - 4),
        shooting: j(ovr - 25),
        passing: j(ovr - 8),
        defending: j(ovr + 4),
        physical: j(ovr + 3),
      };
    case "MF":
      return {
        pace: j(ovr - 2),
        shooting: j(ovr - 6),
        passing: j(ovr + 4),
        defending: j(ovr - 5),
        physical: j(ovr - 2),
      };
    default:
      return {
        pace: j(ovr + 3),
        shooting: j(ovr + 4),
        passing: j(ovr - 4),
        defending: j(ovr - 22),
        physical: j(ovr - 2),
      };
  }
}

interface DraftPlayer {
  name: string;
  pos: Position;
  age: number;
  ovr: number;
  /** entradas vindas do catálogo nomeado não podem ser reescritas pela garantia de goleiro */
  named: boolean;
}

function draftFromCatalog(clubId: string, legacy = false): DraftPlayer[] {
  const raw =
    legacy && clubId === "ath"
      ? NAMED_SQUADS["ath_b"]
      : legacy && clubId === "ath_b"
        ? undefined
        : NAMED_SQUADS[clubId];
  if (!raw) return [];
  const out: DraftPlayer[] = [];
  for (const entry of raw.split(";")) {
    const parts = entry.split("|");
    if (parts.length !== 4) continue; // entrada corrompida: fora, não vira jogador inválido
    const [pos, name, age, ovr] = parts;
    if (!POSITIONS.has(pos as Position)) continue;
    if (!name || !name.trim()) continue;
    const a = Number(age);
    const o = Number(ovr);
    if (!Number.isFinite(a) || !Number.isFinite(o)) continue;
    out.push({
      name: name.trim(),
      pos: pos as Position,
      age: clamp(Math.round(a), 16, 45),
      ovr: clamp(Math.round(o), 40, 99),
      named: true,
    });
  }
  return out;
}

/** Same starting-XI scale for named and generated clubs; names do not grant a bonus. */
function calibrateDraft(draft: DraftPlayer[], strength: number) {
  const best = (pos: Position, count: number) =>
    draft
      .filter((p) => p.pos === pos)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, count);
  const starters = [...best("GK", 1), ...best("DF", 4), ...best("MF", 3), ...best("FW", 3)];
  if (!starters.length) return;
  const mean = starters.reduce((sum, p) => sum + p.ovr, 0) / starters.length;
  const delta = Math.round(clamp(strength - 2, 40, 94) - mean);
  for (const p of draft) p.ovr = clamp(p.ovr + delta, 40, 94);
}

/**
 * Garante pelo menos `MIN_GOALKEEPERS` goleiros. Só converte jogadores gerados
 * (nunca do catálogo real) e escolhe os de menor overall, que naturalmente
 * seriam reservas — o impacto competitivo é o menor possível.
 */
function ensureGoalkeepers(draft: DraftPlayer[], rnd: () => number): DraftPlayer[] {
  let gks = draft.filter((d) => d.pos === "GK").length;
  if (gks >= 2) return draft;
  const candidates = draft
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => !d.named && d.pos !== "GK")
    .sort((a, b) => a.d.ovr - b.d.ovr || a.i - b.i);
  for (const { d } of candidates) {
    if (gks >= 2) break;
    d.pos = "GK";
    d.ovr = clamp(d.ovr - 2, 40, 99); // goleiro improvisado rende menos
    d.age = clamp(d.age, 17, 40);
    gks++;
  }
  void rnd;
  return draft;
}

/** Nome repetido recebe uma inicial intermediária determinística. */
function dedupeNames(draft: DraftPlayer[]): DraftPlayer[] {
  const seen = new Set<string>();
  for (const d of draft) {
    if (!seen.has(d.name)) {
      seen.add(d.name);
      continue;
    }
    const parts = d.name.split(" ");
    let candidate = d.name;
    for (let k = 0; k < 26 && seen.has(candidate); k++) {
      const initial = String.fromCharCode(65 + (k % 26));
      candidate =
        parts.length > 1
          ? `${parts[0]} ${initial}. ${parts.slice(1).join(" ")}`
          : `${d.name} ${initial}`;
    }
    d.name = candidate;
    seen.add(candidate);
  }
  return draft;
}

function makePlayer(
  club: Club,
  draft: DraftPlayer[],
  index: number,
  number: number,
  rnd: () => number,
): Player {
  const d = draft[index]!;
  return {
    id: `${club.id}-${index}`,
    clubId: club.id,
    name: d.name,
    pos: d.pos,
    age: d.age,
    number,
    ovr: d.ovr,
    ...attrsFor(d.pos, d.ovr, rnd),
    condition: 88 + Math.floor(rnd() * 12),
    morale: 70 + Math.floor(rnd() * 25),
    goals: 0,
    assists: 0,
    apps: 0,
    wage: 0,
    value: 0,
    yellows: 0,
    suspended: false,
    injuryWeeks: 0,
    rosterSource: d.named ? "catalog" : "generated",
  };
}

export function buildSquad(clubId: string): Player[] {
  return createSquad(clubId, false);
}

/** Migration fingerprint only; never used to populate a new save or play a match. */
export function buildLegacySquad(clubId: string): Player[] {
  return createSquad(clubId, true);
}

function createSquad(clubId: string, legacy: boolean): Player[] {
  const club = { ...safeClub(clubId) };
  if (legacy) club.strength = LEGACY_STRENGTH[clubId] ?? club.strength;
  const rnd = makeRng(`squad-${clubId}`);
  const draft: DraftPlayer[] = draftFromCatalog(clubId, legacy);

  const pool = poolForLeague(club.league);
  const used = new Set(draft.map((d) => d.name));
  // Keep the original RNG sequence and identifiers of the first 18 players.
  while (draft.length < LEGACY_SQUAD_SIZE) {
    const pos = SHAPE[draft.length % SHAPE.length]!;
    let name: string;
    let guard = 0;
    do {
      name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
      guard++;
    } while (used.has(name) && guard < 60);
    used.add(name);
    const base = club.strength - (legacy ? 6 : 2) - Math.floor(rnd() * 9);
    draft.push({
      name,
      pos,
      age: clamp(19 + Math.floor(rnd() * 15), 17, 40),
      ovr: legacy ? clamp(Math.max(58, base), 40, 99) : clamp(base, 40, 94),
      named: false,
    });
  }

  ensureGoalkeepers(draft, rnd);
  if (!legacy) calibrateDraft(draft, club.strength);
  dedupeNames(draft);

  const gkIndexes = new Set<number>();
  draft.forEach((d, i) => {
    if (d.pos === "GK") gkIndexes.add(i);
  });
  const numbers = shirtNumbers(draft.length, gkIndexes);

  return appendReserves(
    club,
    draft.map((_, i) => makePlayer(club, draft, i, numbers[i]!, rnd)),
    SQUAD_SIZE,
  );
}

/** Append deterministic reserves without rewriting existing players or their numbers. */
export function completeSquad(clubId: string, existing: Player[], minimum = SQUAD_SIZE): Player[] {
  return appendReserves(safeClub(clubId), existing, minimum);
}

function appendReserves(club: Club, existing: Player[], minimum: number): Player[] {
  const clubId = club.id;
  const squad = [...existing];
  const rnd = makeRng(`squad-reserves-${clubId}`);
  const pool = poolForLeague(club.league);
  const ids = new Set(squad.map((p) => p.id));
  const names = new Set(squad.map((p) => p.name));
  const numbers = new Set(squad.map((p) => p.number));
  const targets: Record<Position, number> = { GK: 3, DF: 8, MF: 8, FW: 7 };
  let index = 0;
  while (squad.length < minimum || squad.filter((p) => p.pos === "GK").length < MIN_GOALKEEPERS) {
    const id = `${clubId}-reserve-${index++}`;
    if (ids.has(id)) continue;
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    squad.forEach((p) => counts[p.pos]++);
    const pos = (Object.keys(targets) as Position[]).sort(
      (a, b) => targets[b] - counts[b] - (targets[a] - counts[a]),
    )[0]!;
    let name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
    if (names.has(name)) name = `${name} ${index}`;
    const d: DraftPlayer = {
      name,
      pos,
      age: 18 + Math.floor(rnd() * 13),
      ovr: clamp(club.strength - 10 - Math.floor(rnd() * 9), 40, 85),
      named: false,
    };
    const number = Array.from({ length: 99 }, (_, i) => i + 1).find((n) => !numbers.has(n));
    if (!number) break;
    const player = { ...makePlayer(club, [d], 0, number, rnd), id };
    squad.push(player);
    ids.add(id);
    names.add(name);
    numbers.add(number);
  }
  return squad;
}
