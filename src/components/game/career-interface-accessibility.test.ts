import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const screensCss = readFileSync(new URL("./career-screens.css", import.meta.url), "utf8");
const createCss = readFileSync(new URL("./career-create.css", import.meta.url), "utf8");
const shellCss = readFileSync(new URL("./career-shell.css", import.meta.url), "utf8");

describe("career CSS keyboard focus", () => {
  it("does not suppress the visible focus indicator on a focused career heading", () => {
    expect(screensCss).not.toMatch(/\.career-content h1:focus\s*\{[^}]*outline:\s*none/s);
  });

  it("provides an explicit focus-visible indicator for the career search field", () => {
    expect(createCss).toMatch(/\.career-search:focus-within\s*\{[^}]*outline:/s);
  });

  it("keeps narrow-screen career navigation shrinkable and forced-colors focusable", () => {
    expect(createCss).toMatch(/\.career-steps li\s*\{[^}]*min-width:\s*0/s);
    expect(createCss).toMatch(/\.career-steps button b\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    expect(shellCss).toMatch(
      /\.career-current-page\s*\{[^}]*min-width:\s*0;[^}]*flex:\s*1 1 auto/s,
    );
    expect(shellCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none\s*!important/s,
    );
    expect(shellCss).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*outline-color:\s*Highlight/s,
    );
  });
});
