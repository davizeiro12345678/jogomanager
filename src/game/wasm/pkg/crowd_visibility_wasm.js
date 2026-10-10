/* @ts-self-types="./crowd_visibility_wasm.d.ts" */

/**
 * A worker owns this layout for its entire lifetime. Camera updates copy only
 * 27 doubles, instead of copying every seat and tile into WASM on every tick.
 */
export class CrowdSelector {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CrowdSelectorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_crowdselector_free(ptr, 0);
    }
    /**
     * @param {Float64Array} positions
     * @param {Float64Array} tiles
     * @param {Uint32Array} offsets
     * @param {Uint32Array} indices
     */
    constructor(positions, tiles, offsets, indices) {
        const ret = wasm.crowdselector_new(positions, tiles, offsets, indices);
        this.__wbg_ptr = ret;
        CrowdSelectorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float64Array} planes
     * @param {Float64Array} camera
     * @param {number} scale
     * @param {boolean} perspective
     * @param {number} max_tiles
     * @param {number} max_instances
     * @param {number} detailed_pixels
     * @param {number} mesh_pixels
     * @returns {Uint32Array}
     */
    select(planes, camera, scale, perspective, max_tiles, max_instances, detailed_pixels, mesh_pixels) {
        const ret = wasm.crowdselector_select(this.__wbg_ptr, planes, camera, scale, perspective, max_tiles, max_instances, detailed_pixels, mesh_pixels);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Copy into a JS-owned reusable output; no returned Vec or borrowed view.
     * Output capacity bounds the instance budget before selection.
     * @param {Float64Array} planes
     * @param {Float64Array} camera
     * @param {number} scale
     * @param {boolean} perspective
     * @param {number} max_tiles
     * @param {number} max_instances
     * @param {number} detailed_pixels
     * @param {number} mesh_pixels
     * @param {Uint32Array} output
     * @returns {number}
     */
    select_into(planes, camera, scale, perspective, max_tiles, max_instances, detailed_pixels, mesh_pixels, output) {
        const ret = wasm.crowdselector_select_into(this.__wbg_ptr, planes, camera, scale, perspective, max_tiles, max_instances, detailed_pixels, mesh_pixels, output);
        return ret >>> 0;
    }
}
if (Symbol.dispose) CrowdSelector.prototype[Symbol.dispose] = CrowdSelector.prototype.free;

/**
 * A seamless fibre normal tile and roughness tile, packed RGBA then RGBA.
 * Integer arithmetic keeps native Rust, WASM and the JS fallback byte-identical.
 * @param {number} size
 * @param {number} seed
 * @returns {Uint8Array}
 */
export function build_turf_detail(size, seed) {
    const ret = wasm.build_turf_detail(size, seed);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @returns {number}
 */
export function crowd_max_references() {
    const ret = wasm.crowd_max_references();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function crowd_max_seats() {
    const ret = wasm.crowd_max_seats();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function crowd_max_tiles() {
    const ret = wasm.crowd_max_tiles();
    return ret >>> 0;
}

/**
 * @param {number} x
 * @param {number} z
 * @param {Float64Array} receivers
 * @param {Float64Array} defenders
 * @returns {Float64Array}
 */
export function evaluate_pass_lanes(x, z, receivers, defenders) {
    const ret = wasm.evaluate_pass_lanes(x, z, receivers, defenders);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Writes complete records into JS-owned storage. No borrowed WASM-memory view
 * escapes, so memory.grow and later calls cannot invalidate the caller's data.
 * @param {number} x
 * @param {number} z
 * @param {Float64Array} receivers
 * @param {Float64Array} defenders
 * @param {Float64Array} output
 * @returns {number}
 */
export function evaluate_pass_lanes_into(x, z, receivers, defenders, output) {
    const ret = wasm.evaluate_pass_lanes_into(x, z, receivers, defenders, output);
    return ret >>> 0;
}

/**
 * Bounded presentation-only ABI: x,y,z,u,v, independent owned output.
 * @param {Float64Array} rings
 * @param {number} radial
 * @param {number} roundness
 * @param {number} caps
 * @returns {Float32Array}
 */
export function generate_rig_section(rings, radial, roundness, caps) {
    const ptr0 = passArrayF64ToWasm0(rings, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.generate_rig_section(ptr0, len0, radial, roundness, caps);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * Selects only presentation seats and their LOD tier. The surrounding game
 * keeps ownership of Three.js matrices, simulation, saves and replay state.
 * Each item is encoded as `seat << 2 | tier`, where tier is 0, 1 or 2.
 * @param {Float64Array} positions
 * @param {Float64Array} tiles
 * @param {Uint32Array} tile_offsets
 * @param {Uint32Array} tile_indices
 * @param {Float64Array} frustum_planes
 * @param {Float64Array} camera
 * @param {number} projected_scale
 * @param {boolean} perspective
 * @param {number} max_tiles
 * @param {number} max_instances
 * @param {number} detailed_pixels
 * @param {number} mesh_pixels
 * @returns {Uint32Array}
 */
export function select_crowd(positions, tiles, tile_offsets, tile_indices, frustum_planes, camera, projected_scale, perspective, max_tiles, max_instances, detailed_pixels, mesh_pixels) {
    const ret = wasm.select_crowd(positions, tiles, tile_offsets, tile_indices, frustum_planes, camera, projected_scale, perspective, max_tiles, max_instances, detailed_pixels, mesh_pixels);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * Major version of the flat-buffer contract. Additive exports do not change it.
 * @returns {number}
 */
export function wasm_abi_version() {
    const ret = wasm.wasm_abi_version();
    return ret >>> 0;
}

/**
 * Crowd=1, pass lanes=2, turf=4, persistent crowd=8, bounded crowd inputs=16,
 * reusable crowd output=32, bounded/reusable pass perception=64.
 * These capabilities do not confer authority over saves, scores or progression.
 * @returns {number}
 */
export function wasm_capabilities() {
    const ret = wasm.wasm_capabilities();
    return ret >>> 0;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_41e9ee4f547fc59a: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_length_511b1f84719d3462: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_b5f0008bbf60cf59: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_prototypesetcall_06eb15da165dee8f: function(arg0, arg1, arg2) {
            Uint32Array.prototype.set.call(getArrayU32FromWasm0(arg0, arg1), arg2);
        },
        __wbg_prototypesetcall_d49a4fab5ca427bc: function(arg0, arg1, arg2) {
            Float64Array.prototype.set.call(getArrayF64FromWasm0(arg0, arg1), arg2);
        },
        __wbg_set_448fbc824992c3fd: function(arg0, arg1, arg2) {
            arg0.set(getArrayU32FromWasm0(arg1, arg2));
        },
        __wbg_set_8b5ae6cfd49dec9f: function(arg0, arg1, arg2) {
            arg0.set(getArrayF64FromWasm0(arg1, arg2));
        },
        __wbg_subarray_bb23bc0b23af26d9: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_subarray_bc806d0bca615ffa: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./crowd_visibility_wasm_bg.js": import0,
    };
}

const CrowdSelectorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_crowdselector_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('crowd_visibility_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
