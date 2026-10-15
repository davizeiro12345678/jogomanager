import { describe, expect, it } from "vitest";

import { budgetReservationAccepted } from "./ai-budget.server";

describe("AI budget reservation policy", () => {
  it("fails closed when accounting cannot confirm the reservation", () => {
    expect(budgetReservationAccepted(true, false)).toBe(true);
    expect(budgetReservationAccepted(false, false)).toBe(false);
    expect(budgetReservationAccepted(true, true)).toBe(false);
    expect(budgetReservationAccepted(undefined, true)).toBe(false);
  });
});
