import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const output = process.argv[2];
if (!output) throw new Error("Expected output JSON path");
const root = fs.realpathSync(process.cwd());
const safeRepositoryPath = (file) => {
  const absolute = path.resolve(root, file);
  const relative = path.relative(root, absolute);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  )
    throw new Error("Snapshot input is outside the repository");
  let cursor = root;
  for (const part of relative.split(path.sep)) {
    cursor = path.join(cursor, part);
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error("Snapshot input contains a symlink");
  }
  return absolute;
};
const digest = (file) => {
  const input = safeRepositoryPath(file);
  const fd = fs.openSync(
    input,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
  );
  let bytes;
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error("Snapshot input is not a regular file");
    bytes = fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return {
    path: file.replaceAll("\\", "/"),
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
};
const allFiles = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);
const sources = [
  ...new Set(
    allFiles.filter(
      (file) =>
        /^src\//.test(file) &&
        /(?:rig-skin|rig-section-kernel|rigid-actor-batch|instance-transform|athlete-cloth|match-rig-pool|dormant-resource-pool|PlayerRig|player-rig[^/]*|MatchPlayers|LowPlayers|FrameProbe|StadiumEnvironment|CinematicEnvironment|StadiumScene|CinematicStage3D)\.(?:ts|tsx)$/.test(
          file,
        ),
    ),
  ),
]
  .sort()
  .map(digest);
const assets = fs
  .readdirSync(safeRepositoryPath("dist-benchmark/assets"))
  .filter((file) => file.endsWith(".js"))
  .sort()
  .map((file) => digest(path.join("dist-benchmark/assets", file)));
const report = {
  capturedAt: new Date().toISOString(),
  node: process.version,
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  fixture: digest("dist-benchmark/graphics-benchmark.html"),
  lock: digest("package-lock.json"),
  sources,
  compiledJavaScriptAssets: assets,
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({ output, head: report.head, sources: sources.length, assets: assets.length }),
);
