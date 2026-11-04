import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const critical = new URL("../src/critical-base.css", import.meta.url);

test("critical CSS stays below 12 KiB", () => {
  assert.ok(statSync(critical).size < 12 * 1024, "critical CSS exceeds 12 KiB");
});

test("public and game CSS both share a tiny critical base", () => {
  assert.match(read("src/public-styles.css"), /@import\s+["']\.\/critical-base\.css["']/);
  assert.match(read("src/styles.css"), /@import\s+["']\.\/critical-base\.css["']/);
});

test("public pages never import the gameplay presentation stylesheet", () => {
  const css = read("src/public-styles.css");
  assert.doesNotMatch(css, /game-presentation\.css|\.\/styles\.css/);
  assert.match(read("src/styles.css"), /game-presentation\.css/);
});

test("SSR still selects public versus game CSS by matched route", () => {
  const root = read("src/routes/__root.tsx");
  assert.match(root, /isLightweightCssPath\(matches\.at\(-1\)\?\.pathname/);
  assert.match(root, /\? publicCss : appCss/);
});

test("game CSS prefetch is intent-only and does not block public CSS", () => {
  const layout = read("src/components/RootLayout.tsx");
  const helper = read("src/lib/game-stylesheet.ts");
  assert.match(layout, /pointerover/);
  assert.match(layout, /focusin/);
  assert.match(layout, /touchstart/);
  assert.match(layout, /prefetchGameStylesheet\(\)/);
  assert.match(helper, /link\.rel = "prefetch"/);
  assert.match(helper, /link\.as = "style"/);
  assert.doesNotMatch(read("src/public-styles.css"), /@import\s+["']\.\/game-presentation/);
});
