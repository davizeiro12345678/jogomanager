import { describe, expect, it } from "vitest";
import { devtools } from "@tanstack/devtools-vite";
import type { Plugin } from "vite";
import { protectThreeSourceTags } from "../../scripts/r3f-source-compat";

describe("R3F dev inspector compatibility", () => {
  it("keeps DOM source inspection while preventing foreign properties on Three objects", async () => {
    const plugins = devtools({ injectSource: { enabled: true } });
    await protectThreeSourceTags({ plugins: [plugins] });
    const plugin = plugins.find(
      (item) => item.name === "@tanstack/devtools:inject-source",
    ) as Plugin;
    const transform = plugin.transform;
    if (!transform || typeof transform === "function") throw new Error("Missing source injector");
    const run = (code: string) => transform.handler.call({} as never, code, "src/test.tsx");
    expect(await run("export function Player() { return <group><mesh /></group>; }")).toBeNull();
    expect(
      await run(
        'import { Canvas } from "@react-three/fiber"; export function Studio() { return <Canvas />; }',
      ),
    ).toBeNull();
    const html = await run(
      "export function Panel() { return <section><h1>Visual</h1></section>; }",
    );
    expect(typeof html === "object" && html?.code).toContain("data-tsd-source");
  });
});
