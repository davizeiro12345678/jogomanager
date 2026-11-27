import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const KNOWN_HEAVY = [
  { label: "Rapier physics", pattern: /rapier/i },
  { label: "Three.js and post FX", pattern: /three|postprocessing|gainmap/i },
  { label: "MCP implementation", pattern: /mcp-js|prettier/i },
  { label: "Payment SDK", pattern: /stripe/i },
  { label: "Firebase", pattern: /firebase/i },
];

function staticDependencies(code) {
  const deps = [];
  // Production Nitro modules emit standard static ESM import/export lines.
  // Ignore import(...) so the report does not confuse lazy with eager execution.
  const re =
    /(?:^|\n)\s*(?:import\s+(?!\()(?:[^"'\n]*?\s+from\s+)?|export\s+(?:\{[^}\n]+\}|\*\s*(?:as\s+\w+)?)\s+from\s+)["']([^"'\n]+)["']/g;
  for (const match of code.matchAll(re)) deps.push(match[1]);
  return deps;
}

function analyze(root, entry = "index.mjs") {
  const entryPath = path.resolve(root, entry);
  const inside = (file) => file === root || file.startsWith(root + path.sep);
  if (!inside(entryPath)) throw Error("Entry escapes the Worker build root");
  const pending = [entryPath];
  const visited = new Set();
  const missing = new Set();
  const external = new Set();
  let startupBytes = 0;
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    if (!inside(file)) throw Error("Module escapes the build root: " + file);
    let code;
    try {
      code = readFileSync(file, "utf8");
    } catch {
      missing.add(path.relative(root, file));
      continue;
    }
    startupBytes += Buffer.byteLength(code, "utf8");
    for (const specifier of staticDependencies(code)) {
      if (!specifier.startsWith(".")) continue;
      let resolved = path.resolve(path.dirname(file), specifier);
      if (!path.extname(resolved)) resolved += ".mjs";
      if (!inside(resolved) || !/\.(?:mjs|cjs|js)$/.test(resolved)) {
        // Node builtins, host runtime bindings, assets and external modules
        // are not part of the emitted Worker ESM closure.
        external.add(specifier);
        continue;
      }
      pending.push(resolved);
    }
  }
  const all = [];
  const scan = (directory) => {
    for (const ent of readdirSync(directory, { withFileTypes: true })) {
      const name = path.join(directory, ent.name);
      if (ent.isDirectory()) scan(name);
      else if (ent.isFile() && /\.m?js$/.test(name))
        all.push({
          path: path.relative(root, name).replaceAll("\\", "/"),
          bytes: statSync(name).size,
        });
    }
  };
  scan(root);
  const eager = all.filter((item) => visited.has(path.resolve(root, item.path)));
  const totalBytes = all.reduce((n, item) => n + item.bytes, 0);
  const categories = KNOWN_HEAVY.map(({ label, pattern }) => ({
    name: label,
    packageBytes: all.filter((m) => pattern.test(m.path)).reduce((n, item) => n + item.bytes, 0),
    eagerBytes: eager.filter((m) => pattern.test(m.path)).reduce((n, item) => n + item.bytes, 0),
  }));
  return {
    root,
    entry,
    emitted: { modules: all.length, bytes: totalBytes },
    staticStartupClosure: { modules: eager.length, bytes: startupBytes },
    dynamicOrUnreachable: { modules: all.length - eager.length, bytes: totalBytes - startupBytes },
    missingStaticModules: [...missing].sort(),
    externalStaticSpecifiers: [...external].sort(),
    categories,
    largestEagerModules: eager.sort((a, b) => b.bytes - a.bytes).slice(0, 20),
  };
}

function selfTest() {
  const folder = mkdtempSync(path.join(tmpdir(), "jgm-startup-"));
  try {
    mkdirSync(path.join(folder, "chunks"));
    writeFileSync(
      path.join(folder, "index.mjs"),
      'import "./chunks/base.mjs";\nconst lazy = () => import("./chunks/heavy.mjs");\n',
    );
    writeFileSync(
      path.join(folder, "chunks/base.mjs"),
      'import { x } from "./constant.mjs";\nexport { y } from "./reexport.mjs";\n',
    );
    writeFileSync(path.join(folder, "chunks/constant.mjs"), "export const x = 1;\n");
    writeFileSync(path.join(folder, "chunks/reexport.mjs"), "export const y = 2;\n");
    writeFileSync(path.join(folder, "chunks/heavy.mjs"), 'export const heavy = "rapier";\n');
    const report = analyze(folder);
    assert.equal(report.emitted.modules, 5);
    assert.equal(report.staticStartupClosure.modules, 4);
    assert.equal(report.missingStaticModules.length, 0);
    assert.equal(report.dynamicOrUnreachable.modules, 1);
    console.log("WORKER_STARTUP_GRAPH_SELF_TEST_OK");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  selfTest();
} else {
  const output = args.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const root = path.resolve(process.cwd(), ".output/server");
  const report = analyze(root);
  console.log(
    JSON.stringify(
      {
        emitted: report.emitted,
        staticStartupClosure: report.staticStartupClosure,
        dynamicOrUnreachable: report.dynamicOrUnreachable,
        heavy: report.categories,
        missing: report.missingStaticModules,
      },
      null,
      2,
    ),
  );
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  if (report.missingStaticModules.length)
    console.warn(
      "Unresolved static module paths: check Nitro externals before interpreting closure counts.",
    );
}
