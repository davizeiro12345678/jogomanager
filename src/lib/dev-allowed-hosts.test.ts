import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveDevAllowedHosts } from "./dev-allowed-hosts";

describe("Vite development host policy", () => {
  it("defaults to no additional hosts", () => {
    expect(resolveDevAllowedHosts(undefined)).toEqual([]);
  });

  it("normalizes and deduplicates explicitly authorized hosts", () => {
    expect(resolveDevAllowedHosts(" preview.e2b.app, PREVIEW.E2B.APP, other.example ")).toEqual([
      "preview.e2b.app",
      "other.example",
    ]);
  });

  it("rejects wildcards, suffixes, URLs and host-port syntax", () => {
    for (const host of [
      "*",
      ".e2b.app",
      "*.e2b.app",
      "https://example.com",
      "example.com:443",
      "a..b",
      "-example.com",
    ]) {
      expect(() => resolveDevAllowedHosts(host)).toThrow();
    }
  });

  it("wires the restrictive policy into Vite instead of allowing all hosts", () => {
    const source = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/allowedHosts:\s*true/);
    expect(source).toMatch(/allowedHosts:\s*resolveDevAllowedHosts\(/);
  });
});
