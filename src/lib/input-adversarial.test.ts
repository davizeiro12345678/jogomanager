import { describe, expect, it } from "vitest";
import { MAX_AI_REQUEST_BYTES, validAiRequest } from "./ai-request-validation";
import { validateRemotePlayers } from "./football-ingestion-validation";
import { assertSafeJsonValue, MAX_IMPORT_BYTES, parseImportJson } from "./import-validation";
import { reportSilent, silentReports } from "./report-silent";

describe("decoded save and import budgets", () => {
  it("admits the exact serialized-byte boundary and rejects one byte beyond it", () => {
    const payload = "a".repeat(MAX_IMPORT_BYTES - 2);
    expect(() => assertSafeJsonValue(payload)).not.toThrow();
    expect(() => assertSafeJsonValue(`${payload}a`)).toThrow(/4 MB/);
  });

  it("counts escaped control characters and multibyte text using their JSON representation", () => {
    expect(() => assertSafeJsonValue("\u0000".repeat(Math.ceil(MAX_IMPORT_BYTES / 6)))).toThrow(
      /4 MB/,
    );
    expect(() => assertSafeJsonValue("🧤".repeat(MAX_IMPORT_BYTES / 4))).toThrow(/4 MB/);
    expect(parseImportJson('{"name":"João 李雷 محمد","notes":"Destroy United"}')).toEqual({
      name: "João 李雷 محمد",
      notes: "Destroy United",
    });
  });

  it("rejects nonfinite numbers expressed as legal JSON numeric syntax", () => {
    expect(() => parseImportJson('{"budget":1e400}')).toThrow(/inválido/);
    expect(() => parseImportJson('{"budget":-1e400}')).toThrow(/inválido/);
  });

  it("accepts exactly 32 nested levels and rejects the next level without recursive overflow", () => {
    let payload: unknown = 0;
    for (let depth = 0; depth < 32; depth++) payload = [payload];
    expect(() => assertSafeJsonValue(payload)).not.toThrow();
    expect(() => assertSafeJsonValue([payload])).toThrow(/complexo/);
  });

  it("bounds decoded nodes and refuses cycles, typed views, and functions", () => {
    expect(() => assertSafeJsonValue(Array.from({ length: 99_999 }, () => 0))).not.toThrow();
    expect(() => assertSafeJsonValue(Array.from({ length: 100_000 }, () => 0))).toThrow(/complexo/);
    for (const invalid of [
      new Uint8Array(1),
      () => 1,
      { value: undefined },
      { value: Symbol("data") },
    ])
      expect(() => assertSafeJsonValue(invalid)).toThrow(/inválido/);
    const cycle: unknown[] = [];
    cycle.push(cycle);
    expect(() => assertSafeJsonValue(cycle)).toThrow(/referências/);
  });

  it("rejects every reserved registry key at depth while preserving the global prototype", () => {
    for (const key of ["__proto__", "prototype", "constructor"])
      expect(() =>
        parseImportJson(`{"career":{"history":{"${key}":{"qaPollution":true}}}}`),
      ).toThrow(/reservada/);
    expect((Object.prototype as Record<string, unknown>)["qaPollution"]).toBeUndefined();
  });
});

describe("bounded AI and provider inputs", () => {
  it("rejects an oversized aggregate although each individual AI message fits", () => {
    const first = "a".repeat(MAX_AI_REQUEST_BYTES / 2);
    const second = "b".repeat(MAX_AI_REQUEST_BYTES / 2);
    expect(
      validAiRequest([
        { role: "user", content: first },
        { role: "assistant", content: second },
      ]),
    ).toBe(true);
    expect(
      validAiRequest([
        { role: "user", content: first },
        { role: "assistant", content: `${second}b` },
      ]),
    ).toBe(false);
    expect(validAiRequest([{ role: "developer", content: "legal content with wrong role" }])).toBe(
      false,
    );
  });

  it("does not merge two distinct stable provider identifiers containing separators", () => {
    const result = validateRemotePlayers([
      { source: "provider:regional", externalId: "42", name: "Primeiro atleta", position: "MF" },
      { source: "provider", externalId: "regional:42", name: "Segundo atleta", position: "MF" },
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.accepted.map((p) => [p.source, p.externalId])).toEqual([
      ["provider:regional", "42"],
      ["provider", "regional:42"],
    ]);
  });

  it("keeps homonyms from different provider IDs and rejects only exact normalized duplicates", () => {
    const result = validateRemotePlayers([
      {
        source: " PROVIDER ",
        externalId: "1",
        name: "João Silva",
        position: "FW",
        birthDate: "2000-02-29",
      },
      {
        source: "provider",
        externalId: "2",
        name: "João Silva",
        position: "FW",
        birthDate: "2000-02-29",
      },
      { source: "provider", externalId: " 1 ", name: "João Silva", position: "FW" },
    ]);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toEqual([{ index: 2, reason: "duplicate-provider-id" }]);
  });

  it("never copies rejected provider payloads or unexpected secret fields to validation output", () => {
    const sentinel = "qa-synthetic-provider-private-value";
    const result = validateRemotePlayers([
      {
        source: "provider",
        externalId: "invalid",
        name: sentinel,
        position: "NOT_A_POSITION",
        token: sentinel,
      },
      {
        source: "provider",
        externalId: "valid",
        name: "Atleta válido",
        position: "GK",
        token: sentinel,
      },
    ]);
    expect(result.rejected).toEqual([{ index: 0, reason: "schema" }]);
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("rejects impossible birth dates and active image protocols before accepting provider rows", () => {
    const base = { source: "provider", externalId: "42", name: "Atleta", position: "GK" };
    for (const extra of [
      { birthDate: "2025-02-29" },
      { birthDate: "2000-02-30" },
      { age: Infinity },
      { photoUrl: "javascript:alert(1)" },
      { photoUrl: "http://images.example.test/player.jpg" },
    ]) {
      const result = validateRemotePlayers([{ ...base, ...extra }]);
      expect(result.accepted).toEqual([]);
      expect(result.rejected).toEqual([{ index: 0, reason: "schema" }]);
    }
  });
});

describe("observable errors keep synthetic credentials private", () => {
  it("redacts client secrets in diagnostic messages and allowed source metadata", () => {
    const sentinel = "qa-synthetic-client-secret-value";
    const scope = "adversarial-secrets";
    reportSilent(scope, `Checkout failed: client_secret=${sentinel}`, {
      class: "degradation",
      code: "privacy-fixture",
      source: `https://api.example.test/?client_secret=${sentinel}`,
    });
    const report = silentReports().find((entry) => entry.scope === scope)!;
    expect(report).toBeDefined();
    expect(JSON.stringify(report)).not.toContain(sentinel);
  });
});
