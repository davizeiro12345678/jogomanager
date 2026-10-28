import type { SupporterMatchday } from "./career-world-types";

/** Presentation-only mapping: events and crowd rendering remain local. */
export function supportersFromAiPlan(plan: {
  climate: "apoio" | "cobranca";
  intensity: 0 | 1 | 2;
}): SupporterMatchday {
  return {
    side: "home",
    climate: plan.climate === "cobranca" ? "cobrança" : "apoio",
    intensity: [0.25, 0.6, 1][plan.intensity]!,
    occupancy: 0.86,
  };
}
