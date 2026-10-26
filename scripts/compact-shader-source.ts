import type { Plugin } from "vite";
import ts from "typescript";

/** Compact registered GLSL trivia while preserving executable tokens and lines. */
export function compactThreeShader(source: string, id: string): string | null {
  if (/[\\/]node_modules[\\/]three[\\/]build[\\/]three\.(?:module|core)\.js$/.test(id)) {
    const file = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
    const declarations = file.statements.flatMap((statement) =>
      ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [],
    );
    const registry = declarations.find(
      (declaration) => declaration.name.getText(file) === "ShaderChunk",
    )?.initializer;
    if (!registry || !ts.isObjectLiteralExpression(registry)) return null;
    const names = new Set(
      registry.properties.flatMap((property) =>
        ts.isShorthandPropertyAssignment(property)
          ? [property.name.text]
          : ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)
            ? [property.initializer.text]
            : [],
      ),
    );
    const replacements: { start: number; end: number; value: string }[] = [];
    for (const declaration of declarations) {
      const literal = declaration.initializer;
      if (
        !names.has(declaration.name.getText(file)) ||
        !literal ||
        !ts.isStringLiteralLike(literal)
      )
        continue;
      const value = compactLiteral(literal.text);
      if (value !== null)
        replacements.push({
          start: literal.getStart(file),
          end: literal.end,
          value: JSON.stringify(value),
        });
    }
    if (!replacements.length) return null;
    for (const edit of replacements.reverse())
      source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
    return source;
  }
  return null;
}

function compactLiteral(shader: string): string | null {
  // Keep licensed chunks intact. Quoted/escaped preprocessor text is outside
  // this small lexer. Never join or remove source lines.
  if (
    /[\\\"']/.test(shader) ||
    /copyright|licen[cs]e|spdx|permission|warranty|all rights|\b(?:CC0|CC-BY|MIT|BSD)\b/i.test(
      shader,
    )
  )
    return null;
  let block = false;
  const value = shader
    .split("\n")
    .map((line) => {
      if (!block && /^\s*\/\//.test(line)) return "";
      for (let i = 0; i < line.length - 1; i++) {
        const pair = line.slice(i, i + 2);
        if (!block && pair === "//") break;
        if (!block && pair === "/*") {
          block = true;
          i++;
        } else if (block && pair === "*/") {
          block = false;
          i++;
        }
      }
      return line.trimStart();
    })
    .join("\n");
  return value === shader ? null : value;
}

export function compactShaderSource(): Plugin {
  return {
    name: "pfm-compact-static-shader-source",
    apply: "build",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.config.consumer === "client",
    transform(source, id) {
      const code = compactThreeShader(source, id);
      return code === null ? null : { code, map: null };
    },
  };
}
