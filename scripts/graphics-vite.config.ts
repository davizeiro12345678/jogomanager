import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { globalAgent } from "node:https";

// Asset manifests retain their production paths. The isolated studio has no
// Lovable asset edge, so forward only that public namespace in dev/preview.
const assetHost = process.env["LOVABLE_PREVIEW_HOST"]?.trim() || "jogomanager.com";
const assetProxy: Record<string, ProxyOptions> = {
  "^/__l5e/assets-v1/": {
    target: `https://${assetHost}`,
    changeOrigin: true,
    // Vite otherwise opts out of Node's global agent and its environment proxy.
    agent: globalAgent,
    configure(proxy) {
      proxy.on("start", (request) => {
        delete request.headers.cookie;
        delete request.headers.authorization;
      });
    },
  },
};

import { rapierWasmAsset } from "./rapier-wasm-asset";
export default defineConfig({
  cacheDir: "node_modules/.vite-benchmark",
  plugins: [react(), tailwindcss(), rapierWasmAsset()],
  worker: { format: "es", plugins: () => [rapierWasmAsset()] },
  resolve: {
    alias: {
      "@/lib/telemetry-client": path.resolve(import.meta.dirname, "graphics-telemetry-stub.ts"),
      "@": path.resolve(import.meta.dirname, "../src"),
      // Standalone visual fixtures do execute client stubs for server
      // functions (telemetry can be imported by a frame probe), but they have
      // no TanStack Start request context. Keeping this server-only entry
      // empty prevents the fixture from bundling an SSR manifest.
      "@tanstack/react-start/server": path.resolve(
        import.meta.dirname,
        "./graphics-server-stub.ts",
      ),
      "@/integrations/supabase/client.server": path.resolve(
        import.meta.dirname,
        "./graphics-supabase-stub.ts",
      ),
      // The standalone visual fixtures intentionally do not load the TanStack
      // Start plugin. Vite 8/Rolldown otherwise resolves these package-private
      // stubs in the wrong package scope while walking optional SSR imports.
      "#tanstack-start-entry": path.resolve(
        import.meta.dirname,
        "../node_modules/@tanstack/start-client-core/dist/esm/fake-entries/start.js",
      ),
      "#tanstack-router-entry": path.resolve(
        import.meta.dirname,
        "../node_modules/@tanstack/start-client-core/dist/esm/fake-entries/router.js",
      ),
      "#tanstack-start-plugin-adapters": path.resolve(
        import.meta.dirname,
        "../node_modules/@tanstack/start-server-core/dist/esm/empty-plugin-adapters.js",
      ),
      "#tanstack-start-server-fn-resolver": path.resolve(
        import.meta.dirname,
        "../node_modules/@tanstack/start-server-core/dist/esm/fake-start-server-fn-resolver.js",
      ),
    },
  },
  server: { host: "127.0.0.1", port: 4193, strictPort: true, proxy: assetProxy },
  preview: { proxy: assetProxy },
  build: {
    outDir: "dist-benchmark",
    rollupOptions: {
      input: {
        benchmark: "graphics-benchmark.html",
        players: "player-studio.html",
        cinema: "cinematic-studio.html",
      },
    },
  },
});
