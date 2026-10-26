import { expect, it } from "vitest";
import { validMatchCommand, validMatchTactics } from "./match-command-validation";
import { ROLE_CATALOG } from "./tactical-plan";

it("accepts boolean analytics visibility while rejecting truthy untrusted values", () => {
  for (const visible of [false, true])
    expect(validMatchCommand({ id: 1, type: "analyticsLive", visible })).toBe(true);
  for (const visible of ["false", 1, null, {}, undefined])
    expect(validMatchCommand({ id: 1, type: "analyticsLive", visible })).toBe(false);
});

it("does not accept an incomplete advanced program inside an otherwise valid tactical command", () => {
  const tactics = { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 };
  expect(validMatchTactics(tactics)).toBe(true);
  expect(validMatchTactics({ ...tactics, advanced: { activePlanId: "__proto__" } })).toBe(false);
});

it("restricts reported tactical roles to known roles without accepting prototype properties", () => {
  const command = {
    id: 2,
    type: "advance",
    evaluatedAt: Date.now(),
    career: {
      clubId: "fla",
      season: 2026,
      round: 1,
      players: {},
      fixtures: [],
      lineup: [],
      finances: { budget: 0, spent: 0, income: 0 },
    },
    result: { hg: 0, ag: 0 },
  };
  const performance = { pid: "fla-test", goals: 0, assists: 0, played: true };
  const role = Object.keys(ROLE_CATALOG)[0]!;
  expect(
    validMatchCommand({ ...command, performances: [{ ...performance, tacticalRole: role }] }),
  ).toBe(true);
  for (const tacticalRole of ["__proto__", "constructor", "unregistered-role", {}])
    expect(
      validMatchCommand({ ...command, performances: [{ ...performance, tacticalRole }] }),
    ).toBe(false);
});
