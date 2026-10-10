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
  args: [number, number, number, number, number, number, number];
};

/** Each worker owns one exact half of a fixed non-overlapping shared arena.
 * Validate the envelope before instantiation or passing i32 offsets to WASM. */
export function validSeatTransformRequest(value: unknown): value is SeatTransformRequest {
  if (!value || typeof value !== "object" || typeof SharedArrayBuffer === "undefined") return false;
  const request = value as Partial<SeatTransformRequest>;
  if (
    !(request.module instanceof WebAssembly.Module) ||
    !(request.memory instanceof WebAssembly.Memory) ||
    (request.lane !== 0 && request.lane !== 1) ||
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
    start === Math.floor((count * request.lane) / 2) &&
    end === Math.floor((count * (request.lane + 1)) / 2) &&
    bytes <= arena.byteLength &&
    arena.byteLength <= SEAT_ARENA_MAX_BYTES
  );
}
