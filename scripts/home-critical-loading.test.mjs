import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import postcss from "postcss";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const criticalPath = "src/components/home/home-first-paint.css";
const deferredPath = "src/components/home/home-below-fold.css";

test("the SSR Home stylesheet contains only first-paint home rules", () => {
  const entry = source("src/public-home-styles.css");
  assert.match(entry, /@import "\.\/components\/home\/home-first-paint\.css"/);
  assert.doesNotMatch(entry, /@import "\.\/components\/home\/home\.css"/);
  assert.doesNotMatch(entry, /@import "\.\/components\/home\/home-below-fold\.css"/);
  assert.match(source(criticalPath), /\.home-hero-image/);
  assert.match(source(criticalPath), /@media \(max-width: 760px\)/);
  assert.match(source(criticalPath), /\.home-hero-stats/);
  assert.doesNotMatch(source(criticalPath), /\.home-tactics svg/);
});

test("offscreen Home CSS is loaded by an observer and idle fallback, not in the SSR head", () => {
  const loader = source("src/components/home/HomeDeferredAssets.tsx");
  assert.match(loader, /IntersectionObserver/);
  assert.match(loader, /import\("\.\/home-below-fold\.css"\)/);
  assert.match(loader, /requestIdleCallback/);
  assert.match(source("src/components/home/FootballHome.tsx"), /<HomeDeferredAssets\s*\/>/);
  assert.match(source(deferredPath), /\.home-tactics/);
});

test("interactive tactics are a separate lazy module, while editorial content stays SSR-visible", () => {
  const home = source("src/components/home/FootballHome.tsx");
  assert.match(home, /lazy\(\(\) =>\s*import\("\.\/TacticalPreview"\)/);
  assert.match(home, /<DeferredTacticalPreview\s*\/>/);
  assert.match(home, /<section id="modos"/);
  assert.match(home, /<HomeDetails\s*\/>/);
  assert.doesNotMatch(home, /const FORMATIONS\s*=/);
  assert.match(source("src/components/home/TacticalPreview.tsx"), /const FORMATIONS/);
});

test("deferred CSS retains manager and guide containment without hiding page content", () => {
  const critical = postcss.parse(source(criticalPath));
  const deferred = postcss.parse(source(deferredPath));
  assert.ok(critical.nodes.some((node) => node.type === "rule" && node.selector === ".home-hero"));
  assert.ok(
    deferred.nodes.some(
      (node) => node.type === "rule" && node.selector === ".home-manager-section",
    ),
  );
  assert.match(source(criticalPath), /content-visibility:\s*auto/);
});
