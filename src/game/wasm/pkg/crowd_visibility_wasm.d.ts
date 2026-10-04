/* tslint:disable */
/* eslint-disable */

export function evaluate_pass_lanes(x: number, z: number, receivers: Float64Array, defenders: Float64Array): Float64Array;

/**
 * Selects only presentation seats and their LOD tier. The surrounding game
 * keeps ownership of Three.js matrices, simulation, saves and replay state.
 * Each item is encoded as `seat << 2 | tier`, where tier is 0, 1 or 2.
 */
export function select_crowd(positions: Float64Array, tiles: Float64Array, tile_offsets: Uint32Array, tile_indices: Uint32Array, frustum_planes: Float64Array, camera: Float64Array, projected_scale: number, perspective: boolean, max_tiles: number, max_instances: number, detailed_pixels: number, mesh_pixels: number): Uint32Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly evaluate_pass_lanes: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly select_crowd: (a: any, b: any, c: any, d: any, e: any, f: any, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
