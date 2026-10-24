const assert = require("node:assert/strict");
const test = require("node:test");
const { verifyPreviewStylesheets } = require("./preview-stylesheets.cjs");

test("rejects missing CSS and HTML fallback responses in the rendered head", async () => {
  const html = '<link rel="stylesheet" href="/assets/QuickLive-missing.css">';
  for (const response of [
    new Response("Not found", { status: 404 }),
    new Response("<html>Fallback</html>", { headers: { "content-type": "text/html" } }),
    new Response("", { headers: { "content-type": "text/css" } }),
  ]) {
    await assert.rejects(
      verifyPreviewStylesheets(html, "http://127.0.0.1:4173/new", async () => response),
      /Invalid emitted stylesheet \/assets\/QuickLive-missing\.css on \/new/,
    );
  }
});

test("checks each local sheet, resolves relative URLs and leaves external fonts separate", async () => {
  const html = `<link href='/assets/style-hash.css' rel='stylesheet'>
    <link rel="stylesheet" href="/assets/style-hash.css">
    <link rel="alternate stylesheet" href="../assets/theme.css?a=1&amp;b=2">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind">
    <link rel="modulepreload" href="/assets/client.js">`;
  const requested = [];
  await verifyPreviewStylesheets(html, "http://127.0.0.1:4173/new", async (url) => {
    requested.push(url);
    return new Response("body{color:white}", {
      headers: { "content-type": "text/css; charset=utf-8" },
    });
  });
  assert.deepEqual(requested, [
    "http://127.0.0.1:4173/assets/style-hash.css",
    "http://127.0.0.1:4173/assets/theme.css?a=1&b=2",
  ]);
});
