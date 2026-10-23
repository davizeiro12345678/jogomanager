import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { rolldown } from "rolldown";

/** Restore the official module boundaries included in the pinned npm source map.
 * The generated WASM glue is shared by the document and module workers, while
 * each entry can still tree-shake its own high-level API. No physics is removed.
 */
export function rapierSourceModules(modulePath: string, wasmUrl: string) {
  const directory = path.dirname(modulePath);
  const manifest = JSON.parse(readFileSync(path.join(directory, "../package.json"), "utf8"));
  if (manifest.version !== "0.21.0")
    throw new Error("Review Rapier source modules before upgrading");
  const map = JSON.parse(readFileSync(`${modulePath}.map`, "utf8")) as {
    sources: string[];
    sourcesContent: string[];
  };
  const modules = new Map<string, string>();
  for (const [index, source] of map.sources.entries()) {
    const relative = source.split("/gen3d/")[1];
    if (relative && !relative.includes("..")) modules.set(relative, map.sourcesContent[index]!);
  }
  if (modules.size !== 36 || !modules.has("pipeline/world.ts")) {
    throw new Error("Rapier source map changed: review the official module graph");
  }
  // Source maps omit type-only modules and re-export barrels. The package's
  // declaration barrels preserve their official export lists; other missing
  // declarations have no runtime code in the shipped source map.
  function visit(directoryPath: string) {
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      const file = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith(".d.ts")) {
        const relative = path
          .relative(directory, file)
          .replaceAll("\\", "/")
          .replace(/\.d\.ts$/, ".ts");
        if (!modules.has(relative)) {
          const exports = readFileSync(file, "utf8")
            .split("\n")
            .filter((line) => line.startsWith("export * from"));
          modules.set(relative, exports.join("\n") || "export {};");
        }
      }
    }
  }
  visit(directory);
  modules.set("raw.ts", 'export * from "./rapier_wasm3d.js";');
  modules.set(
    "init.ts",
    `import wasmInit from "./rapier_wasm3d.js";
    export async function init(){
      const response=await fetch(${wasmUrl});
      if(!response.ok)throw new Error("Rapier WASM failed: "+response.status);
      await wasmInit({module_or_path:await response.arrayBuffer()});
    }`,
  );
  // An object spread over an ESM namespace invokes every getter and keeps the
  // entire API live even when the default export is unused. An explicit plain
  // namespace preserves the official API and can be discarded for named imports.
  const bundleSource = readFileSync(modulePath, "utf8");
  const exports = [...bundleSource.matchAll(/export\s*\{([^}]+)\}/g)].at(-1)?.[1];
  if (!exports) throw new Error("Missing official Rapier export list");
  const names = exports
    .split(",")
    .map((entry) =>
      entry
        .trim()
        .split(/\s+as\s+/)
        .at(-1)!,
    )
    .filter((name) => name !== "default");
  if (names.some((name) => !/^[A-Za-z_$][\w$]*$/.test(name)))
    throw new Error("Invalid official Rapier export");
  modules.set(
    "index.ts",
    `export * from "./exports"; import * as api from "./exports";
    export default /* @__PURE__ */ Object.freeze({__proto__:null,${names.map((name) => `${name}:api.${name}`).join(",")}});`,
  );
  return modules;
}

const bindingCache = new Map<string, Promise<{ code: string; fileName: string }>>();
export function sharedRapierBindings(modulePath: string) {
  const source = readFileSync(path.join(path.dirname(modulePath), "rapier_wasm3d.js"), "utf8");
  const key = createHash("sha256").update(source).digest("hex");
  let pending = bindingCache.get(key);
  if (!pending) {
    pending = (async () => {
      const build = await rolldown({
        input: "\0rapier-bindings",
        plugins: [
          {
            name: "official-rapier-bindings",
            resolveId(id) {
              if (id === "\0rapier-bindings") return id;
              return null;
            },
            load(id) {
              if (id === "\0rapier-bindings") return source;
              return null;
            },
          },
        ],
      });
      try {
        const { output } = await build.generate({ format: "es", minify: true });
        const chunk = output.find((item) => item.type === "chunk");
        if (!chunk || output.length !== 1) throw new Error("Unexpected Rapier bindings output");
        const hash = createHash("sha256").update(chunk.code).digest("hex").slice(0, 16);
        return { code: chunk.code, fileName: `rapier-bindings-${hash}.js` };
      } finally {
        await build.close();
      }
    })();
    bindingCache.set(key, pending);
  }
  return pending;
}
