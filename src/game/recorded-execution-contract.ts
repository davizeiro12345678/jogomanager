import {
  MATCH_EXECUTION_REVISION,
  validExecutionContract,
  type MatchExecutionContract,
} from "./match-execution-contract";

/** Recorded frames are interpolated; playback never resumes a historical solver. */
export type RecordedMatchExecutionContract = Omit<MatchExecutionContract, "revision"> & {
  revision: 1 | 2 | typeof MATCH_EXECUTION_REVISION;
};

export function validRecordedExecutionContract(
  value: unknown,
): value is RecordedMatchExecutionContract {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const contract = value as Record<string, unknown>;
  return (
    (contract["revision"] === 1 ||
      contract["revision"] === 2 ||
      contract["revision"] === MATCH_EXECUTION_REVISION) &&
    validExecutionContract({ ...contract, revision: MATCH_EXECUTION_REVISION })
  );
}
