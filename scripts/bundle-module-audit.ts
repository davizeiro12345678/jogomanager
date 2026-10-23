import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** Opt-in diagnostics only: write module attribution outside the public assets. */
export function bundleModuleAudit(): Plugin {
  return {
    name: "pfm-bundle-module-audit",
    apply: "build",
    applyToEnvironment: (environment) => environment.config.consumer === "client",
    generateBundle(_options, output) {
      const destination = process.env["PFM_BUNDLE_AUDIT_DIR"];
      if (!destination) return;
      const chunks = Object.values(output).filter((asset) => asset.type === "chunk");
      const report = chunks.map((chunk) => ({
        name: chunk.fileName,
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
        modules: Object.entries(chunk.modules).map(([id, module]) => ({
          id: id.replaceAll(process.cwd(), "."),
          renderedBytes: module.renderedLength,
          renderedExports: module.renderedExports,
        })),
      }));
      mkdirSync(destination, { recursive: true });
      writeFileSync(
        path.join(destination, "module-attribution.json"),
        JSON.stringify(report, null, 2),
      );
    },
  };
}
