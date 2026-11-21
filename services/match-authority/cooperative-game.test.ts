import { describe, expect, it } from "vitest";
import { CanonicalAuthoritativeMatchEngine } from "../../src/game/online/canonical-authoritative-engine.server";
import { CooperativeSeatV2Schema } from "../../src/game/online/cooperative-seat-ticket-v2.server";
import {
  createMatchReceiptSigner,
  verifySignedMatchReceipt,
} from "../../src/game/online/receipt-signing.server";
import { MATCH_SIMULATION_TICK_LIMIT } from "../../src/game/sim-contracts";
import { CooperativeGame } from "./cooperative-game";

const room = "11afad22-c972-40cb-ab23-1b5ff625cb0f";
const idempotencyKey = "8acb617e-4e9a-4f52-b63b-95ada8ac2021";
const secret = "local-cooperative-receipt-test-only-key";
const seats = CooperativeSeatV2Schema.options;
const frame = (sequence: number, kind: string, payload: object) =>
  JSON.stringify({
    type: "command",
    version: 2,
    command: { version: 1, roomId: room, sequence, kind, payload },
  });

describe("staging four-seat match", () => {
  it("requires every seat, applies captain tactics and resumes the same match before and after full time", async () => {
    let engine = new CanonicalAuthoritativeMatchEngine("fla", "pal", "cooperative-test-seed-v2");
    const signer = createMatchReceiptSigner(secret);
    let match = new CooperativeGame(room, engine, signer, idempotencyKey);
    const ready = frame(1, "ready", { ready: true });
    const tactics = frame(2, "set_tactics", {
      formation: "4-3-3",
      mentality: "positive",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "standard",
    });
    for (const seat of seats.slice(0, 3))
      expect(await match.receive(seat, ready)).toEqual({ accepted: true, sequence: 1 });
    expect(await match.advance(seats, 30, 1)).toBeNull();
    expect(match.snapshot(seats).tick).toBe(0);
    expect(await match.receive("away_partner", ready)).toMatchObject({ accepted: true });
    expect(await match.receive("home_partner", tactics)).toMatchObject({ accepted: false });
    expect(await match.receive("home_captain", tactics)).toMatchObject({ accepted: true });
    expect(await match.receive("home_captain", tactics)).toMatchObject({ accepted: false });
    expect(engine.sim.home.tactics.pressing).toBe(2);
    await match.advance(seats, 30, 2);
    const first = match.snapshot(seats);
    expect(first).toMatchObject({ tick: 30, phase: "live" });

    const recover = () => {
      const gameCheckpoint = match.checkpoint();
      const engineCheckpoint = engine.checkpoint();
      engine.dispose();
      engine = new CanonicalAuthoritativeMatchEngine("fla", "pal", "cooperative-test-seed-v2");
      engine.restoreCheckpoint(engineCheckpoint);
      match = new CooperativeGame(room, engine, signer, idempotencyKey);
      match.restore(gameCheckpoint);
    };
    recover();
    expect(match.lastSequence("home_captain")).toBe(2);
    expect(match.snapshot(seats.slice(1))).toMatchObject({ tick: 30, phase: "reconnecting" });
    expect(match.snapshot(seats)).toEqual(first);
    const receipt = await match.advance(seats, MATCH_SIMULATION_TICK_LIMIT, 3);
    expect(receipt).toMatchObject({ idempotencyKey, closureReason: "completed" });
    expect(await verifySignedMatchReceipt(receipt, secret)).toBe(true);
    expect(match.snapshot(seats).publicState.minute).toBeGreaterThanOrEqual(90);
    recover();
    expect(await match.advance(seats, 30, 4)).toEqual(receipt);
    expect(await match.receive("away_captain", tactics)).toMatchObject({ accepted: false });
    engine.dispose();
  }, 45_000);
});
