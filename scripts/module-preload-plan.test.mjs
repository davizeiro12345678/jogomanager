import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { modulePreloadPlan } from "./module-preload-plan.ts";

test("preload planning keeps new JS and CSS while omitting already-loaded static JS", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "preload-plan-"));
  const plan = modulePreloadPlan();
  const decisions = [];
  try {
    for (const [name, code] of Object.entries({
      "index.html": '<main>SSR content</main><script type="module" src="/main.js"></script>',
      "main.js":
        'import {shared} from "./shared.js"; window.shared=shared; window.openPanel=()=>import("./panel.js");',
      "shared.js": "export const shared = Math.random();",
      "panel.js":
        'import {shared} from "./shared.js"; import {detail} from "./detail.js"; import "./panel.css"; export const panel=()=>shared+detail;',
      "detail.js": "export const detail = Math.random();",
      "panel.css": ".panel { color: rgb(12, 34, 56); }",
    }))
      writeFileSync(path.join(root, name), code);
    const result = await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [plan.plugin],
      build: {
        write: false,
        modulePreload: {
          resolveDependencies(filename, dependencies, context) {
            const selected = plan.resolveDependencies(filename, dependencies, context);
            decisions.push({ dependencies, selected, ...context });
            return selected;
          },
        },
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: ["shared", "detail"].map((name) => ({
                name,
                test: new RegExp(`[/\\\\]${name}\\.js$`),
                includeDependenciesRecursively: false,
              })),
            },
          },
        },
      },
    });
    const output = (Array.isArray(result) ? result[0] : result).output;
    const shared = output.find((file) => file.type === "chunk" && file.name === "shared");
    const detail = output.find((file) => file.type === "chunk" && file.name === "detail");
    assert.ok(shared && detail, "The fixture must produce distinct static and lazy dependencies");
    const dynamic = decisions.find(
      (decision) => decision.hostType === "js" && decision.dependencies.includes(detail.fileName),
    );
    assert.ok(dynamic, "Exercise the real Vite dynamic-import dependency callback");
    assert.ok(dynamic.dependencies.includes(shared.fileName));
    assert.ok(!dynamic.selected.includes(shared.fileName));
    assert.ok(dynamic.selected.includes(detail.fileName));
    const css = output.find((file) => file.type === "asset" && file.fileName.endsWith(".css"));
    assert.ok(css, "The lazy panel still emits its stylesheet");
    const host = output.find((file) => file.fileName === dynamic.hostId);
    assert.ok(
      host.code.includes(css.fileName),
      "Vite must still await lazy CSS before evaluating the panel",
    );
    const html = decisions.find((decision) => decision.hostType === "html");
    assert.ok(html);
    assert.deepEqual(html.selected, html.dependencies, "HTML preload discovery is preserved");
    const unknown = ["new-dependency.js"];
    assert.equal(
      plan.resolveDependencies("panel.js", unknown, { hostType: "js", hostId: "unknown.js" }),
      unknown,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
