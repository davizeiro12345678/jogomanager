import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const homeFile = "src/components/home/FootballHome.tsx";
const contentStyles = "src/components/home/home-content.css";

test("the SSR Home stylesheet styles the hero and linkable sections at first paint", () => {
  const entry = source("src/public-home-styles.css");
  assert.match(entry, /@import "\.\/components\/home\/home-first-paint\.css"/);
  assert.match(entry, /@import "\.\/components\/home\/home-content\.css"/);
  assert.doesNotMatch(entry, /home-tactics\.css/);
  assert.match(source("src/components/home/home-first-paint.css"), /\.home-hero-image/);
  assert.match(source(contentStyles), /\.home-mode-grid/);
  assert.match(source(contentStyles), /\.home-manager-section/);
});

test("offscreen tactics load their component and their styles through the same boundary", () => {
  const home = source(homeFile);
  assert.match(home, /lazy\(\(\) =>\s*import\("\.\/TacticalPreview"\)/);
  assert.match(home, /IntersectionObserver/);
  assert.match(home, /<DeferredTacticalPreview\s*\/>/);
  assert.doesNotMatch(home, /const FORMATIONS\s*=/);
  assert.match(source("src/components/home/TacticalPreview.tsx"), /import "\.\/home-tactics\.css"/);
  assert.match(source(contentStyles), /\.home-tactics-placeholder/);
  assert.match(source(contentStyles), /--home-pitch-height/);
});

test("editorial content and navigation stay available in the SSR tree", () => {
  const home = source(homeFile);
  assert.match(home, /<section id="modos"/);
  assert.match(home, /<HomeDetails\s*\/>/);
});
