const assert = require("node:assert/strict");
const { test } = require("node:test");
const verify = require("./verify-preview-representations.cjs");

async function preview(link, run) {
  const previous = global.fetch;
  global.fetch = async (resource) => {
    const pathname = new URL(resource).pathname;
    if (pathname.endsWith(".css")) {
      return {
        status: 200,
        headers: { get: () => "text/css; charset=utf-8" },
        text: async () => "body { background-color: #000; }",
      };
    }
    const gameRoute = ["/new", "/dashboard", "/match"].includes(pathname);
    const stylesheet = gameRoute
      ? '<link href="/assets/styles-fixture.css" rel="stylesheet">'
      : link;
    return {
      status: 200,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () =>
        `<html lang="pt-BR"><head><title>Pro Football Manager</title>${stylesheet}</head><body><h1>Pro Football Manager</h1></body></html>`,
    };
  };
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
