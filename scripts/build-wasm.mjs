import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const cache =
  process.env["PFM_WASM_PACK_CACHE"] || path.join(root, "wasm/crowd-visibility/target/wasm-pack");
await mkdir(cache, { recursive: true });
// wasm-pack otherwise downloads Binaryen on demand. The desktop verification
// environment is intentionally able to build offline, so retain Rust release
// optimisation and skip only the optional post-pass when Binaryen is absent.
// CI machines that provide wasm-opt continue to use the extra optimisation.
const hasWasmOpt = spawnSync("wasm-opt", ["--version"], { stdio: "ignore" }).status === 0;
const result = spawnSync(
  "wasm-pack",
  [
    "build",
    ...(hasWasmOpt ? [] : ["--no-opt"]),
    "wasm/crowd-visibility",
    "--target",
    "web",
    "--release",
    "--out-dir",
    "../../src/game/wasm/pkg",
    "--out-name",
    "crowd_visibility_wasm",
    "--locked",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TMP: cache, TEMP: cache, WASM_PACK_CACHE: cache },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
// wasm-pack ignores its entire output by default. This project ships the
// generated files so normal frontend builds do not require a Rust toolchain.
await rm(path.join(root, "src/game/wasm/pkg/.gitignore"), { force: true });
