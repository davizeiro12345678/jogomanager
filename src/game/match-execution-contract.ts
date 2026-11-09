export const MATCH_EXECUTION_REVISION = 2 as const;
export type MatchRulesRevision = 1 | 2;
export function validMatchRulesRevision(value: unknown): value is MatchRulesRevision {
  return value === 1 || value === 2;
}
export interface MatchExecutionContract {
  revision: typeof MATCH_EXECUTION_REVISION;
  physics: "compat" | "rapier";
  perception: "compat" | "wasm";
  /** Omission preserves the original seeded rules and existing replay contracts. */
  rulesRevision?: MatchRulesRevision | undefined;
}
export function validExecutionContract(value: unknown): value is MatchExecutionContract {
  if (!value || typeof value !== "object") return false;
  const contract = value as Record<string, unknown>;
  return (
    contract["revision"] === MATCH_EXECUTION_REVISION &&
    (contract["rulesRevision"] === undefined ||
      validMatchRulesRevision(contract["rulesRevision"])) &&
    (contract["physics"] === "compat" || contract["physics"] === "rapier") &&
    (contract["perception"] === "compat" || contract["perception"] === "wasm")
  );
}
