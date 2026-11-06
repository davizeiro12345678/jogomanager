import { FORMATIONS } from "./formations";
import { selectionRating } from "./match-readiness";
import type { AttributeSource } from "./player-development";
import type { Player, Position, FormationKey } from "./types";

/**
 * Ordem de improvisação por posição: um volante rende mais na zaga do que um
 * centroavante, e um ponta rende mais no meio do que um zagueiro no ataque.
 */
const COVER_ORDER: Record<Position, Position[]> = {
  GK: ["GK"],
  DF: ["DF", "MF", "FW"],
  MF: ["MF", "DF", "FW"],
  FW: ["FW", "MF", "DF"],
};

export function pickLineup(players: Player[], formation: FormationKey, source?: AttributeSource) {
  // Formação desconhecida (save antigo, tática corrompida): cai no 4-3-3 em vez
  // de estourar e derrubar a tela inteira.
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const available = [...players]
    .filter((p) => !p.suspended && p.injuryWeeks === 0)
    .sort(
      (a, b) => selectionRating(b, source) - selectionRating(a, source) || a.id.localeCompare(b.id),
    );
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
        return p !== undefined && p.pos !== "GK";
      });
      if (weakestOutfield) {
        benchIds.splice(benchIds.indexOf(weakestOutfield), 1);
        benchIds.unshift(spareKeeper.id);
      }
    }
  }
  return { lineup, bench: benchIds };
}
