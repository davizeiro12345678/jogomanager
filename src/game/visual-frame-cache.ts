import type { SimView } from "./sim";
import type { VersionedVisualData } from "./visual-context";

type CacheEntry = {
  time: number;
  playerCount: number;
  data: VersionedVisualData | undefined;
};

const frameCache = new WeakMap<object, CacheEntry>();

/**
 * Compartilha o contexto visual de um snapshot entre câmera e todos os atletas.
 * O Worker mantém a mesma instância de SimView e avança `time`; portanto a chave
 * evita gerar os mesmos 44 contextos até 22 vezes no mesmo quadro.
 */
export function visualDataFor(sim: SimView): VersionedVisualData | undefined {
  const key = sim as object;
  const cached = frameCache.get(key);
  if (cached && cached.time === sim.time && cached.playerCount === sim.players.length) {
    return cached.data;
  }
  const data = sim.generateVisualContext?.();
  frameCache.set(key, { time: sim.time, playerCount: sim.players.length, data });
  return data;
}