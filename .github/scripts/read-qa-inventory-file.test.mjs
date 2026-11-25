import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readQaInventoryFile } from "./read-qa-inventory-file.mjs";

test("reads the metadata and bounded text of the same opened file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jm-qa-file-"));
  try {
    const file = path.join(dir, "source.ts");
    await writeFile(file, "first\nsecond\n");
    assert.deepEqual(await readQaInventoryFile(file, true, 100), {
      sizeBytes: 13,
      text: "first\nsecond\n",
    });
    assert.deepEqual(await readQaInventoryFile(file, true, 4), { sizeBytes: 13, text: null });
    assert.deepEqual(await readQaInventoryFile(file, false, 100), { sizeBytes: 13, text: null });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("does not follow symlinks or read directories as source", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jm-qa-file-"));
  try {
    const file = path.join(dir, "private.txt");
    await writeFile(file, "fixture-only");
    const link = path.join(dir, "linked.ts");
    await symlink(file, link);
    await assert.rejects(readQaInventoryFile(link, true, 100));
    const folder = path.join(dir, "folder.ts");
    await mkdir(folder);
    assert.equal((await readQaInventoryFile(folder, true, 100)).text, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
