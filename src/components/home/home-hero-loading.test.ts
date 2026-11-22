import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("home hero critical image contract", () => {
  const home = readFileSync(new URL("./FootballHome.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../routes/index.tsx", import.meta.url), "utf8");
  it("keeps the hero eagerly discoverable, prioritised and asynchronously decoded", () => {
    expect(home).toContain("srcSet={heroMobileAvif}");
    expect(home).toContain("srcSet={heroAvif}");
    expect(home).toContain('fetchPriority="high"');
    expect(home).toContain('decoding="async"');
    expect(home).not.toContain('decoding="sync"');
  });
  it("preserves viewport-specific hero preload and explicit mobile dimensions", () => {
    expect(route).toContain('rel: "preload"');
    expect(route).toContain("imageSrcSet: heroMobileAvif");
    expect(route).toContain('media: "(max-width: 640px)"');
    expect(route).toContain('fetchPriority: "high"');
    expect(home).toContain("width={1600}");
    expect(home).toContain("height={912}");
  });
});
