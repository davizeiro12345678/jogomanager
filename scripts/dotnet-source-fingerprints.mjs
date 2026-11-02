import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function dotnetCoreSources(
  root,
  directory = path.join(root, "engine/dotnet/src/JogoManager.Engine.Core"),
) {
  const hashes = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "bin" || entry.name === "obj") continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(hashes, await dotnetCoreSources(root, file));
    else if (/\.(?:cs|csproj)$/.test(entry.name))
      hashes[path.relative(root, file).replaceAll("\\", "/")] = await fileSha256(file);
  }
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
}

export async function fileSha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

export const coreBuildInput = (root) =>
  path.join(
    root,
    "engine/dotnet/src/JogoManager.Engine.Core/bin/Release/net10.0/JogoManager.Engine.Core.dll",
  );
