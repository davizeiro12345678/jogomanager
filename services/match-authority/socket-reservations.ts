/** Reserve synchronously before asynchronous room loading. */
export class SocketReservations {
  private active = 0;

  constructor(private readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("invalid socket limit");
  }

  tryReserve(): (() => void) | null {
    if (this.active >= this.limit) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };
  }
}

const encoder = new TextEncoder();

/** Validate size before retaining a frame in the room's serialized queue. */
export function reserveTextFrame(slots: SocketReservations, raw: unknown): (() => void) | null {
  if (typeof raw !== "string" || raw.length > 4096 || encoder.encode(raw).byteLength > 4096)
    return null;
  return slots.tryReserve();
}
