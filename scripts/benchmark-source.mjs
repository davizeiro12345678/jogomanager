import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const sourcePaths = [
  "src",
  "scripts",
  "tsconfig.json",
  "vite.config.ts",
  "package.json",
  "package-lock.json",
  ".nvmrc",
];

/** Identify the revision and nonignored source, including local edits. */
export function benchmarkSource(root) {
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const files = git(
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    ...sourcePaths,
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  const digest = createHash("sha256");
  for (const file of files) {
    const bytes = readFileSync(path.join(root, file));
    digest.update(file + "\0" + createHash("sha256").update(bytes).digest("hex") + "\0");
  }
  return {
    commitSha: git("rev-parse", "HEAD").trim(),
    treeSha: git("rev-parse", "HEAD^{tree}").trim(),
    sourceSha256: digest.digest("hex"),
    sourceFileCount: files.length,
    sourceStatus: git(
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      ...sourcePaths,
    ).trim(),
  };
}

export function assertBenchmarkSource(root, expected) {
  assert.deepEqual(benchmarkSource(root), expected, `Source changed during benchmark: ${root}`);
}
