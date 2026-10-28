// This is a limited, high-confidence check; it cannot prove absence of secrets.
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const names = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const patterns = [
  ["OpenAI key", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}/g],
  ["Stripe secret", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g],
  ["Supabase secret", /\bsb_secret_[A-Za-z0-9_-]{16,}/g],
  ["GitHub token", /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/g],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["Slack webhook", /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g],
];
let failures = 0;
let scanned = 0;
let skipped = 0;
for (const name of names) {
  const base = path.posix.basename(name);
  if (
    (base === ".env" ||
      base.startsWith(".env.") ||
      base === ".envrc" ||
      base.startsWith(".envrc.") ||
      base === ".dev.vars" ||
      base.startsWith(".dev.vars.") ||
      /\.env(?:\.|$)/.test(base)) &&
    !base.endsWith(".example")
  ) {
    console.error(`Tracked environment file: ${name}`);
    failures++;
  }
  const file = path.join(root, name);
  let data;
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.size > 4_000_000) {
      skipped++;
      continue;
    }
    data = readFileSync(file);
  } catch {
    console.error(`Unable to inspect tracked file: ${name}`);
    failures++;
    continue;
  }
  if (data.subarray(0, 8192).includes(0)) {
    skipped++;
    continue;
  }
  scanned++;
  const contents = data.toString("utf8");
  for (const [kind, regex] of patterns) {
    regex.lastIndex = 0;
    for (const match of contents.matchAll(regex)) {
      const line = contents.slice(0, match.index).split("\n").length;
      console.error(`Possible ${kind} in ${name}:${line} (value withheld)`);
      failures++;
    }
  }
}
console.log(
  `Secret check: ${scanned} text files scanned; ${skipped} binary, large, or non-regular files skipped.`,
);
if (failures) process.exitCode = 1;
