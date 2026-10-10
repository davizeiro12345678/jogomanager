import { describe, expect, it } from "vitest";
import { LiveSnapshotDecoder, LiveSnapshotEncoder } from "./live-transport";
import { snapshotMatch, WorkerMatchView } from "./live-match";
import { MatchSim } from "./sim";
import { buildTeamSetup } from "./quickMatch";
import { estimateSerializedCloneBytes } from "./snapshot-telemetry";

function fixture() {
  const home = buildTeamSetup("fla"),
    away = buildTeamSetup("pal");
  return { sim: new MatchSim(home, away, "transport-v1"), view: new WorkerMatchView(home, away) };
}
describe("live transport ownership", () => {
  it("invalidates in-place identity and body metadata changes without retaining old optional values", () => {
    const { sim } = fixture();
    const encoder = new LiveSnapshotEncoder(8),
      decoder = new LiveSnapshotDecoder();
    let seq = 0;
    const send = () => {
      const packet = encoder.encode(snapshotMatch(sim, ++seq))!;
      const state = decoder.decode(structuredClone(packet))!;
      expect(encoder.recycle(8, packet.slot, packet.frame.buffer)).toBe(true);
      return { packet, state };
    };
    try {
      const original = send();
      const player = sim.players[0]!;
      player.name = "João 李";
      player.number = 99;
      player.pos = "FW";
      player.heightCm = 191;
      player.weightKg = 86;
      const changed = send();
      expect(changed.packet.rosterRevision).toBe(2);
      expect(changed.state.players[0]).toMatchObject({
        name: "João 李",
        number: 99,
        heightCm: 191,
        weightKg: 86,
      });
      expect(original.packet.roster![0]!.name).not.toBe("João 李");
      delete player.heightCm;
      delete player.weightKg;
      const removed = send();
      expect(removed.state.players[0]!.heightCm).toBeUndefined();
      expect(removed.state.players[0]!.weightKg).toBeUndefined();
      player.sentOff = true;
      player.action = "shot";
      const frameOnly = send();
      expect(frameOnly.packet.roster).toBeUndefined();
      expect(frameOnly.state.players[0]!.sentOff).toBe(true);
      expect(frameOnly.state.players[0]!.action).toBe("shot");
      encoder.resync();
      const resynced = send();
      expect(resynced.packet.roster).toBeDefined();
      expect(resynced.packet.eventReset).toBe(true);
    } finally {
      sim.dispose();
    }
  });
  it("transfers, detaches and recycles exactly three buffers", () => {
    const { sim } = fixture();
    const encoder = new LiveSnapshotEncoder(1),
      decoder = new LiveSnapshotDecoder();
    try {
      const packets = [1, 2, 3].map((seq) => encoder.encode(snapshotMatch(sim, seq))!);
      expect(encoder.encode(snapshotMatch(sim, 4))).toBeNull();
      const sent = packets[0]!;
      const received = structuredClone(sent, { transfer: [sent.frame.buffer] });
      expect(sent.frame.byteLength).toBe(0);
      const state = decoder.decode(received)!;
      const x = state.players[0]!.x;
      const recycled = structuredClone(received.frame.buffer, {
        transfer: [received.frame.buffer],
      });
      expect(received.frame.byteLength).toBe(0);
      expect(state.players[0]!.x).toBe(x);
      expect(encoder.recycle(9, sent.slot, recycled)).toBe(false);
      expect(encoder.recycle(1, sent.slot, recycled)).toBe(true);
      expect(encoder.recycle(1, sent.slot, recycled)).toBe(false);
      expect(encoder.encode(snapshotMatch(sim, 4))).not.toBeNull();
    } finally {
      sim.dispose();
    }
  });
  it("sends metadata only on change and preserves interpolation after recycling", () => {
    const { sim, view } = fixture();
    const encoder = new LiveSnapshotEncoder(2),
      decoder = new LiveSnapshotDecoder();
    try {
      const first = encoder.encode(snapshotMatch(sim, 1))!;
      view.apply(decoder.decode(first)!);
      encoder.recycle(2, first.slot, first.frame.buffer);
      sim.players[0]!.x += 2;
      const next = encoder.encode(snapshotMatch(sim, 2))!;
      expect(next.roster).toBeUndefined();
      expect(estimateSerializedCloneBytes(next)).toBeLessThan(
        estimateSerializedCloneBytes(snapshotMatch(sim, 2)) * 0.6,
      );
      view.apply(decoder.decode(next)!);
      const previous = view.players[0]!.x;
      const recycled = structuredClone(next.frame.buffer, { transfer: [next.frame.buffer] });
      encoder.recycle(2, next.slot, recycled);
      view.renderTick(performance.now() + 500);
      expect(view.players[0]!.x).toBeCloseTo(sim.players[0]!.x, 4);
      expect(view.players[0]!.x).not.toBe(previous);
      sim.players.reverse();
      const reordered = encoder.encode(snapshotMatch(sim, 3))!;
      expect(reordered.rosterRevision).toBe(2);
      expect(decoder.decode(reordered)!.players[0]!.id).toBe(sim.players[0]!.id);
      encoder.recycle(2, reordered.slot, reordered.frame.buffer);
      sim.players[0]!.id = "replacement-player";
      const replaced = encoder.encode(snapshotMatch(sim, 4))!;
      expect(replaced.rosterRevision).toBe(3);
      expect(decoder.decode(replaced)!.players[0]!.id).toBe("replacement-player");
    } finally {
      sim.dispose();
    }
  });
  it("rejects cursor gaps, detached frames and duplicate sequences", () => {
    const { sim } = fixture();
    const encoder = new LiveSnapshotEncoder(3),
      decoder = new LiveSnapshotDecoder();
    try {
      const first = encoder.encode(snapshotMatch(sim, 1))!;
      decoder.decode(first);
      expect(decoder.decode(first)).toBeNull();
      const next = encoder.encode(snapshotMatch(sim, 2))!;
      expect(() =>
        decoder.decode({
          ...next,
          session: 4,
          eventReset: true,
          roster: [first.roster![0]!, ...first.roster!.slice(1).map(() => first.roster![0]!)],
        }),
      ).toThrow(/roster/);
      expect(decoder.decode(next)?.seq).toBe(2);
      const third = encoder.encode(snapshotMatch(sim, 3))!;
      expect(() => decoder.decode({ ...third, eventBase: 99 })).toThrow(/cursor/);
      structuredClone(third.frame.buffer, { transfer: [third.frame.buffer] });
      expect(() => decoder.decode(third)).toThrow(/frame/);
    } finally {
      sim.dispose();
    }
  });
});
