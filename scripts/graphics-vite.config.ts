import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../src") } },
  server: { host: "127.0.0.1", port: 4193, strictPort: true },
  build: { outDir: "dist-benchmark", rollupOptions: { input: "graphics-benchmark.html" } },
});
