import { test } from "node:test";
import assert from "node:assert/strict";
import { isMatchRouteEntry, measureBrowserRoute } from "./bundle-report-comparison.mjs";

function graph(prefix, wrapperHash = "a", pageHash = "b", extra = 0) {
  const wrapper = `${prefix}-${wrapperHash}.js`;
  const page = `${prefix}-${pageHash}.js`;
  const shared = "shared.js";
  const entries = [
    { name: wrapper, dependencies: [shared], startupDependencies: [wrapper, shared] },
    { name: page, startupDependencies: [page, shared] },
  ];
  const chunks = [
    { name: "hydrate-app-app.js", dynamicImports: [wrapper] },
    { name: wrapper, bytes: 1000, gzipBytes: 500, brotliBytes: 400, dynamicImports: [page] },
    {
      name: page,
      bytes: 9000 + extra,
      gzipBytes: 5000 + extra,
      brotliBytes: 4000 + extra,
      dynamicImports: ["unrelated-drawer.js"],
      imports: [shared],
    },
    { name: shared, bytes: 4000, gzipBytes: 2000, brotliBytes: 1500, imports: [] },
  ];
  return { entries, chunks };
}

for (const prefix of ["match", "multiplayer"]) {
  test(`${prefix} counts both mandatory layers regardless of hashed chunk order`, () => {
    const before = measureBrowserRoute(graph(prefix), `${prefix}-`);
    const after = measureBrowserRoute(graph(prefix, "z", "a", 2049), `${prefix}-`);
    assert.deepEqual(
      [before.startupBytes, before.startupGzipBytes, before.startupBrotliBytes],
      [14000, 7500, 5900],
    );
    assert.equal(after.startupGzipBytes - before.startupGzipBytes, 2049);
  });
  test(`${prefix} fails closed when the wrapper or mandatory chunks are ambiguous or absent`, () => {
    const ambiguous = graph(prefix);
    ambiguous.chunks[0].dynamicImports.push(`${prefix}-other.js`);
    assert.equal(measureBrowserRoute(ambiguous, `${prefix}-`), undefined);
    const missing = graph(prefix);
    missing.chunks.pop();
    assert.equal(measureBrowserRoute(missing, `${prefix}-`), undefined);
    const duplicate = graph(prefix);
    duplicate.chunks.push(duplicate.chunks[2]);
    assert.equal(measureBrowserRoute(duplicate, `${prefix}-`), undefined);
  });
}

test("the historical Match 3D fallback excludes engine helpers", () => {
  assert.equal(isMatchRouteEntry({ name: "match-physics-extras-abc.js" }), false);
});
