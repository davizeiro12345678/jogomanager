import { describe, expect, it } from "vitest";
import { SocketReservations, reserveTextFrame } from "./socket-reservations";

describe("socket reservations", () => {
  it("reserves before asynchronous room loading and releases a slot once", async () => {
    const slots = new SocketReservations(8);
    let unblock!: () => void;
    const wait = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const attempts = Array.from({ length: 20 }, async () => {
      const release = slots.tryReserve();
      if (!release) return false;
      await wait;
      return release;
    });
    expect(slots.tryReserve()).toBeNull();
    unblock();
    const results = await Promise.all(attempts);
    const accepted = results.filter((result): result is () => void => typeof result === "function");
    expect(accepted).toHaveLength(8);
    accepted[0]!();
    accepted[0]!();
    expect(slots.tryReserve()).not.toBeNull();
    expect(slots.tryReserve()).toBeNull();
  });

  it("bounds queued UTF-8 frames and makes capacity available after processing", () => {
    const queue = new SocketReservations(2);
    expect(reserveTextFrame(queue, new ArrayBuffer(1))).toBeNull();
    expect(reserveTextFrame(queue, "é".repeat(2049))).toBeNull();
    const first = reserveTextFrame(queue, "a".repeat(4096));
    const second = reserveTextFrame(queue, "{} ");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(reserveTextFrame(queue, "{} ")).toBeNull();
    first!();
    expect(reserveTextFrame(queue, "{} ")).not.toBeNull();
  });
});
