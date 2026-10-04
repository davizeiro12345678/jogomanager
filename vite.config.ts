// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { loadEnv, type ConfigEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { imagetools } from "vite-imagetools";
import { protectThreeSourceTags } from "./scripts/r3f-source-compat.ts";
import { rapierWasmAsset } from "./scripts/rapier-wasm-asset.ts";

// Load non-VITE_ env vars into process.env for server routes (email, webhooks).
// These are NOT injected into the client bundle.
const serverEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// @lovable.dev/mcp-js currently compares Vite's slash-normalized `config.root`
// with a native Windows path and rejects `src/routes` before the dev server can
// start. The generated MCP routes are committed, so Windows can safely reuse
// them; Linux CI and Lovable still regenerate by default. Set the opt-in only
// while validating a future plugin version on Windows.
const enableMcpRouteGenerator =
  process.platform !== "win32" || process.env["PFM_ENABLE_MCP_GENERATOR"] === "1";
const verificationOutput =
  process.env["PFM_ATHLETE_PHYSICS_VERIFY"] === "1"
    ? "verification/athlete-physics-2026-10-03/production"
    : process.env["PFM_REALISM_VERIFY"] === "1"
      ? "verification/realism-2026-10-02/production"
      : process.env["PFM_ATHLETE_PREMIUM_VERIFY"] === "1"
        ? "verification/athlete-premium-2026-10-02/production"
        : process.env["PFM_PLAYER_IDENTITY_VERIFY"] === "1"
          ? "verification/player-identity-2026-10-02/production"
          : process.env["PFM_SIMULATION_VERIFY"] === "1"
            ? "verification/simulation-2026-10-02/production"
            : process.env["PFM_CINEMATIC_ROUND2_VERIFY"] === "1"
              ? "verification/cutscenes-round2-2026-10-02/production"
              : process.env["PFM_CINEMATIC_VERIFY"] === "1"
                ? "verification/cutscenes-2026-10-02/production"
                : process.env["PFM_MATCHDAY_VERIFY"] === "1"
                  ? "verification/matchday-upgrade-2026-10-02/production"
                  : process.env["PFM_CLOUDFLARE_BUILD"] === "1"
                    ? ".cloudflare/production"
                    : process.env["PFM_VISUAL_VERIFY"] === "1"
                      ? "verification/visual-2026-10-02/production"
                      : process.env["PFM_GRAPHICS_VERIFY"] === "1"
                        ? "verification/graphics-2026-09-30/production"
                        : null;

const projectConfig = defineConfig({
  nitro: {
    preset: "cloudflare-module",
    ...(verificationOutput
      ? { output: { dir: path.resolve(import.meta.dirname, verificationOutput) } }
      : {}),
    cloudflare: {
      nodeCompat: true,
      deployConfig: true,
      // Nitro accepts Wrangler settings; the Lovable wrapper's narrower type
      // only declares nodeCompat and deployConfig. Keep the supported settings.
      ...{
        wrangler: {
          name: "jogomanager-web",
          compatibility_date: "2026-10-02",
          workers_dev: true,
          keep_vars: true,
          observability: { enabled: true },
          // Keep Worker Previews isolated from the production D1 database.
          previews: {
            d1_databases: [
              {
                binding: "SPORTS_DB",
                database_name: "jogomanager-preview",
                database_id: "63ba0032-507e-4efc-9f8f-54f4b1b00830",
              },
            ],
          },
        },
      },
    },
  },
  vite: {
    // Module workers retain dynamic import boundaries. IIFE output inlined
    // Rapier's WASM and season management into every match worker startup.
    worker: { format: "es", plugins: () => [rapierWasmAsset()] },
    // O preview do sandbox é servido num host *.e2b.app gerado por sessão; sem
    // liberar a lista de hosts o Vite responde 403 e o jogo não carrega.
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      watch: { ignored: ["**/verification/**", "**/dist-benchmark/**", "**/.cloudflare/**"] },
    },
    plugins: [...(enableMcpRouteGenerator ? [mcpPlugin()] : []), imagetools()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
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

export default async (env: ConfigEnv) => protectThreeSourceTags(await projectConfig(env));
