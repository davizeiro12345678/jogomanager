import { describe, expect, it } from "vitest";
import { exportCareerFile, importCareerFile } from "./career-transfer";

const career = { version: 3, leagueId: "test", clubId: "club", managerName: "Davi" };

describe("career transfer contract", () => {
  it("rejects modified files", () => {
    const exported = exportCareerFile(career as never).replace("Davi", "Outro");
    expect(() => importCareerFile(exported)).toThrow(/alterado/);
  });
});
