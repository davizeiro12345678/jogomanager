import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { WorkerMatchView, snapshotMatchPacket } from "./live-match";
import {
  MATCH_PLAYER_COUNT,
  PLAYER_STATE_STRIDE,
  actionCode,
  applyLivePlayerBuffer,
  createLivePlayerBuffer,
  createLivePlayerMetadata,
  createSnapshotBufferPool,
  recycleSnapshot,
  transferablesForSnapshot,
  validateLivePlayerBuffer,
} from "./live-match-buffer";

describe("live match transferable buffers", () => {
  function createPlayers() {
    const home = buildTeamSetup("fla");
    const away = buildTeamSetup("pal");
    return new MatchSim(home, away, "buffer-test");
  }

  it("encodes the 22-player layout and action state deterministically", () => {
    const players = createPlayers().players;
    const encoded = createLivePlayerBuffer(players);

    expect(players).toHaveLength(MATCH_PLAYER_COUNT);
    expect(encoded.positions).toHaveLength(MATCH_PLAYER_COUNT * 2);
    expect(encoded.velocities).toHaveLength(MATCH_PLAYER_COUNT * 2);
    expect(encoded.states).toHaveLength(MATCH_PLAYER_COUNT * PLAYER_STATE_STRIDE);
    expect(encoded.states[10]).toBe(actionCode(players[0]!.action));
    expect(createLivePlayerMetadata(players)).toHaveLength(MATCH_PLAYER_COUNT);
  });

  it("rejects inconsistent ownership buffers and preserves player identity on apply", () => {
    const players = createPlayers().players;
    const metadata = createLivePlayerMetadata(players);
    const encoded = createLivePlayerBuffer(players);
    expect(() => validateLivePlayerBuffer(encoded, players.length)).not.toThrow();
    expect(() => validateLivePlayerBuffer({ ...encoded, states: new Float32Array(1) }, players.length)).toThrow(
      /states/,
    );

    const target = players.map((player) => ({ ...player }));
    encoded.positions[0] = 12.5;
    applyLivePlayerBuffer(target, metadata, encoded);
    expect(target[0]?.id).toBe(players[0]?.id);
    expect(target[0]?.x).toBe(12.5);
    expect(target[0]?.name).toBe(players[0]?.name);
  });

  it("keeps three slots and exposes only the exact transferable buffers", () => {
    const pool = createSnapshotBufferPool(3);
    const first = pool.acquire(MATCH_PLAYER_COUNT);
    const second = pool.acquire(MATCH_PLAYER_COUNT);
    const third = pool.acquire(MATCH_PLAYER_COUNT);
    expect(pool.available()).toBe(0);
    expect(pool.starvationCount()).toBe(0);

    const packet = {
      type: "snapshot" as const,
      seq: 1,
      rosterVersion: 1,
      players: {
        positions: first.positions.buffer as ArrayBuffer,
        velocities: first.velocities.buffer as ArrayBuffer,
        states: first.states.buffer as ArrayBuffer,
      },
      eventSeq: 0,
    };
    expect(transferablesForSnapshot(packet)).toEqual([
      packet.players.positions,
      packet.players.velocities,
      packet.players.states,
    ]);
    const recycled = recycleSnapshot(packet);
    expect(recycled.positions).toBe(packet.players.positions);
    pool.release(second);
    pool.release(third);
    pool.release(first);
    expect(pool.available()).toBe(3);
  });

  it("applies three consecutive packets while retaining only two for interpolation", () => {
    const sim = createPlayers();
    const view = new WorkerMatchView(sim.home, sim.away);
    const first = snapshotMatchPacket(sim, 1, { includeMetadata: true });
    expect(view.apply(first)).toEqual([]);
    sim.step(1 / 30, 6);
    const second = snapshotMatchPacket(sim, 2, { includeMetadata: false });
    expect(view.apply(second)).toEqual([]);
    sim.step(1 / 30, 6);
    const third = snapshotMatchPacket(sim, 3, { includeMetadata: false });
    expect(view.apply(third)).toHaveLength(3);
    expect(view.players).toHaveLength(MATCH_PLAYER_COUNT);
    expect(view.players[0]?.id).toBe(sim.players[0]?.id);
  });
});
