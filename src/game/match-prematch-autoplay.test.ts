import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("prematch cinematic to live kickoff", () => {
  it("automatically advances prematch lines to the referee's whistle", () => {
    const source = readFileSync(new URL("../pages/match.tsx", import.meta.url), "utf8");
    const scene = source.indexOf("scene={PREMATCH_SCENE_IDS[introStep]!}");
    expect(scene).toBeGreaterThan(-1);
    expect(source.slice(scene, scene + 450)).toMatch(/\bautoPlay\b/);
  });
});

describe("prematch input ownership", () => {
  it("does not let global match shortcuts operate during visual gates", () => {
    const source = readFileSync(new URL("../pages/match.tsx", import.meta.url), "utf8");
    const shortcuts = source.slice(source.indexOf("// Atalhos de teclado"));
    expect(shortcuts).toMatch(
      /if \(introActive \|\| ceremonyActive \|\| e.defaultPrevented\) return/,
    );
    expect(shortcuts).toContain("[camera, chooseCamera, skip, introActive, ceremonyActive]");
  });

  it("does not advance a newer intro scene on duplicate completion of an old scene", () => {
    const source = readFileSync(new URL("../pages/match.tsx", import.meta.url), "utf8");
    expect(source).toContain("setIntroStep((s) => (s === introStep ? s + 1 : s))");
  });

  it("routes ceremony keyboard skip through the same once-only completion as the buttons", () => {
    const source = readFileSync(
      new URL("../components/game/PrematchCeremony.tsx", import.meta.url),
      "utf8",
    );
    const keyboard = source.slice(
      source.indexOf("// Enter/Espaço"),
      source.indexOf('window.addEventListener("keydown", onKey)'),
    );
    expect(keyboard).toContain("completionRef.current?.complete()");
    expect(keyboard).not.toContain("doneRef.current()");
    expect(keyboard).toContain("e.defaultPrevented");
    expect(keyboard).toContain('closest("button, input, select, textarea, a, [contenteditable');
  });
});
