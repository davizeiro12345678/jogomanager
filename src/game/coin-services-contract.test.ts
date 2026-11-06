import { describe, expect, it } from "vitest";
import { applyContractRenewal } from "./coin-services";
import { CAREER_SERVICES } from "@/lib/wallet-rules";
import type { CareerState } from "./types";

const career = (years: number) =>
  ({
    clubId: "c",
    players: { p: { id: "p", clubId: "c", contractYears: years, ovr: 70 } },
  }) as unknown as CareerState;

describe("contract renewal service", () => {
  it("costs 200 coins, 3 per week", () => {
    expect(CAREER_SERVICES.contract_renewal).toEqual({ cost: 200, weeklyLimit: 3 });
  });
  it("adds 2 years", () => {
    expect(applyContractRenewal(career(1), "p").players["p"]!.contractYears).toBe(3);
  });
  it("never goes above 5 years", () => {
    expect(applyContractRenewal(career(4), "p").players["p"]!.contractYears).toBe(5);
  });
});
