import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { transformWithOxc, type Plugin } from "vite";
import { rapierSourceModules, sharedRapierBindings } from "./rapier-source-modules.ts";

// The pinned compat package embeds the exact binary it also ships as a file.
// Keep its official bindings/init, but let browsers and workers fetch the
// immutable binary without parsing a large base64 string on each cold start.
export function externalizeRapierWasm(code: string, wasm: Uint8Array, wasmUrl: string): string {
  const embedded = /[\w$]+\.toByteArray\("(AGFzbQ[A-Za-z0-9+/=]+)"\)\.buffer/g;
  const matches = [...code.matchAll(embedded)];
  if (matches.length !== 1 || !Buffer.from(matches[0]![1]!, "base64").equals(Buffer.from(wasm))) {
    throw new Error(
      "Rapier WASM changed: verify the official binary and init before updating the bundle adapter.",
    );
  }
  const match = matches[0]!;
  // The package builds its default namespace by freezing a fresh local object.
  // Named imports do not use that namespace, but an unannotated call keeps all
  // its otherwise unused classes live. This standard PURE hint lets the
  // bundler discard only the unused construction; default imports still get
  // the complete, frozen official API. No class methods or bindings are cut.
  const namespace = "Object.freeze({__proto__:null";
  if (code.split(namespace).length !== 2) {
    throw new Error(
      "Rapier namespace changed: verify its construction before updating the adapter.",
    );
  }
  // This expression is inside the package's async-init generator. Its existing
  // outer yield still waits for wasm-bindgen initialization and propagates errors.
  return (
    code.slice(0, match.index) +
    "(yield __pfmRapierWasm())" +
    code.slice(match.index! + match[0].length) +
    `\nasync function __pfmRapierWasm(){const response=await fetch(${wasmUrl});if(!response.ok)throw new Error("Rapier WASM failed: "+response.status);return response.arrayBuffer();}\n`
  ).replace(namespace, `/* @__PURE__ */ ${namespace}`);
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

/** Browser builds only: server physics and development retain their original init. */
export function rapierWasmAsset(options: { clientOnly?: boolean } = {}): Plugin {
  const prefix = "\0pfm-rapier-source/";
  const modulePath = createRequire(import.meta.url)
    .resolve("@dimforge/rapier3d-compat")
    .replace(/rapier\.cjs$/, "rapier.mjs");
  let modules: Map<string, string>;
  let bindingsUrl: string;
  return {
    name: "pfm-rapier-wasm-asset",
    apply: "build",
    applyToEnvironment: (environment) =>
      environment.config.consumer === "client" &&
      (!options.clientOnly || environment.name === "client"),
    enforce: "pre",
    async buildStart() {
      const code = readFileSync(modulePath, "utf8");
      const wasm = readFileSync(path.join(path.dirname(modulePath), "rapier_wasm3d_bg.wasm"));
      // Fail closed if upstream changes its embedded binary or namespace.
      externalizeRapierWasm(code, wasm, '"validation-only"');
      const reference = this.emitFile({
        type: "asset",
        name: "rapier_wasm3d_bg.wasm",
        source: wasm,
      });
      modules = rapierSourceModules(modulePath, `import.meta.ROLLUP_FILE_URL_${reference}`);
      const bindings = await sharedRapierBindings(modulePath);
      const assets = this.environment.config.build.assetsDir;
      const fileName = `${assets}/${bindings.fileName}`;
      this.emitFile({ type: "asset", fileName, source: bindings.code });
      bindingsUrl = `${this.environment.config.base}${fileName}`;
    },
    resolveId(id, importer) {
      if (id === "@dimforge/rapier3d-compat" || isRapierCompatModule(id))
        return `${prefix}index.ts`;
      if (!importer?.startsWith(prefix) || !id.startsWith(".")) return null;
      const relative = path.posix.normalize(
        path.posix.join(path.posix.dirname(importer.slice(prefix.length)), id),
      );
      if (relative === "rapier_wasm3d.js") return { id: bindingsUrl, external: "absolute" };
      for (const candidate of [relative, `${relative}.ts`, `${relative}/index.ts`]) {
        if (modules.has(candidate)) return `${prefix}${candidate}`;
      }
      throw new Error(`Unresolved official Rapier module: ${relative}`);
    },
    async load(id) {
      if (!id.startsWith(prefix)) return null;
      const relative = id.slice(prefix.length);
      const source = modules.get(relative);
      if (!source) throw new Error(`Missing official Rapier module: ${relative}`);
      return transformWithOxc(source, relative, { lang: "ts", target: "es2022" });
    },
  };
}
