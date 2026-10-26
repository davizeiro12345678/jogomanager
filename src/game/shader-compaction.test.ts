import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { compactThreeShader } from "../../scripts/compact-shader-source";

it("compacts shipping shader indentation while preserving every token, line and engine licence", () => {
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
  expect([...after.keys()]).toEqual([...before.keys()]);
  for (const [name, text] of before) {
    const previous = text.split("\n"),
      next = after.get(name)!.split("\n");
    expect(next).toHaveLength(previous.length);
    expect(next.join("\n").replace(/\s/g, "")).toBe(previous.join("\n").replace(/\s/g, ""));
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
