import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assessMatchSetup } from "./match-setup-budget.mjs";
import { isMatchRouteEntry } from "./bundle-report-comparison.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every mobile run must meet the configured critical performance budgets", () => {
  const { ci } = require("../.lighthouserc.mobile.cjs");
  assert.equal(ci.collect.numberOfRuns, 3);
  for (const [id, expected] of Object.entries({
    "categories:performance": { minScore: 0.97 },
    "largest-contentful-paint": { maxNumericValue: 2500 },
    "cumulative-layout-shift": { maxNumericValue: 0.1 },
    "total-blocking-time": { maxNumericValue: 200 },
  })) {
    const [level, options] = ci.assert.assertions[id];
    assert.equal(level, "error", `${id} must block release`);
    assert.equal(options.aggregationMethod, "pessimistic", `${id} must check the worst run`);
    for (const [key, value] of Object.entries(expected)) assert.equal(options[key], value);
  }
});

test("root SSR shell keeps RootComponent outside the initial static import", () => {
  const source = readFileSync(path.join(root, "src/routes/__root.tsx"), "utf8");
  assert.match(source, /import \{ RootShell \} from ["']@\/components\/RootShell["']/);
  assert.doesNotMatch(source, /import \{ RootShell, RootComponent \} from/);
  assert.match(
    source,
    /const RootComponent = lazyRouteComponent\(\s*\(\) => import\(["']@\/components\/RootLayout["']\),\s*["']RootComponent["']\s*,?\s*\)/s,
  );
});

const surfaces = [
  { name: "index-home.js", surface: "home" },
  { name: "new-career.js", surface: "new" },
  { name: "partida-rapida-route.js" },
  { name: "multiplayer-route.js" },
  { name: "match-execution-contract.js" },
  { name: "match-command-validation.js" },
  { name: "match-physics-extras.js" },
  { name: "match-probability.js" },
  { name: "match-readiness.js" },
  { name: "match-route.js" },
  { name: "CinematicStage3D-stage.js" },
  { name: "editor-route.js" },
  { name: "match.worker-runtime.js" },
];
const fixture = () => ({
  label: "fixture",
  totalBytes: 300_000,
  totalGzipBytes: 100_000,
  totalBrotliBytes: 80_000,
  entries: surfaces.map((entry) => ({
    ...entry,
    startupBytes: 60_000,
    startupGzipBytes: 10_000,
    startupBrotliBytes: 8_000,
  })),
});

function compare(mutate) {
  const cwd = mkdtempSync(path.join(tmpdir(), "bundle-gate-"));
  try {
    const candidate = fixture();
    mutate(candidate);
    writeFileSync(path.join(cwd, "base.json"), JSON.stringify(fixture()));
    writeFileSync(path.join(cwd, "head.json"), JSON.stringify(candidate));
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/compare-bundle-reports.mjs"), "base.json", "head.json", "--check"],
      { cwd, encoding: "utf8" },
    );
    const report = JSON.parse(readFileSync(path.join(cwd, "bundle-impact.json"), "utf8"));
    return { ...result, report };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("bundle gate permits equal or smaller transport budgets", () => {
  const result = compare((candidate) => {
    candidate.entries[0].startupBrotliBytes -= 100;
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.violations, []);
});

test("bundle gate allows up to 400 KB of total emitted JavaScript growth", () => {
  const result = compare((candidate) => {
    candidate.totalBytes += 400_000;
    candidate.totalGzipBytes += 400_000;
    candidate.totalBrotliBytes += 400_000;
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.violations, []);
});

test("bundle gate rejects total emitted JavaScript growth above 400 KB", () => {
  const result = compare((candidate) => {
    candidate.totalBytes += 400_001;
    candidate.totalGzipBytes += 400_001;
    candidate.totalBrotliBytes += 400_001;
  });
  assert.equal(result.status, 1);
  assert.match(
    result.report.violations.join("\n"),
    /JS emitido total.*growth 400001 bytes exceeds allowed \+400000 bytes/,
  );
});

test("Match 3D route selector ignores similarly named engine chunks", () => {
  for (const name of [
    "match-execution-contract.js",
    "match-command-validation.js",
    "match-physics-extras.js",
    "match-probability.js",
    "match-readiness.js",
  ]) {
    assert.equal(isMatchRouteEntry({ name }), false, `${name} is not the Match route`);
  }
  assert.equal(isMatchRouteEntry({ name: "match-a1b2c3.js" }), true);
});

test("bundle gate allows route startup growth up to 2 KiB", () => {
  const result = compare((candidate) => {
    candidate.entries.find(isMatchRouteEntry).startupBrotliBytes += 2_048;
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.violations, []);
});

test("bundle gate rejects route startup growth above 2 KiB", () => {
  const result = compare((candidate) => {
    candidate.entries.find(isMatchRouteEntry).startupBrotliBytes += 2_049;
  });
  assert.equal(result.status, 1);
  assert.match(
    result.report.violations.join("\n"),
    /Match 3D.*growth 2049 bytes exceeds allowed \+2048 bytes/,
  );
});

test("multiplayer lobby reports startup raw and keeps the same 2 KiB transport growth allowance", () => {
  const result = compare((candidate) => {
    const lobby = candidate.entries.find((entry) => entry.name.startsWith("multiplayer-"));
    lobby.startupBytes -= 15_000;
    lobby.startupGzipBytes += 2_048;
    lobby.startupBrotliBytes += 2_048;
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.violations, []);
  const raw = result.report.rows.find((row) => row.label === "Lobby multiplayer startup raw");
  assert.equal(raw.before, 60_000);
  assert.equal(raw.after, 45_000);
  for (const label of ["Lobby multiplayer startup (gzip)", "Lobby multiplayer startup (Brotli Q6)"])
    assert.equal(result.report.rows.find((row) => row.label === label).maxIncreaseBytes, 2_048);
});

test("multiplayer lobby cannot bypass the growth gate or disappear from a comparison", () => {
  for (const metric of ["startupGzipBytes", "startupBrotliBytes"]) {
    const result = compare((candidate) => {
      candidate.entries.find((entry) => entry.name.startsWith("multiplayer-"))[metric] += 2_049;
    });
    assert.equal(result.status, 1);
    assert.match(
      result.report.violations.join("\n"),
      /Lobby multiplayer.*growth 2049 bytes exceeds allowed \+2048 bytes/,
    );
  }
  const missing = compare((candidate) => {
    candidate.entries = candidate.entries.filter((entry) => !entry.name.startsWith("multiplayer-"));
  });
  assert.equal(missing.status, 1);
  assert.match(missing.report.violations.join("\n"), /Lobby multiplayer.*missing required route/);
});

test("bundle gate cannot pass by dropping a required route", () => {
  const result = compare((candidate) => {
    candidate.entries.splice(2, 1);
  });
  assert.equal(result.status, 1);
  assert.match(result.report.violations.join("\n"), /Partida rápida.*missing/i);
});

test("bundle gate rejects missing or invalid measurements", () => {
  const result = compare((candidate) => {
    candidate.totalBrotliBytes = null;
  });
  assert.equal(result.status, 1);
  assert.match(result.report.violations.join("\n"), /Brotli.*invalid/i);
});

test("constructor CPU gate accepts an unchanged or faster candidate", () => {
  const baseline = Array(62).fill(0.15);
  assert.equal(assessMatchSetup(baseline, baseline).failed, false);
  assert.equal(assessMatchSetup(baseline, Array(62).fill(0.14)).failed, false);
});

test("constructor CPU gate rejects the reproduced material regression", () => {
  const result = assessMatchSetup(Array(62).fill(0.153), Array(62).fill(0.222));
  assert.equal(result.failed, true);
  assert.ok(result.lowerRatio > 1.1);
});

test("constructor CPU gate tolerates isolated noisy samples without changing its margin", () => {
  const baseline = Array(62).fill(0.15);
  const candidate = [...Array(58).fill(0.15), ...Array(4).fill(1.5)];
  const result = assessMatchSetup(baseline, candidate);
  assert.equal(result.failed, false);
  assert.equal(result.materialRegressionPercent, 10);
  assert.equal(result.confidence, 0.99);
});

test("constructor CPU gate rejects insufficient or invalid observations", () => {
  assert.throws(() => assessMatchSetup(Array(61).fill(0.15), Array(62).fill(0.15)));
  assert.throws(() => assessMatchSetup(Array(62).fill(0.15), Array(62).fill(NaN)));
});

function verifyStress(mutate) {
  const cwd = mkdtempSync(path.join(tmpdir(), "stress-gate-"));
  try {
    const report = {
      success: true,
      testResults: [
        {
          name: "/repo/src/game/sim.stress.test.ts",
          status: "passed",
          assertionResults: [
            {
              fullName:
                "finishes 200 seeded matches and reproduces each result inside the worker guard",
              status: "passed",
            },
          ],
        },
      ],
    };
    mutate(report);
    const file = path.join(cwd, "stress-results.json");
    writeFileSync(file, JSON.stringify(report));
    return spawnSync(
      process.execPath,
      [path.join(root, "scripts/verify-stress-report.mjs"), file],
      { encoding: "utf8" },
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("stress gate accepts the executed 200-match suite", () => {
  const result = verifyStress(() => {});
  assert.equal(result.status, 0, result.stderr);
});

test("stress gate rejects skipped, missing and failed suites", () => {
  for (const mutate of [
    (report) => {
      report.testResults = [];
    },
    (report) => {
      report.testResults[0].assertionResults = [];
    },
    (report) => {
      report.testResults[0].assertionResults[0].status = "pending";
    },
    (report) => {
      report.success = false;
    },
  ]) {
    const result = verifyStress(mutate);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /complete 200-match stress suite must execute and pass/);
  }
});

test("bundle analyzer counts shared root-relative modules without following remote URLs", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "bundle-imports-"));
  try {
    writeFileSync(
      path.join(cwd, "match-route.js"),
      'import "/assets/shared.js"; import "https://example.invalid/remote.js"; export const route = 1;',
    );
    writeFileSync(path.join(cwd, "shared.js"), "export const shared = 123;");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/bundle-report.mjs"), "fixture", cwd],
      { cwd, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(path.join(cwd, "verification/bundle-2026-10-01/fixture.json"), "utf8"),
    );
    const entry = report.entries.find((entry) => entry.name === "match-route.js");
    assert.deepEqual(entry.dependencies.sort(), ["match-route.js", "shared.js"]);
    assert.equal(entry.staticBytes, report.totalBytes);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("cinematic analysis follows lazy sets in the stage's shared static registry", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "cinematic-registry-"));
  try {
    writeFileSync(path.join(cwd, "CinematicStage3D-test.js"), 'import "./registry.js";');
    writeFileSync(
      path.join(cwd, "registry.js"),
      'export const load=()=>import("./LockerRoom-test.js");',
    );
    writeFileSync(path.join(cwd, "LockerRoom-test.js"), 'export const room="locker";');
    writeFileSync(
      path.join(cwd, "unrelated.js"),
      'export const load=()=>import("./Office-test.js");',
    );
    writeFileSync(path.join(cwd, "Office-test.js"), 'export const room="office";');
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/bundle-report.mjs"), "fixture", cwd],
      { cwd, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(path.join(cwd, "verification/bundle-2026-10-01/fixture.json"), "utf8"),
    );
    assert.deepEqual(report.cinematicStage.dynamicDependencies, ["LockerRoom-test.js"]);
    assert.ok(!report.cinematicStage.staticDependencies.includes("LockerRoom-test.js"));
    assert.ok(!report.cinematicStage.dynamicDependencies.includes("Office-test.js"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("startup measurement retains the deferred hydration runtime and its bootstrap", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "hydration-startup-"));
  try {
    const sources = {
      "index-bootstrap.js": 'export const start=()=>import("./hydrate-app-test.js");',
      "hydrate-app-test.js": 'import "./renderer.js"; import "./router.js";',
      "renderer.js": 'export const renderer="mandatory hydration runtime";',
      "router.js": 'export const dashboard=()=>import("./dashboard-lazy.js");',
      "dashboard-lazy.js": 'export const screen="unopened dashboard";',
      "match-route.js": 'export const route="match";',
      "match.worker-test.js": 'export const worker="sequential simulation";',
    };
    for (const [name, source] of Object.entries(sources))
      writeFileSync(path.join(cwd, name), source);
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/bundle-report.mjs"), "fixture", cwd],
      { cwd, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(path.join(cwd, "verification/bundle-2026-10-01/fixture.json"), "utf8"),
    );
    const entry = report.entries.find((entry) => entry.name === "match-route.js");
    assert.deepEqual(entry.startupDependencies.sort(), [
      "hydrate-app-test.js",
      "index-bootstrap.js",
      "match-route.js",
      "renderer.js",
      "router.js",
    ]);
    assert.equal(
      entry.startupBytes,
      report.totalBytes -
        Buffer.byteLength(sources["dashboard-lazy.js"]) -
        Buffer.byteLength(sources["match.worker-test.js"]),
    );
    assert.deepEqual(
      report.entries.find((entry) => entry.name === "match.worker-test.js").startupDependencies,
      ["match.worker-test.js"],
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("multiplayer analyzer uses the existing static/root/hydration closure and excludes lazy live graphics", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "multiplayer-startup-"));
  try {
    const sources = {
      "index-bootstrap.js": 'export const start=()=>import("./hydrate-app-test.js");',
      "hydrate-app-test.js": 'import "./renderer.js"; import "./router.js";',
      "renderer.js": 'export const renderer="mandatory hydration runtime";',
      "router.js": 'export const dashboard=()=>import("./dashboard-lazy.js");',
      "dashboard-lazy.js": 'export const screen="unopened dashboard";',
      "multiplayer-route.js":
        'import "./lobby-shared.js"; export const live=()=>import("./LiveRoom-live.js");',
      "lobby-shared.js": 'import "./renderer.js"; export const lobby="room list";',
      "LiveRoom-live.js": 'import "./Stadium3D-live.js"; export const live="active match";',
      "Stadium3D-live.js": 'export const graphics="deferred graphics";',
    };
    for (const [name, source] of Object.entries(sources))
      writeFileSync(path.join(cwd, name), source);
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/bundle-report.mjs"), "fixture", cwd],
      { cwd, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(path.join(cwd, "verification/bundle-2026-10-01/fixture.json"), "utf8"),
    );
    const entry = report.entries.find((entry) => entry.name === "multiplayer-route.js");
    assert.deepEqual(entry.dependencies.sort(), [
      "lobby-shared.js",
      "multiplayer-route.js",
      "renderer.js",
    ]);
    assert.deepEqual(entry.startupDependencies.sort(), [
      "hydrate-app-test.js",
      "index-bootstrap.js",
      "lobby-shared.js",
      "multiplayer-route.js",
      "renderer.js",
      "router.js",
    ]);
    for (const [metric, total] of [
      ["startupBytes", "bytes"],
      ["startupGzipBytes", "gzipBytes"],
      ["startupBrotliBytes", "brotliBytes"],
    ]) {
      assert.equal(
        entry[metric],
        report.chunks
          .filter((chunk) => entry.startupDependencies.includes(chunk.name))
          .reduce((sum, chunk) => sum + chunk[total], 0),
      );
    }
    assert.ok(!entry.startupDependencies.includes("LiveRoom-live.js"));
    assert.ok(!entry.startupDependencies.includes("Stadium3D-live.js"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("browser-only gameplay routes cannot pull page and 3D graphs into SSR eagerly", () => {
  for (const route of [
    "carreira",
    "dashboard",
    "new",
    "squad",
    "editor",
    "tactics",
    "stats",
    "club",
    "pre-jogo",
    "training",
    "scouting",
    "cup",
    "board",
    "league",
    "perfil",
    "visual",
    "replays",
    "history",
    "finances",
    "coletiva",
    "transfers",
    "carreiras",
    "conquistas",
    "temporada-automatica",
    "assistente",
    "auth",
    "loja",
    "chat",
    "news",
    "compras",
    "cadastro",
    "clube.novo",
    "jogador.novo",
    "jogador.index",
    "jogador.painel",
    "checkout/claim",
    "checkout/guest",
    "checkout/return",
    "match",
    "multiplayer",
  ]) {
    const source = readFileSync(path.join(root, `src/routes/${route}.tsx`), "utf8");
    assert.match(source, /\bssr:\s*false\b/, `${route} should remain client-only`);
    assert.match(source, /component:\s*import\.meta\.env\.SSR/, `${route} requires SSR pruning`);
    assert.match(source, /:\s*lazyRouteComponent\(/, `${route} needs a client lazy page`);
    assert.doesNotMatch(source, /import\s*\{[^}]+\}\s*from\s*["']@\/pages\//);
  }
});

test("legacy multiplayer SSR does not eagerly evaluate the match physics engine", () => {
  const source = readFileSync(path.join(root, "src/lib/multiplayer.functions.ts"), "utf8");
  assert.ok(!source.includes('import { buildTeamSetup } from "@/game/quickMatch";'));
  assert.ok(!source.includes('import { CLUBS } from "@/game/data/leagues";'));
  assert.ok(!source.includes('MatchSim,\n} from "@/game/sim";'));
  assert.ok(source.includes('import("@/game/sim")'));
  assert.ok(source.includes('import("@/game/quickMatch")'));
  assert.ok(source.includes('import("@/game/data/leagues")'));
});

test("restricted email previews do not eagerly bundle rendering SDKs on every edge request", () => {
  for (const route of [
    "src/routes/lovable/email/auth/preview.ts",
    "src/routes/lovable/email/transactional/preview.ts",
  ]) {
    const source = readFileSync(path.join(root, route), "utf8");
    assert.ok(!source.includes('import { render } from "@react-email/render";'));
    assert.ok(source.includes('import("@react-email/render")'));
  }
  const transactional = readFileSync(
    path.join(root, "src/routes/lovable/email/transactional/preview.ts"),
    "utf8",
  );
  assert.ok(!transactional.includes('import { TEMPLATES } from "@/lib/email-templates/registry";'));
  assert.ok(transactional.includes('import("@/lib/email-templates/registry")'));
});
