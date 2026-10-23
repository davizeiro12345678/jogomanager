import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import {
  MatchSim,
  MATCH_SIMULATION_STEP,
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_TICK_LIMIT,
} from "./sim";
import { snapshotMatch } from "./live-match";
import { LiveSnapshotEncoder, LiveSnapshotDecoder, PLAYER_FRAME_FIELDS } from "./live-transport";
import { initSync, evaluate_pass_lanes_into } from "./wasm/pkg/crowd_visibility_wasm";

it("keeps full canonical matches, checkpoint replay and JS/WASM decisions consistent", () => {
  initSync({
    module: readFileSync(new URL("./wasm/pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
  });
  const results: unknown[] = [];
  for (const [seed, knockout] of [
    ["reliability-20261020-0", false],
    ["reliability-20261020-1", true],
  ] as const) {
    const create = () =>
      new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed, { knockout });
    const canonical = create(),
      wasm = create();
    wasm.setPassLaneIntoKernel(evaluate_pass_lanes_into, "wasm");
    let recovered: MatchSim | undefined;
    const encoder = new LiveSnapshotEncoder(20261020),
      decoder = new LiveSnapshotDecoder();
    let ticks = 0,
      seq = 0,
      lastTime = 0,
      lastEvents = 0;
    try {
      while (!canonical.finished && ticks < MATCH_SIMULATION_TICK_LIMIT) {
        canonical.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
        wasm.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
        recovered?.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
        ticks++;
        if (ticks === 1024) {
          recovered = create();
          recovered.restoreCheckpoint(canonical.checkpoint());
        }
        if (ticks % 120 === 0 || canonical.finished) {
          expect(canonical.time, seed).toBeGreaterThanOrEqual(lastTime);
          expect(canonical.lastEventId, seed).toBeGreaterThanOrEqual(lastEvents);
          lastTime = canonical.time;
          lastEvents = canonical.lastEventId;
          expect(canonical.events.length, seed).toBeLessThanOrEqual(80);
          expect(canonical.players, seed).toHaveLength(22);
          expect(new Set(canonical.players.map((p) => p.id)).size, seed).toBe(22);
          for (const p of canonical.players) {
            expect(
              PLAYER_FRAME_FIELDS.every((field) => Number.isFinite(p[field])),
              `${seed}:${p.id}`,
            ).toBe(true);
            expect(p.stamina, seed).toBeGreaterThanOrEqual(0);
            expect(p.stamina, seed).toBeLessThanOrEqual(100);
          }
          expect(
            [
              canonical.ball.x,
              canonical.ball.z,
              canonical.ball.vx,
              canonical.ball.vz,
              canonical.ball.height,
            ].every(Number.isFinite),
            seed,
          ).toBe(true);
          if (canonical.ball.holder)
            expect(
              canonical.players.some((p) => p.id === canonical.ball.holder && !p.sentOff),
              seed,
            ).toBe(true);
          const snapshot = snapshotMatch(canonical, ++seq);
          const packet = encoder.encode(snapshot)!;
          const received = structuredClone(packet, { transfer: [packet.frame.buffer] });
          const decoded = decoder.decode(received)!;
          expect(decoded.eventSeq, seed).toBe(canonical.lastEventId);
          expect(decoded.events, seed).toEqual(snapshot.events);
          expect(decoded.stats, seed).toEqual(snapshot.stats);
          for (let i = 0; i < decoded.players.length; i++)
            for (const field of PLAYER_FRAME_FIELDS)
              expect(decoded.players[i]![field], `${seed}:${field}`).toBe(
                Math.fround(snapshot.players[i]![field]),
              );
          encoder.recycle(
            received.session,
            received.slot,
            structuredClone(received.frame.buffer, { transfer: [received.frame.buffer] }),
          );
          expect(wasm.players, seed).toEqual(canonical.players);
          expect(wasm.ball, seed).toEqual(canonical.ball);
          expect(wasm.stats, seed).toEqual(canonical.stats);
          expect(wasm.events, seed).toEqual(canonical.events);
          if (recovered) expect(recovered.checkpoint(), seed).toEqual(canonical.checkpoint());
        }
      }
      expect(canonical.finished, seed).toBe(true);
      expect(wasm.finished, seed).toBe(true);
      expect(canonical.phase, seed).toBe("done");
      expect(
        canonical.events.filter((e) => e.type === "fulltime"),
        seed,
      ).toHaveLength(1);
      const final = canonical.checkpoint();
      canonical.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
      expect(canonical.checkpoint(), seed).toEqual(final);
      results.push({
        seed,
        knockout,
        ticks,
        time: canonical.time,
        score: [canonical.stats.home.goals, canonical.stats.away.goals],
        eventSeq: canonical.lastEventId,
        shootout: canonical.shootout.length,
      });
    } finally {
      canonical.dispose();
      wasm.dispose();
      recovered?.dispose();
    }
  }
  const directory = new URL("../../verification/reliability-20261020/", import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL("simulation-seeds.json", directory), JSON.stringify(results, null, 2));
}, 180_000);
