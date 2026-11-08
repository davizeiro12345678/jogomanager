import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const screensCss = readFileSync(new URL("./career-screens.css", import.meta.url), "utf8");
const createCss = readFileSync(new URL("./career-create.css", import.meta.url), "utf8");
const shellCss = readFileSync(new URL("./career-shell.css", import.meta.url), "utf8");
const contentCss = readFileSync(new URL("./career-content-shell.css", import.meta.url), "utf8");
const interfaceCss = readFileSync(new URL("./career-interface.css", import.meta.url), "utf8");

describe("career CSS keyboard focus", () => {
  it("does not suppress the visible focus indicator on a focused career heading", () => {
    expect(screensCss).not.toMatch(/\.career-content h1:focus\s*\{[^}]*outline:\s*none/s);
    expect(createCss).toMatch(/\.career-step-heading h2:focus-visible\s*\{/);
    expect(createCss).not.toMatch(/\.career-step-heading h2:focus\s*\{/);
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
    expect(createCss).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\.career-create[\s\S]*outline-color:\s*Highlight/s,
    );
    expect(screensCss).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*aria-selected="true"[\s\S]*outline:\s*2px solid Highlight/s,
    );
  });

  it("consolidates career cascade and disables motion without hiding state", () => {
    expect(createCss.match(/^\.career-identity \{/gm)).toHaveLength(1);
    expect(createCss.match(/^\.career-portrait \{/gm)).toHaveLength(1);
    expect(screensCss.match(/^@media\s*\(prefers-reduced-motion:\s*reduce\)/gm)).toHaveLength(1);
    expect(createCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*scroll-behavior:\s*auto\s*!important/s,
    );
    expect(screensCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*scroll-behavior:\s*auto\s*!important/s,
    );
  });

  it("keeps the career stylesheet import contract explicit", () => {
    expect(interfaceCss).toMatch(
      /@import "\.\/career-shell\.css";\s*@import "\.\/career-office-shell\.css";\s*@import "\.\/career-content-shell\.css";\s*@import "\.\/career-typography-shell\.css";\s*@import "\.\/career-interaction\.css";\s*@import "\.\/career-screens\.css";/s,
    );
  });

  it("keeps the portrait breakpoint after the desktop portrait sizing", () => {
    const desktopPortrait = createCss.indexOf(".career-portrait {\n  min-height: 240px;");
    const tabletMedia = createCss.indexOf("@media (max-width: 850px)");
    const tabletPortrait = createCss.indexOf(
      ".career-portrait {\n    min-height: 190px;",
      tabletMedia,
    );

    expect(desktopPortrait).toBeGreaterThanOrEqual(0);
    expect(tabletMedia).toBeGreaterThan(desktopPortrait);
    expect(tabletPortrait).toBeGreaterThan(tabletMedia);
  });

  it("does not duplicate the broad table-row hover over the content hover source", () => {
    expect(contentCss).toMatch(/\.career-content table tbody tr:hover\s*\{/);
    expect(screensCss).not.toMatch(/\.career-shell table tbody tr:hover\s*\{/);
  });

  it("covers creation forced-colors and reduced-motion preferences", () => {
    expect(createCss).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\.career-create :is\(button, a, input, select\):focus-visible[\s\S]*outline-color:\s*Highlight/s,
    );
    expect(createCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.career-create,\s*\.career-create \*[\s\S]*animation:\s*none\s*!important[\s\S]*transition:\s*none\s*!important[\s\S]*scroll-behavior:\s*auto\s*!important/s,
    );
    expect(screensCss.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g) ?? []).toHaveLength(
      1,
    );
  });
});
