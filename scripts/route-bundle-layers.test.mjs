import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findRouteStartup,
  isMatchRouteEntry,
  isMultiplayerRouteEntry,
} from "./bundle-report-comparison.mjs";

function graph(prefix, reverse = false, extra = 0) {
  const wrapper = prefix + "-wrapper.js";
  const page = prefix + "-page.js";
  const shared = "shared.js";
  const entries = [
    { name: wrapper, startupDependencies: [wrapper, shared] },
    { name: page, startupDependencies: [page, shared] },
  ];
  const chunks = [
    { name: wrapper, bytes: 1000, gzipBytes: 500, brotliBytes: 400, dynamicImports: [page] },
    {
      name: page,
      bytes: 9000 + extra,
      gzipBytes: 5000 + extra,
      brotliBytes: 4000 + extra,
      dynamicImports: [],
    },
    { name: shared, bytes: 4000, gzipBytes: 2000, brotliBytes: 1500, dynamicImports: [] },
  ];
  if (reverse) entries.reverse();
  return { entries, chunks };
}

for (const [prefix, predicate] of [
  ["match", isMatchRouteEntry],
  ["multiplayer", isMultiplayerRouteEntry],
]) {
  test(prefix + " counts both mandatory layers regardless of hashed chunk order", () => {
    const a = findRouteStartup(graph(prefix), predicate);
    const b = findRouteStartup(graph(prefix, true), predicate);
    assert.deepEqual(a, b);
    assert.deepEqual(a, { startupBytes: 14000, startupGzipBytes: 7500, startupBrotliBytes: 5900 });
    assert.equal(
      findRouteStartup(graph(prefix, true, 2049), predicate).startupGzipBytes - a.startupGzipBytes,
      2049,
    );
  });
  test(prefix + " fails closed on ambiguous graph or missing chunk", () => {
    const r = graph(prefix);
    r.chunks[0].dynamicImports = [];
    assert.equal(findRouteStartup(r, predicate), undefined);
    const missing = graph(prefix);
    missing.chunks.pop();
    assert.equal(findRouteStartup(missing, predicate), undefined);
    const duplicate = graph(prefix);
    duplicate.chunks.push(duplicate.chunks[2]);
    assert.equal(findRouteStartup(duplicate, predicate), undefined);
  });
}
test("engine and server helpers are not route entries", () => {
  assert.equal(isMatchRouteEntry({ name: "match-perception-abc.js" }), false);
  assert.equal(isMultiplayerRouteEntry({ name: "multiplayer-settlement-abc.js" }), false);
  assert.equal(isMultiplayerRouteEntry({ name: "multiplayer-tickets.functions-abc.js" }), false);
});

test("a wrapper with an omitted page cannot appear as a cheap monolithic entry", () => {
  const report = graph("match");
  report.entries.pop();
  assert.equal(findRouteStartup(report, isMatchRouteEntry), undefined);
});
