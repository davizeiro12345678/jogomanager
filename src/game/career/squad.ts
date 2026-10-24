import type { AttributeSource } from "../player-development";
import { valueFor, wageFor } from "../economy";

import { FORMATIONS } from "../formations";

import { makeRng } from "../rng";

import { selectionRating } from "../match-readiness";

import { buildSquad } from "../squad";

import type { FormationKey, Player, Position } from "../types";

/**
 * Ordem de improvisação por posição: um volante rende mais na zaga do que um
 * centroavante, e um ponta rende mais no meio do que um zagueiro no ataque.
 */
export const COVER_ORDER: Record<Position, Position[]> = {
  GK: ["GK"],
  DF: ["DF", "MF", "FW"],
  MF: ["MF", "DF", "FW"],
  FW: ["FW", "MF", "DF"],
};

export function pickLineup(players: Player[], formation: FormationKey, source?: AttributeSource) {
  // Formação desconhecida (save antigo, tática corrompida): cai no 4-3-3 em vez
  // de estourar e derrubar a tela inteira.
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  // Read readiness once per eligible athlete. Sorting used to recalculate
  // effective/normalized ratings twice for every comparator invocation.
  const available = players
    .filter((p) => !p.suspended && p.injuryWeeks === 0)
    .map((player) => ({ player, rating: selectionRating(player, source) }))
    .sort((a, b) => b.rating - a.rating || a.player.id.localeCompare(b.player.id))
    .map(({ player }) => player);
  const taken = new Set<string>();
  const picks: Player[] = new Array(slots.length).fill(undefined);

  // 1) Goleiro primeiro. A simulação procura `pos === "GK"` para defender o
  // chute: sem goleiro, todo chute é gol. Por isso a posição é preenchida
  // antes de qualquer outra e nunca por um jogador de linha enquanto houver
  // um goleiro disponível.
  const keepers = available.filter((p) => p.pos === "GK");
  let keeperCursor = 0;
  slots.forEach((slot, i) => {
    if (slot.pos !== "GK") return;
    const keeper = keepers[keeperCursor++];
    if (!keeper) return;
    taken.add(keeper.id);
    picks[i] = keeper;
  });

  // 2) Linha: posição exata, depois a ordem de improvisação mais parecida.
  // Goleiro nunca é gasto em vaga de linha.
  const cover = (pos: Position): Player | undefined => {
    for (const candidatePos of COVER_ORDER[pos] ?? ["DF", "MF", "FW"]) {
      const found = available.find((p) => !taken.has(p.id) && p.pos === candidatePos);
      if (found) return found;
    }
    return undefined;
  };
  slots.forEach((slot, i) => {
    if (slot.pos === "GK" || picks[i]) return;
    const found =
      cover(slot.pos) ??
      available.find((p) => !taken.has(p.id) && p.pos !== "GK") ??
      available.find((p) => !taken.has(p.id));
    if (!found) return;
    taken.add(found.id);
    picks[i] = found;
  });

  // 4) Elenco curto ou goleiros indisponíveis: completa as vagas que sobraram
  // com qualquer jogador livre, jogador de linha primeiro. É melhor um time com
  // 11 atletas (mesmo com um improviso no gol) do que um time com 10.
  slots.forEach((slot, i) => {
    if (picks[i]) return;
    const found =
      available.find((p) => !taken.has(p.id) && p.pos !== "GK") ??
      available.find((p) => !taken.has(p.id));
    if (!found) return;
    taken.add(found.id);
    picks[i] = found;
    void slot;
  });

  const lineup = picks.filter(Boolean).map((p) => p.id);

  // 3) Banco: melhores restantes, mas sempre com um goleiro. Sem reserva, uma
  // lesão na camisa 1 deixa o time sem ninguém na posição até o fim do jogo.
  const rest = available.filter((p) => !taken.has(p.id));
  const benchIds = rest.slice(0, 7).map((p) => p.id);
  if (!benchIds.some((id) => rest.find((p) => p.id === id)?.pos === "GK")) {
    const spareKeeper = rest.find((p) => p.pos === "GK");
    if (spareKeeper) {
      const weakestOutfield = [...benchIds].reverse().find((id) => {
        const p = rest.find((q) => q.id === id);
        return Boolean(p) && p!.pos !== "GK";
      });
      if (weakestOutfield) {
        benchIds.splice(benchIds.indexOf(weakestOutfield), 1);
        benchIds.unshift(spareKeeper.id);
      }
    }
  }
  return { lineup, bench: benchIds };
}

export const PERSONALITIES = [
  "líder",
  "profissional",
  "ambicioso",
  "temperamental",
  "caseiro",
  "determinado",
] as const;

/**
 * Elenco pronto para jogo: montado a partir do catálogo e já enriquecido com
 * salário, valor de mercado, potencial e personalidade. Sem esta etapa as telas
 * de partida rápida mostravam `€0` de valor e salário, porque `buildSquad`
 * entrega os campos zerados.
 */
export function buildReadySquad(clubId: string): Player[] {
  return buildSquad(clubId).map(enrichPlayer);
}

export function enrichPlayer(p: Player): Player {
  const rnd = makeRng(`pl-${p.id}`);
  return {
    ...p,
    wage: p.wage > 0 ? p.wage : wageFor(p.ovr),
    value: p.value > 0 ? p.value : valueFor(p.ovr, p.age),
    yellows: p.yellows ?? 0,
    suspended: p.suspended ?? false,
    injuryWeeks: p.injuryWeeks ?? 0,
    potential:
      p.potential ??
      Math.min(
        99,
        p.ovr +
          (p.age <= 20
            ? 6 + Math.floor(rnd() * 8)
            : p.age <= 24
              ? 3 + Math.floor(rnd() * 6)
              : Math.floor(rnd() * 3)),
      ),
    personality: p.personality ?? PERSONALITIES[Math.floor(rnd() * PERSONALITIES.length)]!,
    form: p.form ?? Math.round((p.morale + p.condition) / 2),
    contractYears: p.contractYears ?? 1 + Math.floor(rnd() * 4),
    releaseClause:
      p.releaseClause ?? Math.round(valueFor(p.ovr, p.age) * (1.8 + rnd() * 1.4) * 10) / 10,
    unhappy: p.unhappy ?? false,
  };
}
