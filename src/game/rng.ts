export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: number | string) {
  // Bitwise operations already use signed 32-bit integers. Keep that form
  // between draws and convert to unsigned only at the public boundaries.
  let s = (typeof seed === "string" ? hashSeed(seed) : seed >>> 0) | 0;
  if (s === 0) s = 0x9e3779b9 | 0;
  const next = () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  next.state = () => s >>> 0;
  next.restore = (state: number) => {
    if (!Number.isInteger(state) || state < 0 || state > 0xffffffff)
      throw new Error("Invalid PRNG state");
    s = state | 0;
  };
  return next;
}
