import { describe, expect, it } from "vitest";
import { capPointSize } from "./point-size-guard";

describe("capPointSize", () => {
  it("caps point sprites so a near particle can't fill the frame", () => {
    const shader = { vertexShader: "void main(){\n#include <fog_vertex>\n}" };
    capPointSize(6).onBeforeCompile(shader as never);
    expect(shader.vertexShader).toContain("gl_PointSize = min(gl_PointSize, 6.0);");
  });
});
