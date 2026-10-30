export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Sum the first three draws of a string-seeded stream without checkpoint methods. */
export function sumThreeRng(seed: string): number {
  let state = hashSeed(seed) || 0x9e3779b9;
  let total = 0;
  let remaining = 3;
  while (remaining--) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    total += (state >>> 0) / 4294967296;
  }
  return total;
}

export function makeRng(seed: number | string) {
  // Bitwise operations already use signed 32-bit integers. Keep that form
  // between draws and convert to unsigned only at the public boundaries.
  let s = (typeof seed === "string" ? hashSeed(seed) : seed >>> 0) || 0x9e3779b9;
  const next = () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  next.state = () => s >>> 0;
  next.restore = (state: number) => {
    if (!Number.isInteger(state) || state !== state >>> 0) throw new Error("Invalid PRNG state");
    s = state;
  };
  return next;
}
