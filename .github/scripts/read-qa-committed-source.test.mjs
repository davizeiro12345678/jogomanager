import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { committedSourceInventory } from "./read-qa-committed-source.mjs";

test("reads only committed regular blobs, not modified checkout or symlink targets", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "jm-qa-commit-"));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  try {
    git("init", "-q");
    mkdirSync(path.join(cwd, "src"));
    writeFileSync(path.join(cwd, "src/source.ts"), "committed\n");
    writeFileSync(path.join(cwd, "src/big.ts"), "x".repeat(100));
    symlinkSync("source.ts", path.join(cwd, "src/link.ts"));
    git("add", ".");
    git("-c", "user.name=QA", "-c", "user.email=qa@localhost", "commit", "-qm", "fixture");
    const sha = git("rev-parse", "HEAD");
    writeFileSync(path.join(cwd, "src/source.ts"), "uncommitted\n");
    const inventory = committedSourceInventory(sha, cwd);
    assert.deepEqual(inventory.read("src/source.ts", true), { sizeBytes: 10, text: "committed\n" });
    assert.deepEqual(inventory.read("src/big.ts", true, 10), { sizeBytes: 100, text: null });
    assert.equal(inventory.read("src/link.ts", true), null);
    assert.equal(inventory.read("../outside.ts", true), null);
    assert.equal(inventory.read("src/missing.ts", true), null);
    assert.throws(() => committedSourceInventory("HEAD", cwd));
    assert.throws(() => inventory.read("src/source.ts", true, 2000001));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("both QA source passes use the immutable commit inventory", () => {
  const source = readFileSync(new URL("./pr132-nine-axis-qa.mjs", import.meta.url), "utf8");
  assert.equal(source.match(/committedSourceInventory\(sha\)/g)?.length, 2);
  assert.doesNotMatch(source, /await readFile\(file/);
  assert.match(source, /inspectedChangedCodeFiles: inspected/);
});
