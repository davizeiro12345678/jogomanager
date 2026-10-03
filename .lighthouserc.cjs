/** Browser audit kept separate from GPU certification and custom 3D metrics. */
module.exports = {
  ci: {
    collect: {
      // Serve the built Worker directly. `nitro preview` reports its proxy as
      // listening before Wrangler has finished starting the Worker, which can
      // send Lighthouse to a transient Chrome network error page.
      startServerCommand:
        "npx wrangler dev --config .output/server/wrangler.json --local --ip 127.0.0.1 --port 4173",
      startServerReadyPattern: "Ready on http://",
      startServerReadyTimeout: 120000,
      url: ["http://127.0.0.1:4173/"],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        throttlingMethod: "provided",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.45 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.85 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
