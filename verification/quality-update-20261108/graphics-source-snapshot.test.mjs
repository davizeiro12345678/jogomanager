import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./graphics-source-snapshot.mjs", import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jm-graphics-snapshot-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, "repo");
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.mkdirSync(path.join(repo, "dist-benchmark/assets"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repo });
  fs.writeFileSync(path.join(repo, "src/PlayerRig.tsx"), "fixture");
  fs.writeFileSync(path.join(repo, "package-lock.json"), "{}");
  fs.writeFileSync(path.join(repo, "dist-benchmark/graphics-benchmark.html"), "<html></html>");
  fs.writeFileSync(path.join(repo, "dist-benchmark/assets/main.js"), "export {}");
  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync(
    "git",
    ["-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "fixture"],
    { cwd: repo },
  );
  const output = path.join(repo, "report.json");
  const run = () => spawnSync(process.execPath, [script, output], { cwd: repo, encoding: "utf8" });
  return { root, repo, output, run };
}
test("normal repo source and benchmark assets are hashed", (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(f.output, "utf8"));
  assert.equal(report.sources[0].path, "src/PlayerRig.tsx");
  assert.equal(report.sources[0].bytes, 7);
  assert.equal(report.compiledJavaScriptAssets.length, 1);
});
test("rejects a source symlink outside the repository", (t) => {
  const f = fixture(t);
  const outside = path.join(f.root, "private-fixture");
  fs.writeFileSync(outside, "synthetic-private-data");
  fs.unlinkSync(path.join(f.repo, "src/PlayerRig.tsx"));
  fs.symlinkSync(outside, path.join(f.repo, "src/PlayerRig.tsx"));
  assert.notEqual(f.run().status, 0);
  assert.equal(fs.existsSync(f.output), false);
});
test("rejects symlinked build assets and directories", (t) => {
  const f = fixture(t);
  const outside = path.join(f.root, "external");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "main.js"), "synthetic-private-data");
  fs.rmSync(path.join(f.repo, "dist-benchmark/assets"), { recursive: true });
  fs.symlinkSync(outside, path.join(f.repo, "dist-benchmark/assets"));
  assert.notEqual(f.run().status, 0);
  assert.equal(fs.existsSync(f.output), false);
});
