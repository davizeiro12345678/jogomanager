import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const worker = ts.createSourceFile(
  "match.worker.ts",
  readFileSync(new URL("./match.worker.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const view = ts.createSourceFile(
  "live-match.ts",
  readFileSync(new URL("./live-match.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

describe("worker startup lazy simulation boundary", () => {
  it("keeps the heavyweight simulator out of static worker and view dependencies", () => {
    for (const source of [worker, view]) {
      const eagerSimulator = source.statements.filter(
        (node) =>
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text === "./sim" &&
          !node.importClause?.isTypeOnly &&
          (node.importClause?.namedBindings === undefined ||
            (ts.isNamedImports(node.importClause.namedBindings) &&
              node.importClause.namedBindings.elements.some((element) => !element.isTypeOnly))),
      );
      expect(eagerSimulator).toEqual([]);
    }
  });

  it("loads the canonical simulator only upon a match start or batch simulation", () => {
    const source = worker.getFullText();
    expect(source).toContain('const { MatchSim } = await import("./sim");');
    expect(source.split('const { MatchSim } = await import("./sim");')).toHaveLength(3);
    expect(source).toContain('from "./sim-contracts"');
    expect(source).toContain('import type { MatchSim } from "./sim";');
  });
});
