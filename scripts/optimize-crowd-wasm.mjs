import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const asset = path.join(root, "src/game/wasm/pkg/crowd_visibility_wasm_bg.wasm");
const before = await readFile(asset);
const temporary = await mkdtemp(path.join(tmpdir(), "crowd-wasm-"));
try {
  const output = path.join(temporary, "optimized.wasm");
  const cli = path.join(root, "node_modules/binaryen/bin/wasm-opt");
  const result = spawnSync(
    process.execPath,
    [cli, asset, "-Oz", "--converge", "--strip-debug", "-o", output],
    {
      stdio: "inherit",
    },
  );
  if (result.error || result.status !== 0)
    throw result.error ?? new Error("WASM optimization failed");
  const after = await readFile(output);
  const original = new WebAssembly.Module(before);
  const candidate = new WebAssembly.Module(after);
  for (const entries of ["imports", "exports"]) {
    const signature = (module) =>
      JSON.stringify(
        WebAssembly.Module[entries](module)
          .map((entry) => JSON.stringify(entry))
          .sort(),
      );
    if (signature(original) !== signature(candidate)) throw new Error(`WASM ${entries} changed`);
  }
  if (after.length > before.length) throw new Error("WASM optimization increased the asset");
  await writeFile(asset, after);
  console.log(
    `Crowd WASM: ${before.length} -> ${after.length} bytes; imports and exports preserved`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
