/** Batched spatial perception. Rules and seeded decisions remain in MatchSim. */
import { loadGameWasm, WASM_CAPABILITY } from "./runtime";
export type PassLaneKernel = (
  x: number,
  z: number,
  receivers: Float64Array,
  defenders: Float64Array,
) => Float64Array;
export type PassLaneIntoKernel = (
  x: number,
  z: number,
  receivers: Float64Array,
  defenders: Float64Array,
  output: Float64Array,
) => number;

export const MAX_PASS_LANE_PLAYERS = 64;
const MAX_SPATIAL_VALUE = 1_000_000;

const finite = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(-MAX_SPATIAL_VALUE, Math.min(MAX_SPATIAL_VALUE, value))
    : 0;
const quantize = (value: number) => Math.round(value * 1e9) / 1e9;

/** Buffers contain x,z,vx,vz. Output contains distance, cover, interception risk. */
export const evaluatePassLanesFallback: PassLaneKernel = (x, z, receivers, defenders) => {
  const count = Math.min(MAX_PASS_LANE_PLAYERS, Math.floor(receivers.length / 4));
  const output = new Float64Array(count * 3);
  evaluatePassLanesIntoFallback(x, z, receivers, defenders, output);
  return output;
};

/** Writes complete records only. Existing callers keep independent output;
 * per-match callers can explicitly own and reuse their output allocation. */
export const evaluatePassLanesIntoFallback: PassLaneIntoKernel = (
  x,
  z,
  receivers,
  defenders,
  output,
) => {
  x = finite(x);
  z = finite(z);
  const count = Math.min(
    MAX_PASS_LANE_PLAYERS,
    Math.floor(receivers.length / 4),
    Math.floor(output.length / 3),
  );
  const defenderCount = Math.min(MAX_PASS_LANE_PLAYERS, Math.floor(defenders.length / 4));
  for (let i = 0; i < count; i++) {
    const rx = finite(receivers[i * 4]),
      rz = finite(receivers[i * 4 + 1]);
    const dx = rx - x,
      dz = rz - z;
    const lengthSquared = dx * dx + dz * dz;
    const distance = Math.sqrt(lengthSquared);
    const flight = distance / Math.min(31, 10 + distance * 0.8);
    let coverSquared = 10000,
      risk = 0;
    for (let j = 0; j < defenderCount; j++) {
      const ox = finite(defenders[j * 4]),
        oz = finite(defenders[j * 4 + 1]);
      const cx = rx - ox,
        cz = rz - oz;
      coverSquared = Math.min(coverSquared, cx * cx + cz * cz);
      const t = Math.max(0, Math.min(1, ((ox - x) * dx + (oz - z) * dz) / (lengthSquared || 1)));
      const lx = x + dx * t,
        lz = z + dz * t;
      const ax = ox - lx,
        az = oz - lz;
      const px = ax + Math.max(-1.5, Math.min(1.5, finite(defenders[j * 4 + 2]) * flight * t));
      const pz = az + Math.max(-1.5, Math.min(1.5, finite(defenders[j * 4 + 3]) * flight * t));
      const laneSquared = Math.min(ax * ax + az * az, px * px + pz * pz);
      if (laneSquared < 2.2 * 2.2) risk += (2.2 - Math.sqrt(laneSquared)) * 2.8;
    }
    const offset = i * 3;
    output[offset] = quantize(distance);
    output[offset + 1] = quantize(Math.sqrt(coverSquared));
    output[offset + 2] = quantize(risk);
  }
  return count * 3;
};

let loading: Promise<PassLaneKernel | null> | undefined;
let intoLoading: Promise<PassLaneIntoKernel | null> | undefined;
export function loadPassLaneIntoKernel(): Promise<PassLaneIntoKernel | null> {
  intoLoading ??= loadGameWasm(WASM_CAPABILITY.perception | WASM_CAPABILITY.boundedPerception).then(
    (module) =>
      module && typeof module.evaluate_pass_lanes_into === "function"
        ? (module.evaluate_pass_lanes_into as PassLaneIntoKernel)
        : null,
  );
  return intoLoading;
}
export function loadPassLaneKernel(): Promise<PassLaneKernel | null> {
  loading ??= loadGameWasm(WASM_CAPABILITY.perception | WASM_CAPABILITY.boundedPerception).then(
    (module) =>
      module && typeof module.evaluate_pass_lanes === "function"
        ? (module.evaluate_pass_lanes as PassLaneKernel)
        : null,
  );
  return loading;
}
