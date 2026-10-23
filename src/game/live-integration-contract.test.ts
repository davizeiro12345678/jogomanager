import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { activateAdvanced } from "./tactical-plan";
import { resultMatch, snapshotMatch, snapshotMatchPacket, WorkerMatchView } from "./live-match";
import { LiveSnapshotDecoder, LiveSnapshotEncoder } from "./live-transport";

const matches: MatchSim[] = [];
function fixture() {
  const home = buildTeamSetup("fla"),
    away = buildTeamSetup("pal");
  const sim = new MatchSim(home, away, "live-integration-contract");
  matches.push(sim);
  return { sim, view: new WorkerMatchView(structuredClone(home), structuredClone(away)) };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const sim of matches.splice(0)) sim.dispose();
});

describe("integrated live snapshot compatibility", () => {
  it("throttles visible analytics to500ms, retains them through sparse frames and always sends a final report with execution", () => {
    const { sim, view } = fixture();
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    expect(snapshotMatch(sim, 1).analytics).toBeUndefined();
    const first = snapshotMatch(sim, 2, undefined, false, true);
    expect(first.analytics).toBeDefined();
    expect(first.execution).toEqual(sim.executionContract());
    view.apply(first);
    now.mockReturnValue(1499);
    const sparse = snapshotMatch(sim, 3, undefined, false, true);
    expect(sparse.analytics).toBeUndefined();
    view.apply(sparse);
    expect(view.analytics).toEqual(first.analytics);
    now.mockReturnValue(1500);
    expect(snapshotMatch(sim, 4, undefined, false, true).analytics).toBeDefined();
    expect(resultMatch(sim, 5).analytics).toBeDefined();
    expect(view.executionContract()).toEqual(sim.executionContract());
  });

  it("delivers changed advanced program data even when the selected plan stays the same", () => {
    const { sim, view } = fixture();
    sim.home.tactics = activateAdvanced(sim.home.tactics);
    const first = snapshotMatch(sim, 1);
    view.apply(first);
    expect(snapshotMatch(sim, 2).tactics).toBeUndefined();
    sim.home.tactics.advanced!.familiarity.team = 78;
    const changed = snapshotMatch(sim, 3);
    expect(changed.tactics?.home.advanced?.familiarity.team).toBe(78);
    expect(first.tactics?.home.advanced?.familiarity.team).not.toBe(78);
    view.apply(changed);
    expect(view.home.tactics.advanced?.familiarity.team).toBe(78);
  });

  it("preserves emergency role metadata and removals through packed numeric transport", () => {
    const { sim, view } = fixture();
    const encoder = new LiveSnapshotEncoder(71),
      decoder = new LiveSnapshotDecoder();
    let seq = 0;
    const send = () => {
      const packet = encoder.encode(snapshotMatch(sim, ++seq))!;
      view.apply(decoder.decode(structuredClone(packet))!);
      encoder.recycle(71, packet.slot, packet.frame.buffer);
      return packet;
    };
    send();
    const player = sim.players[1]!;
    const role = { pos: player.pos, slotX: player.slotX, slotZ: player.slotZ };
    player.emergencyKeeper = { ...role };
    player.pos = "GK";
    player.slotX = -49;
    player.slotZ = 0;
    const changed = send();
    expect(changed.roster).toBeDefined();
    expect(view.players[1]).toMatchObject({ pos: "GK", slotX: -49, emergencyKeeper: role });
    player.emergencyKeeper.slotX += 1;
    expect(view.players[1]!.emergencyKeeper).toEqual(role);
    expect(send().roster).toBeDefined();
    delete player.emergencyKeeper;
    player.pos = role.pos;
    player.sentOff = true;
    send();
    expect(view.players[1]!.emergencyKeeper).toBeUndefined();
    expect(view.players[1]!.sentOff).toBe(true);
  });

  it("keeps the legacy three-buffer API while applying changed role metadata and clearing optional fields", () => {
    const { sim, view } = fixture();
    view.apply(snapshotMatchPacket(sim, 1, { includeMetadata: true }));
    const player = sim.players[1]!;
    const role = { pos: player.pos, slotX: player.slotX, slotZ: player.slotZ };
    player.emergencyKeeper = role;
    player.pos = "GK";
    player.slotX = -49;
    const changed = snapshotMatchPacket(sim, 2, { includeMetadata: false });
    expect(changed.metadata).toBeDefined();
    expect(view.apply(changed)).toEqual([]);
    expect(view.players[1]).toMatchObject({ pos: "GK", slotX: -49, emergencyKeeper: role });
    delete player.emergencyKeeper;
    delete player.heightCm;
    delete player.weightKg;
    player.pos = role.pos;
    expect(view.apply(snapshotMatchPacket(sim, 3, { includeMetadata: false }))).toHaveLength(3);
    expect(view.players[1]!.emergencyKeeper).toBeUndefined();
    expect(view.players[1]!.heightCm).toBeUndefined();
    expect(view.players[1]!.weightKg).toBeUndefined();
  });
});
