import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const page = ts.createSourceFile(
  "multiplayer.tsx",
  readFileSync(new URL("../../pages/multiplayer.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const live = ts.createSourceFile(
  "LiveRoom.tsx",
  readFileSync(new URL("./LiveRoom.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const heavyModules = [
  "@/components/game/Stadium3D",
  "@/game/device",
  "@/game/live-match",
  "@/game/quickMatch",
  "@/game/simWorkerClient",
];
const importsOf = (source: ts.SourceFile) =>
  source.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    !statement.importClause?.isTypeOnly
      ? [statement.moduleSpecifier.text]
      : [],
  );
function descendants(node: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = [];
  node.forEachChild((child) => {
    nodes.push(child, ...descendants(child));
  });
  return nodes;
}

describe("multiplayer lobby lazy boundary", () => {
  it("keeps the stadium and worker runtime out of static lobby imports", () => {
    const lobbyImports = importsOf(page);
    const runtimeImports = importsOf(live);
    for (const module of heavyModules) {
      expect(lobbyImports).not.toContain(module);
      expect(runtimeImports).toContain(module);
    }
    expect(lobbyImports).not.toContain("@/features/multiplayer/LiveRoom");
    const factory = descendants(page).find(
      (node) =>
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "lazy",
    );
    expect(factory).toBeDefined();
    expect(
      descendants(factory!).some(
        (node) =>
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.some(
            (argument) =>
              ts.isStringLiteral(argument) && argument.text === "@/features/multiplayer/LiveRoom",
          ),
      ),
    ).toBe(true);
  });

  it("renders the lazy runtime only inside the live-room branch with an announced loading fallback", () => {
    const branch = descendants(page).find(
      (node) =>
        ts.isIfStatement(node) &&
        node.expression.getText(page) === 'room && room.status === "live" && room.guest_club',
    );
    expect(branch).toBeDefined();
    const nodes = descendants(branch!);
    expect(
      nodes.some(
        (node) => ts.isJsxOpeningElement(node) && node.tagName.getText(page) === "Suspense",
      ),
    ).toBe(true);
    expect(
      nodes.some(
        (node) => ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === "LiveRoom",
      ),
    ).toBe(true);
    expect(
      nodes.some(
        (node) =>
          ts.isJsxAttribute(node) &&
          node.name.getText(page) === "role" &&
          node.initializer &&
          ts.isStringLiteral(node.initializer) &&
          node.initializer.text === "status",
      ),
    ).toBe(true);
    expect(page.getText()).toContain('t("common.loading")');
  });
});
