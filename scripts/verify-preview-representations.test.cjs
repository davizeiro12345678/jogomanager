const assert = require("node:assert/strict");
const { test } = require("node:test");
const verify = require("./verify-preview-representations.cjs");

async function preview(link, run) {
  const previous = global.fetch;
  global.fetch = async (url) => ({
    status: 200,
    headers: { get: () => "text/html; charset=utf-8" },
    text: async () =>
      `<html lang="pt-BR"><head><title>Pro Football Manager</title>${typeof link === "function" ? link(new URL(url).pathname) : link}</head><body><h1>Pro Football Manager</h1></body></html>`,
  });
  try {
    await run();
  } finally {
    global.fetch = previous;
  }
}

test("rejects public SSR pages that depend on hydration for their critical CSS", async () => {
  await preview("", () => assert.rejects(verify, /critical.*stylesheet/i));
});
test("accepts route-specific critical stylesheets before client hydration", async () => {
  await preview(
    (path) =>
      `<link href="/assets/${path === "/" ? "home" : "public"}-styles-fixture.css" rel="stylesheet">`,
    verify,
  );
});
test("rejects a public stylesheet when the homepage stylesheet is missing", async () => {
  await preview('<link href="/assets/public-styles-fixture.css" rel="stylesheet">', () =>
    assert.rejects(verify, /critical.*stylesheet.*\//i),
  );
});
