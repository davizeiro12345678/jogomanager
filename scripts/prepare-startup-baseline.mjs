import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Historical Start sources use the old name for this identical validator API.
// Keep the measured dependency tree identical, and disclose this compatibility
// edit instead of profiling the baseline's HTTP 500 error response.
export async function prepareStartupBaseline(root, reportPath) {
  let reportExists = false;
  try {
    await access(reportPath);
    reportExists = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (reportExists)
    throw new Error(
      "Baseline compatibility report already exists; use a fresh baseline and report path",
    );

  const templateDirectory = "src/lib/email-templates";
  let templates = [];
  try {
    templates = (await readdir(path.join(root, templateDirectory)))
      .filter((file) => file.endsWith(".tsx"))
      .sort()
      .map((file) => `${templateDirectory}/${file}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const hash = (source) => createHash("sha256").update(source).digest("hex");
  const edits = [];
  const files = ["src/lib/real-football.functions.ts", ...templates];
  try {
    await access(path.join(root, "vite.config.ts"));
    files.push("vite.config.ts");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const file of files) {
    const filename = path.join(root, file);
    const before = await readFile(filename, "utf8");
    const pattern =
      file === "vite.config.ts"
        ? /^[\t ]*entities: path\.resolve\(import\.meta\.dirname, (["'])node_modules\/entities\1\),?\r?\n/gm
        : file.endsWith(".tsx")
          ? /from (["'])@react-email\/components\1/g
          : /\.inputValidator\(/g;
    const replacements = [...before.matchAll(pattern)].length;
    if (!replacements) continue;
    const after =
      file === "vite.config.ts"
        ? before.replaceAll(pattern, "")
        : file.endsWith(".tsx")
          ? before.replaceAll(pattern, (_match, quote) => `from ${quote}react-email${quote}`)
          : before.replaceAll(pattern, ".validator(");
    edits.push({ file, replacements, beforeSha256: hash(before), afterSha256: hash(after) });
    await writeFile(filename, after);
  }
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        reason:
          "Compatibility-only TanStack validator rename, React Email imports and obsolete entities alias removal",
        measurement:
          "same installed dependency tree; no handler, validation-schema or email-template changes",
        edits,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, reportPath] = process.argv.slice(2);
  if (!root || !reportPath) throw new Error("Expected BASELINE_DIR REPORT_JSON");
  await prepareStartupBaseline(root, reportPath);
}
