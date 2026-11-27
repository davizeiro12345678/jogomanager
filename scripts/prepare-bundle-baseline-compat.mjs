import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const name = "@lovable.dev/cloud-auth-js";
const packagePath = `node_modules/${name}`;
const version = "1.2.1";
const integrity =
  "sha512-BetMp9TvV/QgZ54KBr0yhPNqcB2Z6VqrF3H54sNgsKpKeSQO0CFDtPNtSmtKW9cCsHAp7yXCl04X82Zfdjo0CA==";

// The older baseline imports this package but the candidate intentionally
// removed it. Supply only the known, dependency-free historical package to the
// shared test graph so both builds can use exactly the same installed modules.
export function baselineCompatibility(lock) {
  const entry = lock?.packages?.[packagePath];
  if (!entry) return null;
  if (
    entry.version !== version ||
    entry.integrity !== integrity ||
    ["dependencies", "optionalDependencies", "peerDependencies"].some(
      (field) => Object.keys(entry[field] ?? {}).length > 0,
    )
  ) {
    throw new Error("Baseline cloud-auth package changed; review compatibility before comparing.");
  }
  return { name, version, integrity };
}

export function assertArchiveIntegrity(bytes, expected) {
  const actual = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (actual !== expected) throw new Error("Baseline compatibility package integrity mismatch.");
}

export function prepareBaselineCompatibility(lockPath, outputPath) {
  const spec = baselineCompatibility(JSON.parse(readFileSync(lockPath, "utf8")));
  const target = path.resolve(packagePath);
  let status = "not-needed";
  if (spec && existsSync(target)) {
    status = "already-installed";
  } else if (spec) {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "bundle-baseline-compat-"));
    let created = false;
    try {
      const packed = execFileSync(
        "npm",
        [
          "pack",
          "--ignore-scripts",
          "--pack-destination",
          temporary,
          "--silent",
          `${name}@${version}`,
        ],
        { encoding: "utf8" },
      ).trim();
      if (packed !== "lovable.dev-cloud-auth-js-1.2.1.tgz")
        throw new Error("Unexpected baseline compatibility archive name.");
      const archive = path.join(temporary, packed);
      assertArchiveIntegrity(readFileSync(archive), spec.integrity);
      mkdirSync(target, { recursive: true });
      created = true;
      execFileSync("tar", ["-xzf", archive, "--strip-components=1", "-C", target]);
      const manifest = JSON.parse(readFileSync(path.join(target, "package.json"), "utf8"));
      if (manifest.name !== name || manifest.version !== version)
        throw new Error("Baseline compatibility package metadata mismatch.");
      status = "installed";
    } catch (error) {
      if (created) rmSync(target, { recursive: true, force: true });
      throw error;
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  const result = { status, package: spec };
  writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [, , lockPath, outputPath] = process.argv;
    if (!lockPath || !outputPath) throw new Error("Expected baseline lockfile and output paths.");
    console.log(JSON.stringify(prepareBaselineCompatibility(lockPath, outputPath)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Baseline compatibility setup failed.");
    process.exitCode = 1;
  }
}
