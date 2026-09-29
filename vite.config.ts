// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { imagetools } from "vite-imagetools";

// Load non-VITE_ env vars into process.env for server routes (email, webhooks).
// These are NOT injected into the client bundle.
const serverEnv = loadEnv(process.env['NODE_ENV'] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// @lovable.dev/mcp-js currently compares Vite's slash-normalized `config.root`
// with a native Windows path and rejects `src/routes` before the dev server can
// start. The generated MCP routes are committed, so Windows can safely reuse
// them; Linux CI and Lovable still regenerate by default. Set the opt-in only
// while validating a future plugin version on Windows.
const enableMcpRouteGenerator =
  process.platform !== "win32" || process.env["PFM_ENABLE_MCP_GENERATOR"] === "1";

export default defineConfig({
  vite: {
    // O preview do sandbox é servido num host *.e2b.app gerado por sessão; sem
    // liberar a lista de hosts o Vite responde 403 e o jogo não carrega.
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
    },
    plugins: [...(enableMcpRouteGenerator ? [mcpPlugin()] : []), imagetools()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
