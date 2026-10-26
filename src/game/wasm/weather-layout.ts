import { loadGameWasm, WASM_CAPABILITY } from "./runtime.ts";

export const MAX_WEATHER_INSTANCES = 8192;
export const WEATHER_STRIDE = 5;
const f32 = Math.fround;
function hash(index: number, seed: number): number {
  let value = Math.imul(index, 0x1f123bb5) ^ seed;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

/** Same f32 operations as Rust; requires no WebAssembly or browser APIs. */
export function buildWeatherLayout(count: number, seed: number): Float32Array {
  if (!Number.isInteger(count) || count < 0 || count > MAX_WEATHER_INSTANCES)
    return new Float32Array();
  const values = new Float32Array(count * WEATHER_STRIDE);
  for (let index = 0; index < count; index++) {
    const offset = index * WEATHER_STRIDE;
    const unit = (channel: number) => (hash(offset + channel, seed >>> 0) & 0xffffff) / 16777216;
    values[offset] = f32(f32(f32(unit(0) * 2) - 1) * 78.5);
    values[offset + 1] = f32(unit(1) * 36);
    values[offset + 2] = f32(f32(f32(unit(2) * 2) - 1) * 58);
    values[offset + 3] = f32(f32(0.6) + f32(unit(3) * f32(0.9)));
    values[offset + 4] = f32(unit(4) * f32(Math.PI * 2));
  }
  return values;
}

export async function loadWeatherLayout(count: number, seed: number): Promise<Float32Array | null> {
  if (
    typeof window === "undefined" ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > MAX_WEATHER_INSTANCES
  )
    return null;
  const module = await loadGameWasm(WASM_CAPABILITY.weatherFloat32);
  if (!module) return null;
  try {
    const values = module.build_weather_instances(count, seed >>> 0);
    return values.length === count * WEATHER_STRIDE && values.every(Number.isFinite)
      ? values
      : null;
  } catch {
    return null;
  }
}
