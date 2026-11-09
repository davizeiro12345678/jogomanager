import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const output = process.argv[2];
if (!output) throw new Error("Expected output JSON path");
const digest = (file) => {
  const bytes = fs.readFileSync(file);
  return {
    path: file.replaceAll("\\", "/"),
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
};
const allFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .trim()
  .split(/\r?\n/);
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
  .readdirSync("dist-benchmark/assets")
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
