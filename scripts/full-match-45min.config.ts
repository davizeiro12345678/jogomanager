import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../src") } },
  test: {
    environment: "node",
    include: ["verification/simulation-2026-10-03/full-match-45min.test.ts"],
    testTimeout: 2_910_000,
    maxWorkers: 1,
  },
});
