import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PlayerRig frame scheduling", () => {
  it("registers one frame callback in the extracted hook, not the React composition", async () => {
    const frameModule = await readFile(new URL("./player-rig-frame.ts", import.meta.url), "utf8");
    const rigModule = await readFile(new URL("./PlayerRig.tsx", import.meta.url), "utf8");

    expect(frameModule.match(/\buseFrame\s*\(/g)).toHaveLength(1);
    expect(rigModule).not.toMatch(/\buseFrame\s*\(/);
  });
});
