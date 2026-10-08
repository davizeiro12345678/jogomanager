/** Batched spatial perception. Rules and seeded decisions remain in MatchSim. */
import { loadGameWasm, WASM_CAPABILITY } from "./runtime.ts";
export type PassLaneKernel = (
  x: number,
  z: number,
  receivers: Float64Array,
  defenders: Float64Array,
) => Float64Array;

const finite = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const quantize = (value: number) => Math.round(value * 1e9) / 1e9;

/** Buffers contain x,z,vx,vz. Output contains distance, cover, interception risk. */
export const evaluatePassLanesFallback: PassLaneKernel = (x, z, receivers, defenders) => {
  x = finite(x);
  z = finite(z);
  const count = Math.min(64, Math.floor(receivers.length / 4));
  const defenderCount = Math.min(64, Math.floor(defenders.length / 4));
  const output = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    const rx = finite(receivers[i * 4]),
      rz = finite(receivers[i * 4 + 1]);
    const dx = rx - x,
      dz = rz - z;
    const lengthSquared = dx * dx + dz * dz;
    const distance = Math.sqrt(lengthSquared);
    const flight = distance / Math.min(31, 10 + distance * 0.8);
    let cover = 100,
      risk = 0;
    for (let j = 0; j < defenderCount; j++) {
      const ox = finite(defenders[j * 4]),
        oz = finite(defenders[j * 4 + 1]);
      const cx = rx - ox,
        cz = rz - oz;
      cover = Math.min(cover, Math.sqrt(cx * cx + cz * cz));
      const t = Math.max(0, Math.min(1, ((ox - x) * dx + (oz - z) * dz) / (lengthSquared || 1)));
      const lx = x + dx * t,
        lz = z + dz * t;
      const ax = ox - lx,
        az = oz - lz;
      const px = ax + Math.max(-1.5, Math.min(1.5, finite(defenders[j * 4 + 2]) * flight * t));
      const pz = az + Math.max(-1.5, Math.min(1.5, finite(defenders[j * 4 + 3]) * flight * t));
      const laneDistance = Math.min(Math.sqrt(ax * ax + az * az), Math.sqrt(px * px + pz * pz));
      if (laneDistance < 2.2) risk += (2.2 - laneDistance) * 2.8;
    }
    const offset = i * 3;
    output[offset] = quantize(distance);
    output[offset + 1] = quantize(cover);
    output[offset + 2] = quantize(risk);
  }
  return output;
};

let loading: Promise<PassLaneKernel | null> | undefined;
export function loadPassLaneKernel(): Promise<PassLaneKernel | null> {
  loading ??= loadGameWasm(WASM_CAPABILITY.perception).then((module) =>
    module ? (module.evaluate_pass_lanes as PassLaneKernel) : null,
  );
  return loading;
}
