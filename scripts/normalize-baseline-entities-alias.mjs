import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This helper is preserved in RUNNER_TEMP across the baseline checkout. Resolve
// its parser from the installed, shared dependency graph in the working tree.
const ts = createRequire(path.resolve("package.json"))("typescript");
const fail = (reason) => {
  throw new Error(`Baseline entities alias contract changed: ${reason}`);
};
const nameOf = (node) =>
  ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;

function isKnownTarget(expression, target) {
  if (!ts.isCallExpression(expression) || expression.arguments.length !== 2) return false;
  const callee = expression.expression;
  if (
    !ts.isPropertyAccessExpression(callee) ||
    !ts.isIdentifier(callee.expression) ||
    callee.expression.text !== "path" ||
    callee.name.text !== "resolve"
  )
    return false;
  const [directory, destination] = expression.arguments;
  return (
    ts.isPropertyAccessExpression(directory) &&
    directory.name.text === "dirname" &&
    ts.isMetaProperty(directory.expression) &&
    directory.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    directory.expression.name.text === "meta" &&
    ts.isStringLiteral(destination) &&
    destination.text === target
  );
}

// Accept only the two known subpath aliases and the optional, exact legacy bare
// alias. Missing, duplicated or dynamic aliases require a reviewed new contract.
export function normalizeBaselineEntitiesAlias(source) {
  const file = ts.createSourceFile("vite.config.ts", source, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) fail("invalid TypeScript");
  const resolvers = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && nameOf(node.name) === "resolve") resolvers.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (resolvers.length !== 1 || !ts.isObjectLiteralExpression(resolvers[0].initializer))
    fail("expected one literal resolve object");
  const aliasProperties = resolvers[0].initializer.properties.filter(
    (property) => ts.isPropertyAssignment(property) && nameOf(property.name) === "alias",
  );
  if (aliasProperties.length !== 1 || !ts.isObjectLiteralExpression(aliasProperties[0].initializer))
    fail("expected one literal alias object");
  const properties = new Map();
  for (const property of aliasProperties[0].initializer.properties) {
    if (!ts.isPropertyAssignment(property) || nameOf(property.name) === undefined)
      fail("dynamic alias property");
    const name = nameOf(property.name);
    if (properties.has(name)) fail(`duplicate ${name}`);
    properties.set(name, property);
  }
  for (const subpath of ["entities/lib/decode.js", "entities/lib/encode.js"]) {
    const property = properties.get(subpath);
    if (!property || !isKnownTarget(property.initializer, `node_modules/${subpath}`))
      fail(`unexpected or missing ${subpath}`);
  }
  for (const name of properties.keys())
    if (
      name.startsWith("entities/") &&
      !["entities/lib/decode.js", "entities/lib/encode.js"].includes(name)
    )
      fail(`unexpected ${name}`);
  const bare = properties.get("entities");
  if (!bare) return { source, changed: false, status: "already-compatible" };
  if (!isKnownTarget(bare.initializer, "node_modules/entities")) fail("unexpected bare target");
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    source,
  );
  scanner.setTextPos(bare.end);
  const end = scanner.scan() === ts.SyntaxKind.CommaToken ? scanner.getTextPos() : bare.end;
  const normalized = source.slice(0, bare.getStart(file)) + source.slice(end);
  return { source: normalized, changed: true, status: "legacy-bare-alias-removed" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.resolve(process.argv[2] ?? "vite.config.ts");
  const result = normalizeBaselineEntitiesAlias(readFileSync(file, "utf8"));
  if (result.changed) writeFileSync(file, result.source);
  process.stdout.write(
    `${JSON.stringify({ file, changed: result.changed, status: result.status })}\n`,
  );
}
