import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifestDir = path.join(root, "src/assets/textures");
const manifestNames = (await readdir(manifestDir)).filter((n) => n.endsWith(".ktx2.asset.json"));
const signature = Buffer.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const failures = [];
const filenames = new Set();
let totalBytes = 0;
for (const name of manifestNames) {
  try {
    const manifest = JSON.parse(await readFile(path.join(manifestDir, name), "utf8"));
    const filename = manifest.original_filename;
    if (!/^[a-z0-9_-]+\.ktx2$/.test(filename) || manifest.url !== "/ktx2/" + filename) {
      throw Error("unbundled/invalid URL: " + manifest.url);
    }
    if (filenames.has(filename)) throw Error("colliding filename");
    filenames.add(filename);
    const binary = await readFile(path.join(root, "public/ktx2", filename));
    if (binary.byteLength !== manifest.size)
      throw Error("size mismatch: " + binary.byteLength + " != " + manifest.size);
    if (!binary.subarray(0, signature.length).equals(signature))
      throw Error("KTX2 signature mismatch");
    totalBytes += binary.byteLength;
  } catch (error) {
    failures.push(name + ": " + String(error));
  }
}
if (!manifestNames.length) failures.push("No KTX2 manifest found");
if (failures.length) {
  console.error("[ktx2] Mirror integrity failed:\n" + failures.join("\n"));
  process.exit(1);
}
console.log(
  `[ktx2] Verified ${manifestNames.length} owned files, ${totalBytes} bytes, signature/size/manifest URL; no missing external assets.`,
);
