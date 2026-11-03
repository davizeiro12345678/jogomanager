import { useEffect } from "react";
import type { OnboardingVisit } from "@/game/onboarding";

const key = (clubId: string) => `jm.onboarding:${clubId}`;

export function readOnboardingVisits(clubId: string): Set<OnboardingVisit> {
  try {
    const raw = JSON.parse(localStorage.getItem(key(clubId)) ?? "[]") as unknown;
    return new Set(
      Array.isArray(raw) ? (raw.filter((v) => typeof v === "string") as OnboardingVisit[]) : [],
    );
  } catch {
    return new Set();
  }
}

/** Marks a guided step as visited for this club's career. */
export function useMarkOnboardingVisit(clubId: string | undefined, visit: OnboardingVisit) {
  useEffect(() => {
    if (!clubId) return;
    try {
      const visits = readOnboardingVisits(clubId);
      if (visits.has(visit)) return;
      visits.add(visit);
      localStorage.setItem(key(clubId), JSON.stringify([...visits]));
    } catch {
      // Storage blocked: the guide simply keeps the step open.
    }
  }, [clubId, visit]);
}
