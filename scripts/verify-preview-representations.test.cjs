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

function fakeBrowser(goto) {
  const pages = [];
  return {
    pages,
    newPage: async () => {
      const page = {
        closed: false,
        goto,
        close: async () => {
          page.closed = true;
        },
      };
      pages.push(page);
      return page;
    },
  };
}

test("warms the origin Lighthouse is about to measure", async () => {
  const visited = [];
  const browser = fakeBrowser(async (url) => {
    visited.push(url);
    return { status: () => 200 };
  });
  await preview('<link href="/assets/public-styles-fixture.css" rel="stylesheet">', () =>
    verify(browser, { url: "http://127.0.0.1:4173/" }),
  );
  assert.deepEqual(visited, ["http://127.0.0.1:4173/"]);
  assert.equal(browser.pages.length, 1);
  assert.equal(browser.pages[0].closed, true);
});

test("a failed warm-up never aborts the measured run", async () => {
  const browser = fakeBrowser(async () => {
    throw new Error("navigation timeout");
  });
  await preview('<link href="/assets/public-styles-fixture.css" rel="stylesheet">', () =>
    verify(browser, { url: "http://127.0.0.1:4173/guias" }),
  );
  assert.equal(browser.pages[0].closed, true);
});

test("skips the warm-up when LHCI provides no browser context", async () => {
  await preview('<link href="/assets/public-styles-fixture.css" rel="stylesheet">', () =>
    verify(undefined, undefined),
  );
});

test("default preview uses the local Nitro Worker output", () => {
  const { scripts } = require("../package.json");
  assert.equal(scripts.preview, "npm run preview:worker --");
  assert.match(
    scripts["preview:worker"],
    /wrangler dev --config \.output\/server\/wrangler\.json --local/,
  );
});
