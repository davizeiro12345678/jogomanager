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

it("keeps the full catalog and named player rosters out of quick-match startup", () => {
  const visited = new Set<string>();
  visitStaticImports(entry, visited);
  const startupSources = [...visited].map((file) =>
    path.relative(projectRoot, file).replaceAll("\\", "/"),
  );

  // The route loads QuickMatchPage asynchronously: even the small league
  // directory must stay outside the eagerly imported route module.
  expect(startupSources).not.toContain("src/components/game/QuickMatchPage.tsx");
  expect(startupSources).not.toContain("src/game/data/quick-match-catalog.ts");

  // Once the selection page loads, only the lightweight directory is eager.
  // Named rosters, complete leagues, and 3D assets remain on-demand.
  const pageEntry = fileURLToPath(
    new URL("../components/game/QuickMatchPage.tsx", import.meta.url),
  );
  const pageVisited = new Set<string>();
  visitStaticImports(pageEntry, pageVisited);
  const pageSources = [...pageVisited].map((file) =>
    path.relative(projectRoot, file).replaceAll("\\", "/"),
  );
  expect(pageSources).toContain("src/game/data/quick-match-catalog.ts");
  for (const sources of [startupSources, pageSources]) {
    expect(sources).not.toContain("src/game/data/leagues.ts");
    expect(sources).not.toContain("src/game/data/squads.ts");
    expect(sources).not.toContain("src/game/data/names.ts");
    expect(sources).not.toContain("src/lib/official-assets-loader.ts");
  }
});
