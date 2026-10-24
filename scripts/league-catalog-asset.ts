import { createHash } from "node:crypto";
import path from "node:path";
import { rolldown } from "rolldown";
import { transformWithOxc, type Plugin } from "vite";

const catalogEntry = path.resolve(import.meta.dirname, "../src/game/data/leagues.ts");
const normalized = (value: string) => value.replaceAll("\\", "/").split("?")[0]!;

export function isLeagueCatalogModule(id: string, importer?: string): boolean {
  const source = normalized(id);
  if (source === "@/game/data/leagues" || source === "@/game/data/leagues.ts") return true;
  const resolved =
    source.startsWith(".") && importer
      ? path.resolve(path.dirname(normalized(importer)), source)
      : source;
  return (
    normalized(resolved).replace(/\.ts$/, "") === normalized(catalogEntry).replace(/\.ts$/, "")
  );
}

let compiledCatalog: Promise<{ code: string; fileName: string }> | undefined;
/** A single immutable ESM asset gives the document and sequential worker the
 * same catalog bytes. Each JS realm retains its own mutable runtime catalog.
 */
export function sharedLeagueCatalog() {
  return (compiledCatalog ??= (async () => {
    const build = await rolldown({
      input: catalogEntry,
      resolve: { extensions: [".ts", ".js", ".json"] },
      plugins: [
        {
          name: "league-catalog-typescript",
          transform(code, id) {
            return id.endsWith(".ts")
              ? transformWithOxc(code, id, { lang: "ts", target: "es2022" })
              : null;
          },
        },
      ],
    });
    try {
      const { output } = await build.generate({ format: "es", minify: true });
      const chunk = output.find((entry) => entry.type === "chunk");
      if (!chunk || output.length !== 1 || chunk.imports.length || chunk.dynamicImports.length)
        throw new Error("The shared built-in league catalog must be a self-contained ESM asset");
      const hash = createHash("sha256").update(chunk.code).digest("hex").slice(0, 16);
      return { code: chunk.code, fileName: `leagues-catalog-${hash}.js` };
    } finally {
      await build.close();
    }
  })());
}

export function leagueCatalogAsset(): Plugin {
  let catalogUrl: string;
  return {
    name: "pfm-shared-league-catalog",
    apply: "build",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.config.consumer === "client",
    async buildStart() {
      const asset = await sharedLeagueCatalog();
      const fileName = `${this.environment.config.build.assetsDir}/${asset.fileName}`;
      this.emitFile({ type: "asset", fileName, source: asset.code });
      catalogUrl = `${this.environment.config.base}${fileName}`;
    },
    resolveId(id, importer) {
      return isLeagueCatalogModule(id, importer) ? { id: catalogUrl, external: "absolute" } : null;
    },
  };
}
