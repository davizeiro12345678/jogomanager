import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifestsDir = path.join(root, "src/assets/textures");
const publicDir = path.join(root, "public/ktx2");
const origin = "https://id-preview--f0dcad90-231c-4ef4-bd1b-b199f3902fb1.lovable.app";
const magic = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const names = (await readdir(manifestsDir)).filter((n) => n.endsWith(".ktx2.asset.json")).sort();
if (!names.length) throw Error("No KTX2 manifests found");
const entries = await Promise.all(
  names.map(async (n) => {
    const file = path.join(manifestsDir, n);
    const meta = JSON.parse(await readFile(file, "utf8"));
    if (
      !/^\/__l5e\/assets-v1\/[0-9a-f-]+\/[^/]+\.ktx2$/.test(meta.url) ||
      !/^[a-z0-9_-]+\.ktx2$/.test(meta.original_filename) ||
      meta.url.split("/").at(-1) !== meta.original_filename ||
      !Number.isInteger(meta.size) ||
      meta.size < 12 ||
      meta.size > 4_000_000
    ) {
      throw Error("Untrusted manifest: " + n);
    }
    return { file, meta };
  }),
);
const unique = new Set(entries.map((x) => x.meta.original_filename));
if (unique.size !== entries.length) throw Error("Colliding KTX2 filenames");
await mkdir(publicDir, { recursive: true });
let next = 0;
const failures = [];
const done = [];
await Promise.all(
  Array.from({ length: Math.min(6, entries.length) }, async () => {
    while (next < entries.length) {
      const idx = next++;
      const { file, meta } = entries[idx];
      try {
        const response = await fetch(origin + meta.url, { signal: AbortSignal.timeout(25000) });
        if (!response.ok || new URL(response.url).origin !== origin)
          throw Error("HTTP " + response.status + " at unexpected origin");
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.subarray(0, 12).equals(magic)) throw Error("Invalid KTX2 magic");
        if (buffer.byteLength !== meta.size)
          throw Error("Size mismatch expected=" + meta.size + " actual=" + buffer.byteLength);
        await writeFile(path.join(publicDir, meta.original_filename), buffer);
        done.push({ name: meta.original_filename, bytes: buffer.byteLength });
      } catch (e) {
        failures.push({ name: meta.original_filename, error: String(e) });
      }
    }
  }),
);
if (failures.length) {
  console.error(
    JSON.stringify({ downloaded: done.length, total: entries.length, failed: failures }, null, 2),
  );
  process.exit(1);
}
for (const { file, meta } of entries) {
  meta.url = "/ktx2/" + meta.original_filename;
  await writeFile(file, JSON.stringify(meta, null, 2) + "\n");
}
const bytes = done.reduce((sum, x) => sum + x.bytes, 0);
console.log(
  JSON.stringify(
    {
      verified: done.length,
      total: entries.length,
      bytes,
      files: done.map((x) => x.name).slice(0, 9),
    },
    null,
    2,
  ),
);
