import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareStartupBaseline } from "./prepare-startup-baseline.mjs";

test("adapts only the renamed validator API and records auditable baseline hashes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "startup-baseline-"));
  try {
    await mkdir(path.join(root, "src/lib"), { recursive: true });
    const filename = path.join(root, "src/lib/real-football.functions.ts");
    const source =
      'export const lookup = createServerFn({ method: "GET" })\n  .inputValidator(schema.parse)\n  .handler(handler);\n';
    await writeFile(filename, source);
    const reportPath = path.join(root, "evidence/compatibility.json");
    await prepareStartupBaseline(root, reportPath);
    assert.equal(
      await readFile(filename, "utf8"),
      source.replace(".inputValidator(", ".validator("),
    );
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.edits.length, 1);
    assert.equal(report.edits[0].replacements, 1);
    assert.match(report.edits[0].beforeSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(report.edits[0].beforeSha256, report.edits[0].afterSha256);
    await assert.rejects(prepareStartupBaseline(root, reportPath), /report already exists/);
    assert.deepEqual(JSON.parse(await readFile(reportPath, "utf8")), report);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("migrates historical email imports without changing templates or unrelated modules", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "startup-email-baseline-"));
  try {
    const templates = path.join(root, "src/lib/email-templates");
    await mkdir(templates, { recursive: true });
    await writeFile(path.join(root, "src/lib/real-football.functions.ts"), "export {};\n");
    const source =
      'import { Button } from "@react-email/components";\nexport const Email = () => <Button href="https://example.test/?a=1&b=2">Entrar</Button>;\n';
    await writeFile(path.join(templates, "signup.tsx"), source);
    const unrelated = path.join(templates, "metadata.ts");
    await writeFile(unrelated, 'export const packageName = "@react-email/components";\n');
    const reportPath = path.join(root, "compatibility.json");
    await prepareStartupBaseline(root, reportPath);
    assert.equal(
      await readFile(path.join(templates, "signup.tsx"), "utf8"),
      source.replace('from "@react-email/components"', 'from "react-email"'),
    );
    assert.equal(
      await readFile(unrelated, "utf8"),
      'export const packageName = "@react-email/components";\n',
    );
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.edits[0].file, "src/lib/email-templates/signup.tsx");
    assert.equal(report.edits[0].replacements, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("removes the historical broad entities alias so modern dependency exports resolve", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "startup-alias-baseline-"));
  try {
    await mkdir(path.join(root, "src/lib"), { recursive: true });
    await writeFile(path.join(root, "src/lib/real-football.functions.ts"), "export {};\n");
    const specific =
      '  "entities/lib/decode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/decode.js"),\n';
    await writeFile(
      path.join(root, "vite.config.ts"),
      specific + '  entities: path.resolve(import.meta.dirname, "node_modules/entities"),\n',
    );
    const reportPath = path.join(root, "compatibility.json");
    await prepareStartupBaseline(root, reportPath);
    assert.equal(await readFile(path.join(root, "vite.config.ts"), "utf8"), specific);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.edits[0].file, "vite.config.ts");
    assert.equal(report.edits[0].replacements, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
