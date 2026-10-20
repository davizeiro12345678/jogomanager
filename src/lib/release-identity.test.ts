import { describe, expect, it } from "vitest";
import { resolveBuildCommit } from "./release-identity";

const head = "0123456789abcdef0123456789abcdef01234567";
const other = "fedcba9876543210fedcba9876543210fedcba98";

describe("release commit identity", () => {
  it("uses the checked-out revision for a normal Git build", () => {
    expect(resolveBuildCommit(undefined, head)).toBe(head);
  });
  it("accepts an explicitly requested revision only when it matches the checkout", () => {
    expect(resolveBuildCommit(head, head)).toBe(head);
    expect(() => resolveBuildCommit(other, head)).toThrow(/does not match the checkout/);
  });
  it("supports an explicitly identified source archive without Git metadata", () => {
    expect(resolveBuildCommit(head, null)).toBe(head);
  });
  it("does not fabricate identity for an unidentified local archive", () => {
    expect(resolveBuildCommit(undefined, null)).toBeNull();
  });
  it("does not label an edited working tree as its last committed revision", () => {
    expect(resolveBuildCommit(undefined, head, true)).toBeNull();
  });
  it("refuses a production identity when tracked or untracked sources differ", () => {
    expect(() => resolveBuildCommit(head, head, true)).toThrow(/uncommitted/);
  });
  it.each(["", "main", "0123456", "https://example.test", "x".repeat(40)])(
    "rejects an invalid requested identity: %s",
    (value) => {
      expect(() => resolveBuildCommit(value, head)).toThrow(/full 40-character/);
    },
  );
});
