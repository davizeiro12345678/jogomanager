function hash(x: number, y: number, seed: number) {
  let v = (Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ seed) >>> 0;
  v = (v ^ (v >>> 16)) >>> 0;
  v = Math.imul(v, 0x45d9f3b) >>> 0;
  return (v ^ (v >>> 16)) >>> 0;
}

export function buildTurfDetail(size: number, seed: number): Uint8Array {
  if (!Number.isInteger(size) || size < 32 || size > 1024 || size & (size - 1))
    return new Uint8Array();
  const pixels = size * size;
  const out = new Uint8Array(pixels * 8);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const h = hash(x, y, seed),
        fibre = hash(x >>> 1, y >>> 3, seed ^ 0x71b2);
      const dx = Math.trunc(((fibre & 63) - 31) / 2) + (h & 15) - 7;
      const dy = Math.trunc((((fibre >>> 8) & 63) - 31) / 2) + ((h >>> 8) & 15) - 7;
      const i = (y * size + x) * 4;
      out[i] = 128 + dx;
      out[i + 1] = 128 + dy;
      out[i + 2] = 255 - Math.trunc((dx * dx + dy * dy) / 255);
      out[i + 3] = 255;
      const r = 190 + ((h >>> 20) & 31) + ((fibre >>> 16) & 15),
        j = pixels * 4 + i;
      out[j] = out[j + 1] = out[j + 2] = r;
      out[j + 3] = 255;
    }
  return out;
}
