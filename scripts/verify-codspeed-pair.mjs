import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const [baseArg, headArg] = process.argv.slice(2);
if (!baseArg || !headArg) throw new Error("Usage: verify-codspeed-pair.mjs BASE_DIR HEAD_DIR");
const roots = [realpathSync(baseArg), realpathSync(headArg)];
const [base, head] = roots;
const dependencies = realpathSync(path.join(head, "node_modules"));
if (realpathSync(path.join(base, "node_modules")) !== dependencies)
  throw new Error("Paired CodSpeed runs require the same installed dependency tree");
const lock = readFileSync(path.join(head, "package-lock.json"));
if (!lock.equals(readFileSync(path.join(base, "package-lock.json"))))
  throw new Error("Paired CodSpeed runs require identical dependency lockfiles");
const expectedNode = readFileSync(path.join(head, ".nvmrc"), "utf8").trim();
if (process.version !== `v${expectedNode}`) throw new Error(`Use pinned Node ${expectedNode}`);
console.log(
  JSON.stringify({
    node: process.version,
    dependencyLockSha256: createHash("sha256").update(lock).digest("hex"),
    roots,
  }),
);
