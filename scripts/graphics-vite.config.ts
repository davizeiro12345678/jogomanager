import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({
  cacheDir: "node_modules/.vite-benchmark",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../src") } },
  server: { host: "127.0.0.1", port: 4193, strictPort: true },
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
