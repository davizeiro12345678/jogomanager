import { execFileSync } from "node:child_process";

const MAX_BYTES = 2_000_000;

/** Audit immutable regular Git blobs, never mutable checkout paths. */
export function committedSourceInventory(sha, cwd = process.cwd()) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Expected full commit SHA");
  const output = execFileSync("git", ["ls-tree", "-r", "-l", "-z", sha], {
    cwd,
    encoding: "utf8",
    maxBuffer: 16_000_000,
  });
  const entries = new Map();
  for (const record of output.split("\0").filter(Boolean)) {
    const tab = record.indexOf("\t");
    const match = /^(100644|100755) blob ([0-9a-f]{40})\s+(\d+)$/.exec(record.slice(0, tab));
    if (!match || tab < 0) continue;
    const sizeBytes = Number(match[3]);
    if (!Number.isSafeInteger(sizeBytes)) throw new Error("Invalid blob size");
    entries.set(record.slice(tab + 1), { oid: match[2], sizeBytes });
  }
  return {
    read(file, includeText, maxBytes = MAX_BYTES) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > MAX_BYTES)
        throw new Error("Invalid QA inventory byte limit");
      const entry = entries.get(file);
      if (!entry) return null;
      const { oid, sizeBytes } = entry;
      if (!includeText || sizeBytes > maxBytes) return { sizeBytes, text: null };
      const bytes = execFileSync("git", ["cat-file", "blob", oid], {
        cwd,
        maxBuffer: MAX_BYTES + 1,
      });
      if (bytes.length !== sizeBytes) throw new Error("Git blob size mismatch");
      return { sizeBytes, text: bytes.toString("utf8") };
    },
  };
}
