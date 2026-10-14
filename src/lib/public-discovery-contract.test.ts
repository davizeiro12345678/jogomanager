import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "./seo";
import { PUBLISHED_BASE_URL } from "./site-host";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("public site discovery contract", () => {
  it("keeps the canonical production URL consistent across source and documentation", () => {
    const readme = read("../../README.md");
    const llms = read("../../public/llms.txt");
    expect(PUBLISHED_BASE_URL).toBe(SITE_URL);
    expect(SITE_URL).toBe("https://jogomanager.com");
    expect(readme).toContain(`**Site oficial e endereço canônico:** ${SITE_URL}`);
    expect(llms).toContain(`Site oficial e endereço canônico: ${SITE_URL}`);
    expect(readme).not.toContain("**Live app**: https://stadium-stewards.lovable.app");
  });

  it("keeps llms.txt valid, scoped to real public sitemap paths, and free of retired domains", () => {
    const llms = read("../../public/llms.txt");
    const sitemap = read("../routes/sitemap[.]xml.ts");
    const paths = new Set([...sitemap.matchAll(/path: "([^"]+)"/g)].map((match) => match[1]));
    expect(llms).toMatch(/^# JogoManager\b/);
    expect(llms).toMatch(/\n> /);
    expect(llms).not.toMatch(/futebolmanager\.xyz/i);
    const hrefs = [...llms.matchAll(/\]\((https:\/\/jogomanager\.com(?:\/[^)]*)?)\)/g)].map(
      (match) => new URL(match[1]!).pathname,
    );
    expect(hrefs.length).toBeGreaterThan(10);
    for (const path of hrefs)
      expect(paths.has(path), `Missing canonical sitemap route: ${path}`).toBe(true);
    expect(llms).not.toMatch(/\]\(https?:\/\/localhost/i);
  });

  it("includes a discoverable plain-text llms resource in the document head", () => {
    const root = read("../routes/__root.tsx");
    expect(root).toContain('rel: "llms", type: "text/plain", href: "/llms.txt"');
    const robots = read("../routes/robots[.]txt.ts");
    expect(robots).toContain("publicBaseUrlFor as baseUrlFor");
    expect(robots).toContain("Sitemap:");
  });
});
