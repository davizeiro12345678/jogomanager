import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// The pinned compat package embeds the exact binary it also ships as a file.
// Keep its official bindings/init, but let workers fetch the immutable binary
// without parsing a 2 MB string and decoding base64 on every cold match start.
export function externalizeRapierWasm(code: string, wasm: Uint8Array, wasmUrl: string): string {
  const embedded = /[\w$]+\.toByteArray\("(AGFzbQ[A-Za-z0-9+/=]+)"\)\.buffer/g;
  const matches = [...code.matchAll(embedded)];
  if (matches.length !== 1 || !Buffer.from(matches[0]![1]!, "base64").equals(Buffer.from(wasm))) {
    throw new Error(
      "Rapier WASM changed: verify the official binary and init before updating the bundle adapter.",
    );
  }
  const match = matches[0]!;
  // This expression is inside the package's async-init generator. Its existing
  // outer yield still waits for wasm-bindgen initialization and propagates errors.
  return (
    code.slice(0, match.index) +
    "(yield __pfmRapierWasm())" +
    code.slice(match.index! + match[0].length) +
    `\nasync function __pfmRapierWasm(){const response=await fetch(${wasmUrl});if(!response.ok)throw new Error("Rapier WASM failed: "+response.status);return response.arrayBuffer();}\n`
  );
}

/**
 * Vite passes an absolute module path to `transform`. Rapier 0.21 keeps the
 * ESM entry inside `dist/`; accepting the former root layout too keeps this
 * adapter explicit about the only supported upstream path change.
 */
export function isRapierCompatModule(id: string): boolean {
  const normalized = id.replaceAll("\\", "/").split("?")[0]!;
  return /\/@dimforge\/rapier3d-compat\/(?:dist\/)?rapier\.mjs$/.test(normalized);
}

/** Worker-build only: server physics and development retain the package API. */
export function rapierWasmAsset(): Plugin {
  return {
    name: "pfm-rapier-wasm-asset",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (!isRapierCompatModule(id)) return null;
      const modulePath = id.split("?")[0]!;
      const wasm = readFileSync(path.join(path.dirname(modulePath), "rapier_wasm3d_bg.wasm"));
      const reference = this.emitFile({
        type: "asset",
        name: "rapier_wasm3d_bg.wasm",
        source: wasm,
      });
      return {
        code: externalizeRapierWasm(code, wasm, `import.meta.ROLLUP_FILE_URL_${reference}`),
        map: null,
      };
    },
  };
}
