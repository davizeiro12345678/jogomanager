import { describe, expect, it } from "vitest";
import { emptyPose, JOINTS } from "./animation-core";
import { snapshotMatch, WorkerMatchView } from "./live-match";
import { PLAYER_FRAME_FIELDS } from "./live-transport";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";

describe("fixed presentation slots", () => {
  it("detects in-place changes to every basic tactical field", () => {
    const home = buildTeamSetup("fla"),
      away = buildTeamSetup("pal");
    const sim = new MatchSim(home, away, "direct-tactical-slots");
    expect(snapshotMatch(sim, 1).tactics).toBeDefined();
    expect(snapshotMatch(sim, 2).tactics).toBeUndefined();
    home.tactics.formation = "4-4-2";
    expect(snapshotMatch(sim, 3).tactics?.home).toEqual(home.tactics);
    for (const field of ["mentality", "pressing", "width", "tempo"] as const) {
      home.tactics[field] += 0.25;
      expect(snapshotMatch(sim, 4).tactics?.home).toEqual(home.tactics);
      expect(snapshotMatch(sim, 5).tactics).toBeUndefined();
      away.tactics[field] += 0.25;
      expect(snapshotMatch(sim, 6).tactics?.away).toEqual(away.tactics);
      expect(snapshotMatch(sim, 7).tactics).toBeUndefined();
    }
  });

  it("creates an independent, complete neutral pose in joint order", () => {
    const first = emptyPose();
    const second = emptyPose();
    expect(Object.keys(first)).toEqual(JOINTS);
    for (const joint of JOINTS) expect(first[joint]).toBe(0);
    first.kneeL = -1;
    expect(second.kneeL).toBe(0);
  });

  it("copies every mutable wire field while preserving interpolated positions", () => {
    const home = buildTeamSetup("fla"),
      away = buildTeamSetup("pal");
    const sim = new MatchSim(home, away, "direct-frame-slots");
    const view = new WorkerMatchView(home, away);
    view.apply(snapshotMatch(sim, 1));
    const current = view.players[0]!;
    const next = snapshotMatch(sim, 2);
    expect(next.players).toEqual(sim.players);
    const target = next.players[0]!;
    const before = { x: current.x, z: current.z };
    for (let index = 0; index < PLAYER_FRAME_FIELDS.length; index++)
      target[PLAYER_FRAME_FIELDS[index]!] = index + 0.125;
    target.action = "pass";
    target.sentOff = true;
    target.emergencyKeeper = { pos: "DF", slotX: -0.8, slotZ: 0.2 };
    view.apply(next);
    expect(view.players[0]).toBe(current);
    expect(current.x).toBe(before.x);
    expect(current.z).toBe(before.z);
    for (const field of PLAYER_FRAME_FIELDS.slice(2)) expect(current[field]).toBe(target[field]);
    expect(current.action).toBe("pass");
    expect(current.sentOff).toBe(true);
    expect(current.emergencyKeeper).toEqual(target.emergencyKeeper);
    expect(current.emergencyKeeper).not.toBe(target.emergencyKeeper);
    delete target.emergencyKeeper;
    delete target.heightCm;
    delete target.weightKg;
    view.apply(next);
    expect(current).not.toHaveProperty("emergencyKeeper");
    expect(current).not.toHaveProperty("heightCm");
    expect(current).not.toHaveProperty("weightKg");
  });
});
