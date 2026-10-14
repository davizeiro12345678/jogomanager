import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "./seo";
import { PUBLISHED_BASE_URL } from "./site-host";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const llms = read("../../public/llms.txt");
const readme = read("../../README.md");
const sitemapSource = read("../routes/sitemap[.]xml.ts");

describe("llms.txt and canonical publication contract", () => {
  it("has one canonical domain across public docs and SEO config", () => {
    expect(SITE_URL).toBe("https://jogomanager.com");
    expect(PUBLISHED_BASE_URL).toBe(SITE_URL);
    expect(llms).toContain("Site oficial e endereço canônico: " + SITE_URL);
    expect(readme).toContain("**Site oficial e URL canônica:** " + SITE_URL);
    for (const source of [llms, readme]) {
      expect(source).not.toContain("https://futebolmanager.xyz");
      expect(source).not.toContain("**Live app**: https://stadium-stewards.lovable.app");
    }
  });

  it("publishes structured Markdown and only canonical internal discovery links", () => {
    expect(llms).toMatch(/^# .+\n/);
    expect(llms).toMatch(/\n> .+/);
    expect(llms).toContain("\n## Conheça o jogo\n");
    const indexed = new Set(
      [...sitemapSource.matchAll(/path: "([^"]+)"/g)].map((match) => match[1]),
    );
    const links = [...llms.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) {
      const url = new URL(link);
      expect(url.origin).toBe(SITE_URL);
      expect(indexed.has(url.pathname)).toBe(true);
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
    }
  });
});
