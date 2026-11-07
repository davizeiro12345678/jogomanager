import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tutorialCss = readFileSync(new URL("./career-tutorial.css", import.meta.url), "utf8");

describe("career tutorial keyboard focus", () => {
  it("restores focus after the modal trap closes, not inside the state-change callback", () => {
    const dialog = readFileSync(new URL("./CareerTutorialDialog.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("./GameShell.tsx", import.meta.url), "utf8");
    expect(dialog).toContain("onCloseAutoFocus={(event) => {");
    expect(dialog).toContain("if (onReturnFocus?.()) event.preventDefault();");
    expect(shell).toContain("restoreDialogFocus(");
    expect(shell).toContain('document.querySelector<HTMLElement>("main h1, #conteudo h1")');
    expect(shell).not.toContain("if (!open) tutorialTrigger.current?.focus();");
  });

  it("keeps the pending-filter checkbox visibly focusable", () => {
    expect(tutorialCss).toMatch(/\.career-guide :is\(a, button, input, summary\):focus-visible/);
    expect(tutorialCss).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\.career-guide :is\(a, button, input, summary\):focus-visible[\s\S]*outline-color:\s*Highlight/,
    );
  });
});
