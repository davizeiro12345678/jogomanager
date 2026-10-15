export const MATCH_EXECUTION_REVISION = 2 as const;
export interface MatchExecutionContract {
  revision: typeof MATCH_EXECUTION_REVISION;
  physics: "compat" | "rapier";
  perception: "compat" | "wasm";
}
export function validExecutionContract(value: unknown): value is MatchExecutionContract {
  if (!value || typeof value !== "object") return false;
  const contract = value as Record<string, unknown>;
  return (
    contract["revision"] === MATCH_EXECUTION_REVISION &&
    (contract["physics"] === "compat" || contract["physics"] === "rapier") &&
    (contract["perception"] === "compat" || contract["perception"] === "wasm")
  );
}
