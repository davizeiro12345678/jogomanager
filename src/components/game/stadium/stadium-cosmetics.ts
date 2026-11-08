import { FIELD_X, FIELD_Z } from "@/game/sim-rules";

/**
 * Randomness used only by stadium presentation. It is intentionally local to
 * the renderer: no MatchSim PRNG state is read or advanced here.
 */
export type StadiumCosmeticSeedPart = string | number;

export const DEFAULT_STADIUM_FIXTURE = "stadium:default-fixture";
export const WEATHER_POOL_CAPACITY = 2600;

export type WeatherDrop = {
  index: number;
  x: number;
  y: number;
  z: number;
  s: number;
  p: number;
  cycle: number;
};

function hashSeed(parts: readonly StadiumCosmeticSeedPart[]): number {
  let state = 0x811c9dc5;
  for (const part of parts) {
    const value = String(part);
    for (let index = 0; index < value.length; index++) {
      state ^= value.charCodeAt(index);
      state = Math.imul(state, 0x01000193);
    }
    state ^= 0x7c;
    state = Math.imul(state, 0x01000193);
  }
  return state >>> 0 || 0x9e3779b9;
}

/**
 * Creates an independent stream for one visual subsystem, fixture and beat.
 * Each stream can be recreated from its key, so a remount or a lower visible
 * count never changes the values already assigned to the pool.
 */
export function createStadiumCosmeticRng(
  fixtureKey: string = DEFAULT_STADIUM_FIXTURE,
  channel: string,
  ...parts: StadiumCosmeticSeedPart[]
): () => number {
  let state = hashSeed(["stadium-cosmetic", fixtureKey, channel, ...parts]);
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/** Stable presentation identity for a home/away fixture. */
export function stadiumFixtureKey(homeId: string, awayId: string): string {
  return `${homeId}|${awayId}`;
}

export function createWeatherDrops(
  fixtureKey: string = DEFAULT_STADIUM_FIXTURE,
  capacity = WEATHER_POOL_CAPACITY,
): WeatherDrop[] {
  return Array.from({ length: capacity }, (_, index) => {
    const rand = createStadiumCosmeticRng(fixtureKey, "weather-drop", index, 0);
    return {
      index,
      x: (rand() * 2 - 1) * (FIELD_X + 26),
      y: rand() * 34,
      z: (rand() * 2 - 1) * (FIELD_Z + 24),
      s: 0.6 + rand() * 0.9,
      p: rand() * 6.28,
      cycle: 0,
    };
  });
}

/** Keep a requested visible count inside a preallocated visual pool. */
export function poolVisibleCount(requested: number, capacity: number): number {
  return Math.max(0, Math.min(capacity, Math.floor(requested)));
}
