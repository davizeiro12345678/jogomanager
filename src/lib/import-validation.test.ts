import { describe, expect, it } from "vitest";
import { assertSafeJsonValue, MAX_IMPORT_BYTES, parseImportJson } from "./import-validation";
import { exportCustomJson, importCustomJson, previewCustomJson } from "./customData";
import { DEFAULT_MY_CLUB, exportClubPack, importClubPack } from "./myClub";

describe("untrusted editor and club packages", () => {
  it("rejects career backups and unrelated JSON instead of replacing editor data with emptiness", () => {
    const before = exportCustomJson();
    for (const text of [
      "{}",
      '{"kind":"pro-football-manager-3d-career","version":1,"career":{"managerName":"Davi"}}',
      '{"preferences":{"theme":"dark"}}',
    ]) {
      expect(previewCustomJson(text).ok).toBe(false);
      expect(importCustomJson(text).ok).toBe(false);
      expect(exportCustomJson()).toBe(before);
    }
  });
  it("validates a review package without replacing existing editor data", () => {
    const before = exportCustomJson();
    const preview = previewCustomJson(JSON.stringify({ clubs: {}, players: [], competitions: [] }));
    expect(preview).toEqual({ ok: true, data: { clubs: {}, players: [], competitions: [] } });
    expect(exportCustomJson()).toBe(before);
    expect(previewCustomJson('{"players":[null]}').ok).toBe(false);
    expect(exportCustomJson()).toBe(before);
  });
  it("counts UTF-8 bytes and bounds decoded career objects before persistence", () => {
    expect(() =>
      parseImportJson(JSON.stringify({ name: "中".repeat(MAX_IMPORT_BYTES / 3 + 1) })),
    ).toThrow();
    expect(() => assertSafeJsonValue({ name: "中".repeat(MAX_IMPORT_BYTES / 3 + 1) })).toThrow();
    expect(() =>
      assertSafeJsonValue(JSON.parse('{"history":{"__proto__":{"polluted":true}}}')),
    ).toThrow();
    const cycle: Record<string, unknown> = {};
    cycle["history"] = cycle;
    expect(() => assertSafeJsonValue(cycle)).toThrow();
    expect(() => assertSafeJsonValue({ budget: Infinity })).toThrow();
    expect(() =>
      assertSafeJsonValue({
        managerName: "João 李雷 محمد",
        history: [],
        settings: { theme: "dark" },
      }),
    ).not.toThrow();
    let deep: unknown = 0;
    for (let i = 0; i < 34; i++) deep = { nested: deep };
    expect(() => assertSafeJsonValue(deep)).toThrow();
    expect(() => parseImportJson("[".repeat(10_000) + "0" + "]".repeat(10_000))).toThrow(
      /complexo/,
    );
    expect(() => assertSafeJsonValue(Array.from({ length: 100_001 }, () => 0))).toThrow();
    expect(() => assertSafeJsonValue(new Array(100_001))).toThrow();
    expect(() => assertSafeJsonValue(new Array(3))).toThrow();
    expect(() =>
      assertSafeJsonValue({ note: "\u0000".repeat(MAX_IMPORT_BYTES / 6 + 1) }),
    ).toThrow();
  });
  it("rejects registry prototype attacks before mutating any world data", () => {
    for (const id of ["__proto__", "constructor", "prototype"]) {
      expect(importCustomJson(JSON.stringify({ clubs: { x: { id, name: "Attack" } } })).ok).toBe(
        false,
      );
      expect(importClubPack(exportClubPack({ ...DEFAULT_MY_CLUB, id, name: "Attack" }))).toBeNull();
    }
    expect(() => parseImportJson('{"clubs":{"__proto__":{"polluted":true}}}')).toThrow();
    expect((Object.prototype as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
  it("rejects malformed nested records, oversize input, and active image URLs", () => {
    for (const value of [
      { clubs: null },
      { clubs: [] },
      { players: [null] },
      { competitions: [null] },
      {
        players: [
          {
            id: "p",
            clubId: "c",
            name: "A",
            pos: "FW",
            age: 20,
            ovr: 90,
            contractYears: 3,
            wage: 2,
            value: 4,
            photo: "javascript:alert(1)",
          },
        ],
      },
    ]) {
      expect(importCustomJson(JSON.stringify(value)).ok).toBe(false);
    }
    expect(() => parseImportJson(" ".repeat(4 * 1024 * 1024 + 1))).toThrow();
    expect(() => parseImportJson("[".repeat(40) + "0" + "]".repeat(40))).toThrow();
  });
  it("retains valid club exports and rejects unbounded render parameters", () => {
    const club = { ...DEFAULT_MY_CLUB, id: "my-test", name: "Clube teste", short: "TST" };
    expect(importClubPack(exportClubPack(club))).toEqual(club);
    expect(
      importClubPack(exportClubPack({ ...club, stadium: { ...club.stadium, capacity: 1e12 } })),
    ).toBeNull();
    expect(importCustomJson('{"clubs":{},"players":[],"competitions":[]}').ok).toBe(true);
  });
});
