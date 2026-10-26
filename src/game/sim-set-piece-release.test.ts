import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim, LIVE_MATCH_CLOCK_SCALE, MATCH_SIMULATION_STEP } from "./sim";
import { activateAdvanced, activePlan } from "./tactical-plan";
import type { SimPlayer } from "./sim-types";

type SetPieceInternals = {
  setupPenalty(side: "home"): void;
  setupDirectFK(side: "home", x: number, z: number): void;
  setupCorner(side: "home"): void;
  takePenalty(): void;
  takeDirectFK(): void;
  takeCorner(): void;
  setPiece: { takerId: string; kind: string } | null;
  pendingShot: { shooter: string } | null;
  moveBall(dt: number, useBallPhysics: boolean): void;
  controlBall(player: SimPlayer, speed: number, height: number): void;
};
const create = () =>
  new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "setpiece-ownership");
const prepare = (sim: MatchSim, kind: string) => {
  const internal = sim as unknown as SetPieceInternals;
  if (kind === "penalty") internal.setupPenalty("home");
  else if (kind === "free-kick") internal.setupDirectFK("home", 25, 4);
  else internal.setupCorner("home");
  return internal;
};

describe("set-piece ball ownership", () => {
  it("keeps the penalty taker at the assigned mark while the referee waits", () => {
    const sim = create();
    const internal = prepare(sim, "penalty");
    const taker = sim.players.find((p) => p.id === internal.setPiece!.takerId)!;
    const spot = { x: taker.x, z: taker.z };
    for (let tick = 0; tick < 30; tick++)
      sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE, false);
    expect({ x: taker.x, z: taker.z }).toEqual(spot);
    sim.dispose();
  });

  it.each(["pending-shooter", "opponent", "shooter-rebound"])(
    "respects loose-ball eligibility for %s",
    (kind) => {
      const sim = create();
      const internal = prepare(sim, "penalty");
      const taker = sim.players.find((p) => p.id === internal.setPiece!.takerId)!;
      internal.takePenalty();
      sim.ball.x = taker.x + 0.3;
      sim.ball.z = taker.z;
      sim.ball.vx = 8;
      sim.ball.vz = 0;
      sim.ball.height = 0.25;
      const opponent = sim.players.find((p) => p.side === "away" && p.pos === "DF")!;
      if (kind === "opponent") {
        opponent.x = sim.ball.x + 8 / 30;
        opponent.z = sim.ball.z;
      }
      if (kind === "shooter-rebound") internal.pendingShot = null;
      const touched: string[] = [];
      const control = internal.controlBall.bind(sim);
      internal.controlBall = (player, speed, height) => {
        touched.push(player.id);
        return control(player, speed, height);
      };
      internal.moveBall(MATCH_SIMULATION_STEP, false);
      if (kind === "pending-shooter") expect(touched).not.toContain(taker.id);
      else expect(touched).toContain(kind === "opponent" ? opponent.id : taker.id);
      sim.dispose();
    },
  );

  it.each(["penalty", "free-kick", "corner"])("keeps an armed %s dead until the strike", (kind) => {
    const sim = create();
    const internal = prepare(sim, kind);
    const spot = { x: sim.ball.x, z: sim.ball.z };
    for (let tick = 0; tick < 30; tick++)
      sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE, false);
    expect(internal.setPiece).not.toBeNull();
    expect(sim.ball.holder).toBeNull();
    expect(sim.ball.x).toBe(spot.x);
    expect(sim.ball.z).toBe(spot.z);
    sim.dispose();
  });

  it.each(["penalty", "free-kick", "corner"])(
    "releases stale taker possession when a %s is struck",
    (kind) => {
      const sim = create();
      const internal = prepare(sim, kind);
      const taker = internal.setPiece!.takerId;
      sim.ball.holder = taker;
      if (kind === "penalty") internal.takePenalty();
      else if (kind === "free-kick") internal.takeDirectFK();
      else internal.takeCorner();
      expect(sim.ball.holder).not.toBe(taker);
      if (internal.pendingShot) expect(sim.ball.holder).toBeNull();
      sim.dispose();
    },
  );

  it("lets a short corner deliberately give possession to the receiver", () => {
    const sim = create();
    sim.home.tactics = activateAdvanced(sim.home.tactics);
    activePlan(sim.home.tactics)!.setPieces.target = "short";
    const internal = prepare(sim, "corner");
    const taker = internal.setPiece!.takerId;
    sim.ball.holder = taker;
    internal.takeCorner();
    expect(sim.ball.holder).not.toBeNull();
    expect(sim.ball.holder).not.toBe(taker);
    expect(sim.players.find((p) => p.id === sim.ball.holder)?.side).toBe("home");
    expect(internal.pendingShot).toBeNull();
    sim.dispose();
  });

  it("preserves a goalkeeper's legitimate claim of a corner", () => {
    // Search only deterministic ordinary seeds; no outcome is forced.
    let claimant: SimPlayer | undefined;
    for (let seed = 0; seed < 300 && !claimant; seed++) {
      const sim = new MatchSim(
        buildTeamSetup("fla"),
        buildTeamSetup("pal"),
        `corner-claim-control-${seed}-20261020`,
      );
      const internal = prepare(sim, "corner");
      internal.takeCorner();
      const holder = sim.players.find((p) => p.id === sim.ball.holder);
      if (holder?.side === "away" && holder.pos === "GK") claimant = holder;
      sim.dispose();
    }
    expect(claimant).toBeDefined();
  });

  it("repairs stale ownership in a structurally compatible armed checkpoint", () => {
    const original = create();
    const internal = prepare(original, "penalty");
    original.ball.holder = internal.setPiece!.takerId;
    const checkpoint = original.checkpoint();
    const recovered = create();
    recovered.restoreCheckpoint(checkpoint);
    recovered.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE, false);
    expect(recovered.ball.holder).toBeNull();
    expect((recovered as unknown as SetPieceInternals).setPiece?.kind).toBe("penalty");
    original.dispose();
    recovered.dispose();
  });
});
