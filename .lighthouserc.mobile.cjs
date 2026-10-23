/** Mobile audit for public shells. The live 3D scene needs a separate
 * reproducible logged-in GPU benchmark, not an anonymous /match Lighthouse score.
 * Every run must meet the critical mobile budgets before Quality gates can pass.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npx nitro preview --host 127.0.0.1 --port 4173",
      startServerReadyPattern: "Ready on http://localhost:",
      startServerReadyTimeout: 30000,
      url: [
        "http://127.0.0.1:4173/",
        "http://127.0.0.1:4173/guias",
        "http://127.0.0.1:4173/guia-de-scouting",
        "http://127.0.0.1:4173/melhores-formacoes",
        "http://127.0.0.1:4173/partida-rapida",
      ],
      numberOfRuns: 3,
      puppeteerScript: "./scripts/verify-preview-representations.cjs",
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 2.75,
          disabled: false,
        },
        throttlingMethod: "simulate",
      },
    },
    assert: {
      assertions: {
        // A laboratory release gate, not a real-user CWV or GPU certification.
        // LHCI defaults to optimistic aggregation, which can hide a failed run.
        "categories:performance": ["error", { minScore: 0.98, aggregationMethod: "pessimistic" }],
        "categories:accessibility": ["error", { minScore: 0.9, aggregationMethod: "pessimistic" }],
        "largest-contentful-paint": [
          "error",
          { maxNumericValue: 2500, aggregationMethod: "pessimistic" },
        ],
        "cumulative-layout-shift": [
          "error",
          { maxNumericValue: 0.1, aggregationMethod: "pessimistic" },
        ],
        "total-blocking-time": [
          "error",
          { maxNumericValue: 200, aggregationMethod: "pessimistic" },
        ],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci-mobile" },
  },
};
