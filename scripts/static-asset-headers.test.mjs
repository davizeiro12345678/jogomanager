import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const source = new URL("../public/_headers", import.meta.url);
const built = new URL("../.output/public/_headers", import.meta.url);

const verify = (body) => {
  assert.match(body, /^\/\*\s*$/m, "static assets need an inclusive /* rule");
  assert.match(body, /^\s+X-Content-Type-Options:\s*nosniff\s*$/mi);
  assert.match(body, /^\s+Referrer-Policy:\s*strict-origin-when-cross-origin\s*$/mi);
  assert.match(body, /^\s+Permissions-Policy:\s*.+\bcamera=\(\)/mi);
};

test("static source declares secure headers", () => verify(readFileSync(source, "utf8")));

test("worker build preserves static header rules", () => {
  assert.ok(existsSync(built), "missing .output/public/_headers in the built worker");
  verify(readFileSync(built, "utf8"));
});
