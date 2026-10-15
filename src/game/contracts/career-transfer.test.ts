import { describe, expect, it } from "vitest";
import { initCareer } from "../career";
import {
  CAREER_TRANSFER_KIND,
  exportCareerFile,
  importCareerFile,
  MAX_CAREER_TRANSFER_BYTES,
} from "./career-transfer";

const career = initCareer("bra", "fla", "Davi");

describe("career transfer contract", () => {
  it("keeps a valid transfer on the bounded import path", () => {
    const file = exportCareerFile(career);
    expect(importCareerFile(file).managerName).toBe("Davi");
  });

  it("rejects modified files", () => {
    const exported = exportCareerFile(career).replace("Davi", "Outro");
    expect(() => importCareerFile(exported)).toThrow(/alterado/);
  });

  it("rejects a malformed JSON document without exposing parser details", () => {
    expect(() => importCareerFile('{"career":')).toThrow("Arquivo inválido: não é um JSON válido.");
  });

  it("rejects an oversized UTF-8 file before parsing it", () => {
    const oversized = "é".repeat(Math.floor(MAX_CAREER_TRANSFER_BYTES / 2) + 1);
    expect(() => importCareerFile(oversized)).toThrow(/excede o limite/);
  });

  it("rejects prototype-polluting keys before checksum serialization", () => {
    const poisoned = `{"kind":"${CAREER_TRANSFER_KIND}","version":1,"checksum":"00000000","career":{"__proto__":{"polluted":true}}}`;
    expect(() => importCareerFile(poisoned)).toThrow(/chave inválida/);
  });
});
