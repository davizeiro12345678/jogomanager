import { describe, expect, it } from "vitest";

type ProbeContext = {
  getExtension(name: string): { loseContext(): void } | null;
};

type ProbeCanvas = {
  getContext(kind: "webgl2" | "webgl"): ProbeContext | null;
};

type SupportsWebGL = (createCanvas: () => ProbeCanvas) => boolean;

async function loadSupportsWebGL(): Promise<SupportsWebGL | undefined> {
  // The module is intentionally loaded by its eventual public path so this
  // test begins red before the browser capability gate exists.
  const modulePath = "./webgl-" + "support";
  const module = await import(modulePath).catch(() => undefined);
  return module?.supportsWebGL as SupportsWebGL | undefined;
}

describe("supportsWebGL", () => {
  it("returns false when WebGL2 cannot be created even if WebGL1 exists", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    const probes: string[] = [];
    const webgl1: ProbeContext = { getExtension: () => null };
    expect(
      supportsWebGL?.(() => ({
        getContext(kind) {
          probes.push(kind);
          return kind === "webgl" ? webgl1 : null;
        },
      })),
    ).toBe(false);
    expect(probes).toEqual(["webgl2"]);
  });

  it("releases a successful temporary WebGL2 probe", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    let released = false;
    const probes: string[] = [];
    const context: ProbeContext = {
      getExtension(name) {
        return name === "WEBGL_lose_context" ? { loseContext: () => (released = true) } : null;
      },
    };

    expect(
      supportsWebGL?.(() => ({
        getContext(kind) {
          probes.push(kind);
          return kind === "webgl2" ? context : null;
        },
      })),
    ).toBe(true);
    expect(probes).toEqual(["webgl2"]);
    expect(released).toBe(true);
  });

  it("returns false when probing the canvas throws", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    expect(
      supportsWebGL?.(() => ({
        getContext: () => {
          throw new Error("GPU disabled");
        },
      })),
    ).toBe(false);
  });
});
