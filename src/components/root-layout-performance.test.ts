import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isLightweightCssPath, isPublicContentPath } from "@/lib/public-content-routes";

const rootLayout = fileURLToPath(new URL("./RootLayout.tsx", import.meta.url));
const source = fs.readFileSync(rootLayout, "utf8");

describe("root deferred work on lightweight routes", () => {
  it("mounts the optional toaster only through the route-aware guard", () => {
    expect(source).toContain("function shouldMountDeferredToaster(pathname: string)");
    expect(source).toContain("{shouldMountDeferredToaster(pathname) ? <DeferredToaster /> : null}");
    expect(source).toContain('return !isLightweightCssPath(path) || path === "/produtos";');
  });

  it("keeps gameplay metadata independent from the lightweight CSS decision", () => {
    expect(isLightweightCssPath("/partida-rapida")).toBe(true);
    expect(isPublicContentPath("/partida-rapida")).toBe(false);
    expect(isPublicContentPath("/guias")).toBe(true);
    expect(source).toContain("if (isPublicContentPath(pathname)) return;");
    expect(source).not.toContain("if (isLightweightCssPath(pathname)) return;");
  });
});
