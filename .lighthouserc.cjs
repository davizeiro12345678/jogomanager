/** Browser audit kept separate from GPU certification and custom 3D metrics. */
module.exports = {
  ci: {
    collect: {
      // `vite preview` expects a static dist/index.html, while this app builds
      // a Cloudflare/Nitro worker in `.output`. Nitro owns the worker preview
      // and supplies the actual SSR and routing surface Lighthouse must audit.
      startServerCommand: "npx nitro preview --host 127.0.0.1 --port 4173",
      startServerReadyPattern: "Listening on:",
      startServerReadyTimeout: 30000,
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
