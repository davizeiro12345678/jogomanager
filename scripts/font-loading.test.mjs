import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const script = root.match(/const ENABLE_FONTS = `([^`]+)`;/)?.[1];
assert.ok(script, "The configured font bootstrap must be exercised");

function browser(readyState, sheet = {}) {
  const link = { media: "print", sheet };
  const events = new Map();
  runInNewContext(script, {
    document: { readyState, getElementById: () => link },
    window: { addEventListener: (name, callback) => events.set(name, callback) },
  });
  return { link, events };
}

test("fonts wait until critical page resources finish", () => {
  const { link, events } = browser("loading");
  assert.equal(link.media, "print");
  assert.ok(events.has("load"));
  events.get("load")();
  assert.equal(link.media, "all");
});

test("hydrated and cached documents can activate a loaded stylesheet", () => {
  const { link, events } = browser("complete");
  assert.equal(link.media, "all");
  assert.equal(events.size, 0);
});

test("failed stylesheets retain the system-font fallback", () => {
  const { link, events } = browser("loading", null);
  events.get("load")();
  assert.equal(link.media, "print");
});

test("a missing link never blocks the page", () => {
  assert.doesNotThrow(() =>
    runInNewContext(script, {
      document: { getElementById: () => null },
      window: {},
    }),
  );
});
