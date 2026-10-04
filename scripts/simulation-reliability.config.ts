import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../src") } },
  test: {
    environment: "node",
    include: ["verification/simulation-2026-10-03/reliability.test.ts"],
    testTimeout: 600_000,
    maxWorkers: 1,
  },
});
