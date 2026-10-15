/* tslint:disable */
/* eslint-disable */

/**
 * A worker owns this layout for its entire lifetime. Camera updates copy only
 * 27 doubles, instead of copying every seat and tile into WASM on every tick.
 */
export class CrowdSelector {
    free(): void;
    [Symbol.dispose](): void;
    constructor(positions: Float64Array, tiles: Float64Array, offsets: Uint32Array, indices: Uint32Array);
    select(planes: Float64Array, camera: Float64Array, scale: number, perspective: boolean, max_tiles: number, max_instances: number, detailed_pixels: number, mesh_pixels: number): Uint32Array;
    /**
     * Copy into a JS-owned reusable output; no returned Vec or borrowed view.
     * Output capacity bounds the instance budget before selection.
     */
    select_into(planes: Float64Array, camera: Float64Array, scale: number, perspective: boolean, max_tiles: number, max_instances: number, detailed_pixels: number, mesh_pixels: number, output: Uint32Array): number;
}

/**
 * A seamless fibre normal tile and roughness tile, packed RGBA then RGBA.
 * Integer arithmetic keeps native Rust, WASM and the JS fallback byte-identical.
 */
export function build_turf_detail(size: number, seed: number): Uint8Array;

export function crowd_max_references(): number;

export function crowd_max_seats(): number;

export function crowd_max_tiles(): number;

export function evaluate_pass_lanes(x: number, z: number, receivers: Float64Array, defenders: Float64Array): Float64Array;

/**
 * Writes complete records into JS-owned storage. No borrowed WASM-memory view
 * escapes, so memory.grow and later calls cannot invalidate the caller's data.
 */
export function evaluate_pass_lanes_into(x: number, z: number, receivers: Float64Array, defenders: Float64Array, output: Float64Array): number;

/**
 * Bounded presentation-only ABI: x,y,z,u,v, independent owned output.
 */
export function generate_rig_section(rings: Float64Array, radial: number, roundness: number, caps: number): Float32Array;

/**
 * Selects only presentation seats and their LOD tier. The surrounding game
 * keeps ownership of Three.js matrices, simulation, saves and replay state.
 * Each item is encoded as `seat << 2 | tier`, where tier is 0, 1 or 2.
 */
export function select_crowd(positions: Float64Array, tiles: Float64Array, tile_offsets: Uint32Array, tile_indices: Uint32Array, frustum_planes: Float64Array, camera: Float64Array, projected_scale: number, perspective: boolean, max_tiles: number, max_instances: number, detailed_pixels: number, mesh_pixels: number): Uint32Array;

/**
 * Major version of the flat-buffer contract. Additive exports do not change it.
 */
export function wasm_abi_version(): number;

/**
 * Crowd=1, pass lanes=2, turf=4, persistent crowd=8, bounded crowd inputs=16,
 * reusable crowd output=32, bounded/reusable pass perception=64.
 * These capabilities do not confer authority over saves, scores or progression.
 */
export function wasm_capabilities(): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_crowdselector_free: (a: number, b: number) => void;
    readonly build_turf_detail: (a: number, b: number) => [number, number];
    readonly crowd_max_references: () => number;
    readonly crowd_max_seats: () => number;
    readonly crowd_max_tiles: () => number;
    readonly crowdselector_new: (a: any, b: any, c: any, d: any) => number;
    readonly crowdselector_select: (a: number, b: any, c: any, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly crowdselector_select_into: (a: number, b: any, c: any, d: number, e: number, f: number, g: number, h: number, i: number, j: any) => number;
    readonly evaluate_pass_lanes: (a: number, b: number, c: any, d: any) => [number, number];
    readonly evaluate_pass_lanes_into: (a: number, b: number, c: any, d: any, e: any) => number;
    readonly generate_rig_section: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly select_crowd: (a: any, b: any, c: any, d: any, e: any, f: any, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
    readonly wasm_abi_version: () => number;
    readonly wasm_capabilities: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
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
