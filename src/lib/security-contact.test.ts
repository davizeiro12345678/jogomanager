import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const content = readFileSync(
  new URL("../../public/.well-known/security.txt", import.meta.url),
  "utf8",
);
const lines = content.trim().split("\n");

describe("security.txt disclosure contact", () => {
  it("uses the existing project contact and canonical well-known HTTPS location", () => {
    expect(lines).toContain("Contact: mailto:contato@jogomanager.com");
    expect(lines).toContain("Canonical: https://jogomanager.com/.well-known/security.txt");
    expect(lines).toContain("Preferred-Languages: pt-BR, en");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("contains one explicit RFC3339 expiry and requires refresh before becoming stale", () => {
    const expiry = lines.filter((line) => line.startsWith("Expires: "));
    expect(expiry).toHaveLength(1);
    expect(expiry[0]).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Date.parse(expiry[0]!.slice("Expires: ".length))).toBeGreaterThan(Date.now());
  });
});
