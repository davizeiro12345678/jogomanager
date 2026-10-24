import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { build } from "vite";
import { postfxLookupAssets } from "./postfx-lookup-assets.ts";
const require = createRequire(import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("browser build externalizes the exact official SMAA images without embedding them in JS", async () => {
  const entry = require.resolve("postprocessing").replace(/index\.cjs$/, "index.js");
  const source = readFileSync(entry, "utf8");
  const expected = [...source.matchAll(/(["'])data:image\/png;base64,([A-Za-z0-9+/=]+)\1/g)]
    .map((m) => hash(Buffer.from(m[2], "base64")))
    .sort();
  assert.equal(expected.length, 2, "Review an upstream image/layout change before accepting it");
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      postfxLookupAssets(),
      {
        name: "smaa-contract-fixture",
        resolveId(id) {
          return id === "smaa-contract-fixture" ? "\0smaa-contract-fixture" : null;
        },
        load(id) {
          return id === "\0smaa-contract-fixture"
            ? `import {SMAAImageLoader} from ${JSON.stringify(entry)};window.createSmaaLoader=()=>new SMAAImageLoader();`
            : null;
        },
      },
    ],
    build: {
      write: false,
      rolldownOptions: { input: "smaa-contract-fixture", external: ["three"] },
    },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const images = output.filter((file) => file.type === "asset" && file.fileName.endsWith(".png"));
  assert.deepEqual(images.map((file) => hash(file.source)).sort(), expected);
  const js = output
    .filter((file) => file.type === "chunk")
    .map((file) => file.code)
    .join("\n");
  assert.ok(!js.includes("data:image/png;base64,"));
  for (const image of images)
    assert.ok(js.includes(image.fileName), "The loader must reference every emitted image");
});
