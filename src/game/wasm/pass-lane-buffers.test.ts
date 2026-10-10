import { describe, expect, it } from "vitest";
import { PassLaneBuffers } from "./pass-lane-buffers";

describe("per-match spatial scratch", () => {
  it("reuses capacity and views while matching player order and current values", () => {
    const buffers = new PassLaneBuffers();
    const players = [{ x: 1, z: 2, vx: 3, vz: 4 }];
    const first = buffers.pack(players);
    players[0]!.x = 9;
    expect(buffers.pack(players)).toBe(first);
    expect(Array.from(first)).toEqual([9, 2, 3, 4]);
    expect(buffers.pack([])).toHaveLength(0);
    expect(buffers.pack(players)).toBe(first);
  });
  it("isolates squads and bounds oversized input to the kernel contract", () => {
    const receivers = new PassLaneBuffers();
    const defenders = new PassLaneBuffers();
    const player = { x: 1, z: 2, vx: 3, vz: 4 };
    const packed = receivers.pack([player]);
    defenders.pack([{ ...player, x: 20 }]);
    expect(packed[0]).toBe(1);
    expect(receivers.pack(Array(1000).fill(player))).toHaveLength(256);
  });
});
