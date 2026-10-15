import type { MatchSim } from "./sim";
import type { BallPhysicsAuthority } from "./rapier-ball-authority";
import { loadPassLaneIntoKernel } from "./wasm/match-perception";
import type { MatchExecutionContract } from "./match-execution-contract";
export {
  MATCH_EXECUTION_REVISION,
  validExecutionContract,
  type MatchExecutionContract,
} from "./match-execution-contract";

/** A late initialization is released, never attached to an already running match. */
export function boundedPhysicsInitialization(
  factory: () => Promise<BallPhysicsAuthority>,
  deadlineMs = 4_000,
  signal?: AbortSignal,
): Promise<BallPhysicsAuthority | null> {
  if (!Number.isFinite(deadlineMs) || deadlineMs < 0 || deadlineMs > 30_000)
    return Promise.reject(new RangeError("Invalid initialization deadline"));
  if (signal?.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve(null);
    };
    const timer = setTimeout(finish, deadlineMs);
    signal?.addEventListener("abort", finish, { once: true });
    void Promise.resolve()
      .then(() => (signal?.aborted ? null : factory()))
      .then(
        (authority) => {
          if (!authority) {
            finish();
            return;
          }
          if (settled) {
            authority.dispose();
            return;
          }
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", finish);
          resolve(authority);
        },
        () => {
          finish();
        },
      );
  });
}

/** Resolve the entire contract before the first canonical tick. */
export async function initializeMatchExecution(
  sim: MatchSim,
  signal?: AbortSignal,
): Promise<MatchExecutionContract> {
  const [kernel, authority] = await Promise.all([
    loadPassLaneIntoKernel(),
    boundedPhysicsInitialization(
      async () => {
        const { createRapierBallAuthority } = await import("./rapier-ball-authority");
        return createRapierBallAuthority();
      },
      4_000,
      signal,
    ),
  ]);
  if (signal?.aborted) {
    authority?.dispose();
    return sim.executionContract();
  }
  if (kernel) sim.setPassLaneIntoKernel(kernel, "wasm");
  if (authority) {
    sim.setBallPhysicsAuthority(authority);
    if (!sim.hasBallPhysicsAuthority()) authority.dispose();
  }
  return sim.executionContract();
}
