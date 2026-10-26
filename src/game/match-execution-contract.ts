// Revision 3 aligns the goal colliders and aerodynamic units. Old live solver
// snapshots cannot be resumed under these rules; completed career data is separate.
export const MATCH_EXECUTION_REVISION = 3 as const;
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
