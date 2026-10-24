import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { globalAgent } from "node:https";
import { postfxLookupAssets } from "./postfx-lookup-assets";

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

export default defineConfig({
  cacheDir: "node_modules/.vite-benchmark",
  plugins: [react(), tailwindcss(), postfxLookupAssets()],
  resolve: {
    alias: {
      "@/lib/telemetry-client": path.resolve(import.meta.dirname, "graphics-telemetry-stub.ts"),
      "@": path.resolve(import.meta.dirname, "../src"),
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
