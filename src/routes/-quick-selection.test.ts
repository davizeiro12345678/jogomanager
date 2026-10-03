import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

const entry = fileURLToPath(new URL("./partida-rapida.tsx", import.meta.url));
const sourceRoot = path.resolve(path.dirname(entry), "..");
const projectRoot = path.resolve(sourceRoot, "..");
const extensions = [".ts", ".tsx", ".js", ".jsx"];

function resolveLocalImport(specifier: string, importer: string): string | null {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const base = specifier.startsWith("@/")
    ? path.resolve(sourceRoot, specifier.slice(2))
    : path.resolve(path.dirname(importer), specifier);
  const candidates = [
    base,
    ...extensions.map((extension) => base + extension),
    ...extensions.map((extension) => path.join(base, "index" + extension)),
  ];
  return (
    candidates.find((candidate) => {
      const extension = path.extname(candidate);
      return (
        extensions.includes(extension) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      );
    }) ?? null
  );
}

function visitStaticImports(file: string, visited: Set<string>) {
  if (visited.has(file)) return;
  visited.add(file);
  const source = fs.readFileSync(file, "utf8");
  const kind =
    file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.importClause?.isTypeOnly
    ) {
      const target = resolveLocalImport(node.moduleSpecifier.text, file);
      if (target) visitStaticImports(target, visited);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      const target = resolveLocalImport(node.moduleSpecifier.text, file);
      if (target) visitStaticImports(target, visited);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
}

it("keeps named player rosters out of the quick-match selection's static imports", () => {
  const visited = new Set<string>();
  visitStaticImports(entry, visited);
  const startupSources = [...visited].map((file) =>
    path.relative(projectRoot, file).replaceAll("\\", "/"),
  );

  expect(startupSources).toContain("src/game/data/leagues.ts");
  expect(startupSources).not.toContain("src/game/data/squads.ts");
  expect(startupSources).not.toContain("src/game/data/names.ts");
});
