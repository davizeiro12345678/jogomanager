import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { compactThreeShader } from "../../scripts/compact-shader-source";

it("removes only standalone GLSL comments, retaining line boundaries, inline comments and licensed chunks", () => {
  const file = "/project/node_modules/three/build/three.module.js";
  const shader =
    "#define X 1\n  // ordinary shader explanation\nfloat x = 1.; // inline\n/* block\n// inside block */\nfloat y = x;";
  const source = `const shader = ${JSON.stringify(shader)}; const ShaderChunk = {shader};`;
  const output = compactThreeShader(source, file)!;
  expect(output).not.toContain("ordinary shader explanation");
  expect(output).toContain("// inline");
  expect(output).toContain("// inside block */");
  const licensed =
    'const shader = "// Copyright Example\\n  float x = 1.;"; const ShaderChunk = {shader};';
  expect(compactThreeShader(licensed, file)).toBeNull();
});

it("compacts shipping shader trivia while preserving every executable token, line and engine licence", () => {
  const file = path.resolve("node_modules/three/build/three.module.js"),
    source = readFileSync(file, "utf8");
  const result = compactThreeShader(source, file)!;
  expect(result.length).toBeLessThan(source.length - 1000);
  expect(result.split("*/")[0]).toBe(source.split("*/")[0]);
  const literals = (code: string) => {
    const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
    return new Map(
      ast.statements
        .flatMap((s) => (ts.isVariableStatement(s) ? [...s.declarationList.declarations] : []))
        .flatMap((d) =>
          d.initializer && ts.isStringLiteralLike(d.initializer)
            ? [[d.name.getText(ast), d.initializer.text] as const]
            : [],
        ),
    );
  };
  const before = literals(source),
    after = literals(result);
  // Independent lexical comparison; comments are trivia, executable tokens
  // and preprocessor line boundaries must remain exactly equivalent.
  const tokens = (text: string) =>
    text
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, " ")
      .match(
        /[A-Za-z_]\w*|(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?[uUfF]?|<<|>>|<=|>=|==|!=|\+\+|--|&&|\|\||\+=|-=|\*=|\/=|%=|&=|\|=|\^=|[^\s]/g,
      );
  expect([...after.keys()]).toEqual([...before.keys()]);
  for (const [name, text] of before) {
    const previous = text.split("\n"),
      next = after.get(name)!.split("\n");
    expect(next).toHaveLength(previous.length);
    expect(tokens(next.join("\n"))).toEqual(tokens(previous.join("\n")));
  }
});
it("leaves interpolation, escaped shaders and non-shader modules untouched", () => {
  expect(
    compactThreeShader(
      "const x = `value ${dynamic}`; const ShaderChunk = {x};",
      "/project/node_modules/three/build/three.module.js",
    ),
  ).toBeNull();
  expect(compactThreeShader('export default "data";', "/project/src/app.ts")).toBeNull();
});
