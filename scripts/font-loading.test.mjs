import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const root = read("../src/routes/__root.tsx");
const css = read("../src/fonts.css");
const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => match[1]);
const sources = JSON.parse(read("../public/fonts/match3d/sources.json"));

test("initial shared styles discover fonts without a late activation script", () => {
  assert.match(read("../src/design-system.css"), /@import\s+["']\.\/fonts\.css["']/);
  for (const entry of ["styles.css", "public-styles.css"])
    assert.match(read("../src/" + entry), /@import\s+["']\.\/design-system\.css["']/);
  assert.doesNotMatch(root, /fonts\.googleapis\.com|fonts\.gstatic\.com|ENABLE_FONTS/);
});

test("the same families and weights retain optional system-font fallback", () => {
  assert.ok(faces.length > 0);
  const weights = new Map();
  for (const face of faces) {
    assert.match(face, /font-display:\s*optional/);
    const family = face.match(/font-family:\s*'([^']+)'/)[1];
    const weight = face.match(/font-weight:\s*([^;]+);/)[1];
    if (!weights.has(family)) weights.set(family, new Set());
    weights.get(family).add(weight);
  }
  assert.deepEqual([...weights.keys()].sort(), ["Archivo Black", "Hind", "JetBrains Mono"]);
  assert.deepEqual([...weights.get("Hind")].sort(), ["400", "500", "600", "700"]);
  assert.deepEqual([...weights.get("JetBrains Mono")].sort(), ["400", "500", "700"]);
  assert.deepEqual([...weights.get("Archivo Black")], ["400"]);
  assert.match(read("../src/design-system.css"), /system-ui/);
});

test("every declared font is local and matches the unmodified official WOFF2 bytes", () => {
  const requested = new Set([...css.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]));
  assert.equal(requested.size, sources.files.length);
  for (const asset of sources.files) {
    assert.ok(requested.has("/fonts/match3d/" + asset.file));
    assert.ok(asset.url.startsWith("https://fonts.gstatic.com/"));
    const bytes = readFileSync(new URL("../public/fonts/match3d/" + asset.file, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    assert.equal(bytes.byteLength, asset.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  }
});

test("each bundled family retains its copyright and redistribution notice", () => {
  for (const family of ["archivoblack", "hind", "jetbrainsmono"]) {
    const license = read("../public/fonts/match3d/" + family + "-OFL.txt");
    assert.match(license, /Copyright/i);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});
