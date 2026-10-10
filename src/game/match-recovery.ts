import { MatchSim, type MatchCheckpoint } from "./sim";
import type { LiveSnapshot } from "./live-match";
import { loadPassLaneIntoKernel } from "./wasm/match-perception";

/** Restore the confirmed checkpoint, then replay only its exact fixed ticks. */
export async function recoverMatch(
  checkpoint: MatchCheckpoint,
  snapshot: LiveSnapshot,
  cancelled: () => boolean,
): Promise<MatchSim> {
  const tail = snapshot.recovery;
  if (!tail || tail.ticks.length > 600) throw new Error("Missing recovery tick journal");
  const state = checkpoint.state;
  const sim = new MatchSim(
    state["home"] as MatchSim["home"],
    state["away"] as MatchSim["away"],
    checkpoint.seed,
    { knockout: state["knockout"] as boolean, weather: state["weather"] as MatchSim["weather"] },
  );
  try {
    if (checkpoint.perception === "wasm") {
      const kernel = await loadPassLaneIntoKernel();
      if (!kernel) throw new Error("Recovery perception backend unavailable");
      sim.setPassLaneIntoKernel(kernel, "wasm");
    }
    if (checkpoint.physics) {
      const { createRapierBallAuthority } = await import("./rapier-ball-authority");
      const authority = await createRapierBallAuthority();
      try {
        sim.restoreCheckpoint(checkpoint, authority);
      } catch (error) {
        authority.dispose();
        throw error;
      }
    } else sim.restoreCheckpoint(checkpoint);
    for (let index = 0; index < tail.ticks.length; index++) {
      if (cancelled()) throw new Error("Recovery cancelled");
      const [dt, clock] = tail.ticks[index]!;
      if (
        !Number.isFinite(dt) ||
        !Number.isFinite(clock) ||
        dt <= 0 ||
        dt > 0.4 ||
        clock < 0 ||
        clock > 100
      )
        throw new Error("Invalid recovery tick");
      sim.step(dt, clock);
      if (index % 24 === 23) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (cancelled()) throw new Error("Recovery cancelled");
    if (
      Math.abs(sim.time - snapshot.time) > 0.001 ||
      sim.lastEventId !== snapshot.eventSeq ||
      sim.stats.home.goals !== snapshot.stats.home.goals ||
      sim.stats.away.goals !== snapshot.stats.away.goals ||
      sim.players.length !== snapshot.players.length ||
      sim.players.some((player, index) => {
        const expected = snapshot.players[index]!;
        return (
          player.id !== expected.id ||
          Math.hypot(player.x - expected.x, player.z - expected.z) > 0.002
        );
      }) ||
      Math.hypot(sim.ball.x - snapshot.ball.x, sim.ball.z - snapshot.ball.z) > 0.002
    )
      throw new Error(
        `Recovery does not match confirmed snapshot (time=${sim.time - snapshot.time}, events=${sim.lastEventId - snapshot.eventSeq}, ball=${Math.hypot(sim.ball.x - snapshot.ball.x, sim.ball.z - snapshot.ball.z)}, player=${Math.max(...sim.players.map((p, i) => Math.hypot(p.x - snapshot.players[i]!.x, p.z - snapshot.players[i]!.z)))})`,
      );
    return sim;
  } catch (error) {
    sim.dispose();
    throw error;
  }
}
