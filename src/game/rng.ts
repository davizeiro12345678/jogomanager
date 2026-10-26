export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: number | string) {
  let s = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  const next = () => {
    s ^= s << 13;
    // Every bitwise operator already coerces its input to a signed int32.
    // Keep that representation between draws; only the public value/state
    // needs the unsigned conversion. The arithmetic right shift is intentional.
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  next.state = () => s >>> 0;
  next.restore = (state: number) => {
    if (!Number.isInteger(state) || state < 0 || state > 0xffffffff)
      throw new Error("Invalid PRNG state");
    s = state >>> 0;
  };
  return next;
}

/** Consume a short, independent stream when no live/restorable RNG is needed.
 * Used for match-day form, which only needs the sum of its three draws. */
export function sumRngDraws(seed: number | string, count: number): number {
  let s = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  let total = 0;
  for (let i = 0; i < count; i++) {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    total += (s >>> 0) / 4294967296;
  }
  return total;
}
