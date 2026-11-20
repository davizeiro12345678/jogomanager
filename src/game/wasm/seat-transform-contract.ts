export const SEAT_ARENA_HEADER_BYTES = 64;
export const SEAT_ARENA_BYTES_PER_SEAT = 168;
export const SEAT_ARENA_MAX_BYTES = 512 * 65536;
export const MAX_SHARED_SEATS = Math.floor(
  (SEAT_ARENA_MAX_BYTES - SEAT_ARENA_HEADER_BYTES) / SEAT_ARENA_BYTES_PER_SEAT,
);

export type SeatTransformRequest = {
  module: WebAssembly.Module;
  memory: WebAssembly.Memory;
  lane: number;
  lanes: 2 | 4;
  args: [number, number, number, number, number, number, number];
};

/** Each worker owns one disjoint slice of a fixed shared arena.
 * The worker count is pinned in every request and checked before WASM writes. */
export function validSeatTransformRequest(value: unknown): value is SeatTransformRequest {
  if (!value || typeof value !== "object" || typeof SharedArrayBuffer === "undefined") return false;
  const request = value as Partial<SeatTransformRequest>;
  if (
    !(request.module instanceof WebAssembly.Module) ||
    !(request.memory instanceof WebAssembly.Memory) ||
    (request.lanes !== 2 && request.lanes !== 4) ||
    typeof request.lane !== "number" ||
    !Number.isInteger(request.lane) ||
    request.lane < 0 ||
    request.lane >= request.lanes ||
    !Array.isArray(request.args) ||
    request.args.length !== 7 ||
    request.args.some((arg) => !Number.isSafeInteger(arg) || arg < 0)
  )
    return false;
  // TypeScript declares Memory.buffer as ArrayBuffer even for shared WASM
  // memories. Narrow its actual runtime value without intersecting the two
  // incompatible Symbol.toStringTag literal types into `never`.
  const arena: unknown = request.memory.buffer;
  if (!(arena instanceof SharedArrayBuffer)) return false;
  const [start, end, inputs, matrices, colors, skins, styles] = request.args;
  const count = (matrices - SEAT_ARENA_HEADER_BYTES) / 72;
  const bytes = styles + count * 8;
  return (
    Number.isInteger(count) &&
    count > 0 &&
    count <= MAX_SHARED_SEATS &&
    inputs === SEAT_ARENA_HEADER_BYTES &&
    colors === matrices + count * 64 &&
    skins === colors + count * 12 &&
    styles === skins + count * 12 &&
    start === Math.floor((count * request.lane) / request.lanes) &&
    end === Math.floor((count * (request.lane + 1)) / request.lanes) &&
    start < end &&
    bytes <= arena.byteLength &&
    arena.byteLength <= SEAT_ARENA_MAX_BYTES
  );
}
