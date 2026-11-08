import { describe, expect, it } from "vitest";

import { PUBLIC_PAGE_REDIRECTS } from "./public-page-redirects";
import { PUBLIC_PAGE_INVENTORY } from "./public-page-inventory";

const PRIVATE_OR_TRANSACTIONAL_PATHS = [
  "/api/health",
  "/auth",
  "/cadastro",
  "/checkout/return",
  "/compras",
  "/editor",
  "/carreira",
] as const;

describe("canonical public page inventory", () => {
  it("contains one slash-free entry for every sitemap page", () => {
    const paths = PUBLIC_PAGE_INVENTORY.map(({ path }) => path);
    expect(paths).toHaveLength(34);
    expect(new Set(paths)).toHaveLength(paths.length);
    expect(paths.every((path) => path === "/" || !path.endsWith("/"))).toBe(true);
  });

  it("excludes retired aliases and private or transactional surfaces", () => {
    const paths: ReadonlySet<string> = new Set(PUBLIC_PAGE_INVENTORY.map(({ path }) => path));
    for (const alias of Object.keys(PUBLIC_PAGE_REDIRECTS)) expect(paths.has(alias)).toBe(false);
    for (const path of PRIVATE_OR_TRANSACTIONAL_PATHS) expect(paths.has(path)).toBe(false);
  });
});
