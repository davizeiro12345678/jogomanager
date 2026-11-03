import { beforeEach, describe, expect, it } from "vitest";
import { claimCareerReturn, markCareerCreatedThisSession } from "./career-analytics-id";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe("career return detection", () => {
  beforeEach(() => {
    globalThis.sessionStorage = memoryStorage();
  });
  it("counts a saved career once per browser session", () => {
    expect(claimCareerReturn("coach", "abc")).toBe(true);
    expect(claimCareerReturn("coach", "abc")).toBe(false);
  });
  it("does not count a career created in this session", () => {
    markCareerCreatedThisSession("player", "slot-1");
    expect(claimCareerReturn("player", "slot-1")).toBe(false);
  });
  it("counts again in a new session", () => {
    expect(claimCareerReturn("coach", "abc")).toBe(true);
    globalThis.sessionStorage = memoryStorage();
    expect(claimCareerReturn("coach", "abc")).toBe(true);
  });
});
