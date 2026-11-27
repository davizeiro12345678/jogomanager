import { constants } from "node:fs";
import { open } from "node:fs/promises";

/** Inspect and read the same file descriptor, never stat a path then reopen it.
 * CI runs on Linux. Refuse symlink targets and avoid blocking on a special file.
 * Keep reads bounded even if another process appends to the open file. */
export async function readQaInventoryFile(file, includeText, maxBytes = 2_000_000) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > 2_000_000)
    throw new Error("Invalid QA inventory byte limit");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    const result = { sizeBytes: info.size, text: null };
    if (!includeText || !info.isFile() || info.size > maxBytes) return result;
    const buffer = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    result.text = buffer.subarray(0, offset).toString("utf8");
    return result;
  } finally {
    await handle.close();
  }
}
