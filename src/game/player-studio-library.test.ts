import { expect, it } from "vitest";
import { movementGroup, movementSearch } from "./player-studio-library";

it("finds Portuguese anatomical movements without requiring accents", () => {
  expect(movementSearch("  Impulsão pelos tornozelos  ")).toContain(movementSearch("impulsao"));
  expect(movementSearch("Rotação do tronco")).toContain(movementSearch("rotacao"));
});
it("keeps keeper and defensive movements in their respective browsing groups", () => {
  for (const id of ["keeperReach", "keeperSettle", "diveRight", "catch"])
    expect(movementGroup(id)).toBe("keeper");
  for (const id of ["readyPress", "block", "lateralReach"])
    expect(movementGroup(id)).toBe("defense");
  expect(movementGroup("run")).toBe("locomotion");
  expect(movementGroup("hipPivotLeft")).toBe("recovery");
});
