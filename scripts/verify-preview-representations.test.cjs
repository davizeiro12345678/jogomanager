const assert = require("node:assert/strict");
const { test } = require("node:test");
const verify = require("./verify-preview-representations.cjs");

async function preview(link, run) {
  const previous = global.fetch;
  global.fetch = async () => ({
    status: 200,
    headers: { get: () => "text/html; charset=utf-8" },
    text: async () =>
      `<html lang="pt-BR"><head><title>Pro Football Manager</title>${link}</head><body><h1>Pro Football Manager</h1></body></html>`,
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
test("accepts an explicit critical stylesheet before client hydration", async () => {
  await preview('<link href="/assets/public-styles-fixture.css" rel="stylesheet">', verify);
});
