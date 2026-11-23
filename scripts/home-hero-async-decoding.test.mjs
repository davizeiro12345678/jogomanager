import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("home LCP hero uses asynchronous decoding while keeping eager priority", () => {
  const source = readFileSync(
    new URL("../src/components/home/FootballHome.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /className="home-hero-image"[\s\S]*?fetchPriority="high"[\s\S]*?decoding="async"/,
  );
  assert.doesNotMatch(source, /className="home-hero-image"[\s\S]*?decoding="sync"/);
});
