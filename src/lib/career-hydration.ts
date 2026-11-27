export const CAREER_HYDRATION_STATUS = [
  "loading",
  "empty",
  "ready",
  "tombstoned",
  "offline",
  "error",
] as const;

export type CareerHydrationStatus = (typeof CAREER_HYDRATION_STATUS)[number];

export type CareerHydrationPhase = "loading" | "loaded";

export interface CareerHydrationBarrierDecision<T> {
  blocked: boolean;
  career: T | null;
  sync: "pending" | "synced";
  mutable: boolean;
}

/** A non-resolved local barrier always wins over cloud data until reconciled. */
export function resolveCareerHydrationBarrier<T>({
  localBlock,
  localCareer,
  cloudCareer,
  outboxState,
}: {
  localBlock: { reason: string } | null;
  localCareer: T | null;
  cloudCareer?: T | null;
  /** Diagnostic context only: a barrier is not cleared by an empty/unreadable queue. */
  outboxState?: "empty" | "pending" | "unreadable";
}): CareerHydrationBarrierDecision<T> {
  if (localBlock && localBlock.reason !== "deleted")
    return { blocked: true, career: localCareer, sync: "pending", mutable: false };
  return {
    blocked: false,
    career: cloudCareer ?? localCareer,
    sync: "synced",
    mutable: true,
  };
}

export function resolveCareerHydrationStatus({
  phase,
  hasCareer,
  signedIn,
  online,
  requestError = false,
  tombstoned = false,
}: {
  phase: CareerHydrationPhase;
  hasCareer: boolean;
  signedIn: boolean;
  online: boolean;
  requestError?: boolean;
  tombstoned?: boolean;
}): CareerHydrationStatus {
  if (phase === "loading") return "loading";
  if (requestError) return "error";
  // A local snapshot does not prove that the account's cloud save is loaded;
  // replacement/reset must remain blocked until connectivity is restored.
  if (signedIn && !online) return "offline";
  if (tombstoned) return "tombstoned";
  return hasCareer ? "ready" : "empty";
}

export function canCreateCareer({
  status,
  hasCareer,
  replace,
}: {
  status: CareerHydrationStatus;
  hasCareer: boolean;
  replace: boolean;
}): boolean {
  if (status === "loading" || status === "offline" || status === "error") return false;
  if (hasCareer) return status === "ready" && replace;
  return status === "empty" || status === "tombstoned";
}

export function canMutateCareer(status: CareerHydrationStatus): boolean {
  // The hook additionally requires a local snapshot and known generation for
  // an authenticated offline edit. Creation and reset use stricter gates.
  return status === "empty" || status === "ready" || status === "offline";
}

export function canResetCareer(status: CareerHydrationStatus): boolean {
  return status === "empty" || status === "ready";
}
