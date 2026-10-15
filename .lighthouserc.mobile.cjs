/** Mobile audit for public shells. The live 3D scene needs a separate
 * reproducible logged-in GPU benchmark, not an anonymous /match Lighthouse score.
 * Keep this audit separate from the existing desktop CI while establishing a baseline.
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
        // 98/100 is a desired lab target, not a real-user CWV guarantee.
        "categories:performance": ["warn", { minScore: 0.98 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci-mobile" },
  },
};
