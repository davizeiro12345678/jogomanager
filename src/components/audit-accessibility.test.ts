import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = readFileSync(new URL("./RootLayout.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./game/GameShell.tsx", import.meta.url), "utf8");
const multiplayer = readFileSync(new URL("../pages/multiplayer.tsx", import.meta.url), "utf8");
const managerArticle = readFileSync(
  new URL("../pages/jogo-de-manager-de-futebol.tsx", import.meta.url),
  "utf8",
);

describe("audit regression guards", () => {
  it("has one root skip link with a career-content focus target", () => {
    expect(root).toContain('className="skip-to-content"');
    expect(root).toContain('document.getElementById("career-content")');
    expect(shell).not.toContain('className="career-skip"');
    expect(shell).toContain('id="career-content"');
  });
  it("exposes a single main landmark on the public manager article", () => {
    expect(managerArticle).toContain('<main className="pitch-bg min-h-dvh px-4 py-14">');
    expect(managerArticle.match(/<main\\b/g)).toHaveLength(1);
    expect(managerArticle.match(/<\\/main>/g)).toHaveLength(1);
  });
  it("explains which multiplayer mode is actually available without advertising unvalidated 2x2", () => {
    expect(multiplayer).toContain("copy.title");
    expect(multiplayer).toContain("copy.oneAvailable");
    expect(multiplayer).toContain("copy.twoPending");
    expect(multiplayer).toContain("copy.unavailable");
  });
});
