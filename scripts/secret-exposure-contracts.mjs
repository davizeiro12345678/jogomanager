#!/usr/bin/env node
/**
 * Fail closed on recognizable private credentials accidentally committed in
 * tracked environment files. Never print file contents, values, or matches.
 * Public client keys (pk_* and sb_publishable_*) are intentionally permitted.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z", "--", ".env", ".env.*"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const privatePatterns = [
  /\b(?:sk|rk)_(?:test|live)_[a-zA-Z0-9]{10,}\b/,
  /\bsb_secret_[a-zA-Z0-9]{12,}\b/,
  /\bghp_[a-zA-Z0-9]{20,}\b/,
  /\bgithub_pat_[a-zA-Z0-9_]{20,}\b/,
  /\bwhsec_[a-zA-Z0-9]{12,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const sensitiveName =
  /(?:SERVICE_ROLE|STRIPE_SECRET|WEBHOOK_SECRET|PRIVATE_KEY|DATABASE_PASSWORD|JWT_SECRET)/i;
const flagged = [];
for (const file of tracked) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const assignment = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/);
    if (!assignment) continue;
    const [, name, raw] = assignment;
    const value = raw.trim().replace(/^["']|["']$/g, "");
    if (!value || /^(?:example|placeholder|changeme|your[_-])/i.test(value)) continue;
    if (sensitiveName.test(name) || privatePatterns.some((pattern) => pattern.test(value))) {
      flagged.push(file + ":" + (i + 1) + " (" + name + ")");
    }
  }
}
if (flagged.length) {
  console.error("Possible private credentials in tracked environment files (values suppressed):");
  for (const item of flagged) console.error(item);
  process.exitCode = 1;
} else {
  console.log("PASS: no obvious private credentials in tracked environment files.");
}
