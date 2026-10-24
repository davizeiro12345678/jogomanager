import { createHash } from "node:crypto";
import type { Plugin } from "vite";

/** Keep the official SMAA pixels, but cache their PNGs separately from JavaScript. */
export function postfxLookupAssets(): Plugin {
  return {
    name: "pfm-postfx-lookup-assets",
    apply: "build",
    applyToEnvironment: (environment) => environment.config.consumer === "client",
    enforce: "pre",
    transform(code, id) {
      if (!/\/postprocessing\/build\/index\.js$/.test(id.replaceAll("\\", "/"))) return;
      let count = 0;
      const result = code.replace(
        /(["'])data:image\/png;base64,([A-Za-z0-9+/=]+)\1/g,
        (_match, _quote, encoded: string) => {
          const bytes = Buffer.from(encoded, "base64");
          const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
          const reference = this.emitFile({
            type: "asset",
            name: `postfx-lookup-${digest}.png`,
            source: bytes,
          });
          count++;
          return `import.meta.ROLLUP_FILE_URL_${reference}`;
        },
      );
      if (count !== 2)
        throw new Error(
          "SMAA lookup layout changed; verify the official images before updating the asset adapter.",
        );
      return { code: result, map: null };
    },
  };
}
