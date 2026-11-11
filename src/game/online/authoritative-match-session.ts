import {
  MATCH_PROTOCOL_VERSION,
  assertCurrentTicket,
  parseMatchCommandV1,
  parseMatchReceiptV1,
  parseMatchTicketV1,
  type MatchCommandKind,
  type MatchCommandV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type MatchSnapshotV1,
  type MatchTicketV1,
  type PresentationEventV1,
  type TacticalCommandPayloadV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";

export type MatchSessionPhase = "waiting" | "live" | "reconnecting" | "finalized";
export type MatchClosureReason = MatchReceiptV1["closureReason"];

export interface AuthoritativeMatchEngine {
  advanceFixedStep(): boolean;
  publicState(): MatchPublicStateV1;
  presentationEvents(): PresentationEventV1[];
  applyTactics(seat: MatchSeat, payload: TacticalCommandPayloadV1): boolean;
  substitute(seat: MatchSeat, playerOut: string, playerIn: string): boolean;
  finalResult(loser?: MatchSeat): MatchReceiptV1["result"];
}

export interface MatchReceiptSigner {
  sign(receipt: Omit<MatchReceiptV1, "signature">): Promise<string>;
}

export interface CommandRateLimit {
  limit: number;
  windowMs: number;
}

export interface InvalidMatchCommand {
  userId: string;
  sequence: number;
  reason: "sequence_not_monotonic" | "rate_limited" | "command_rejected";
  at: number;
}

export interface MatchCommandOutcome {
  accepted: boolean;
  reason?: InvalidMatchCommand["reason"];
}

export interface AuthoritativeMatchSessionOptions {
  roomId: string;
  homeTicket: MatchTicketV1;
  awayTicket: MatchTicketV1;
  engine: AuthoritativeMatchEngine;
  signer: MatchReceiptSigner;
  simulationVersion: string;
  idempotencyKey: string;
  commandLimits?: Partial<Record<MatchCommandKind, CommandRateLimit>> | undefined;
  /** Installed by the trusted server owner, never supplied by a client. */
  verifyTicket?: ((ticket: MatchTicketV1) => Promise<boolean>) | undefined;
  /** Wall clock used to recheck expiry after asynchronous signature verification. */
  now?: (() => number) | undefined;
}

const RECONNECT_WINDOW_MS = 60_000;
const MAX_PENDING_COMMANDS = 64;
const MAX_RECORDED_INVALID_COMMANDS = 128;
const DEFAULT_COMMAND_LIMITS: Record<MatchCommandKind, CommandRateLimit> = {
  ready: { limit: 6, windowMs: 10_000 },
  set_tactics: { limit: 12, windowMs: 10_000 },
  substitute: { limit: 12, windowMs: 10_000 },
  forfeit: { limit: 2, windowMs: 10_000 },
  ack_snapshot: { limit: 120, windowMs: 10_000 },
};

/**
 * Server-only match coordinator. It accepts narrow, signed commands and
 * publishes only presentation-safe state; the engine remains the sole owner
 * of score, simulation and rewards.
 */
export class AuthoritativeMatchSession {
  readonly invalidAttempts: InvalidMatchCommand[] = [];

  private readonly tickets: Record<MatchSeat, MatchTicketV1>;
  private readonly connected = new Set<string>();
  private readonly readySeats = new Set<MatchSeat>();
  private readonly lastSequence = new Map<string, number>();
  private readonly rateWindows = new Map<string, number[]>();
  private readonly reconnectDeadlines = new Map<MatchSeat, number>();
  private readonly tactics = new Map<MatchSeat, TacticalCommandPayloadV1>();
  private commandHash = GENESIS_SESSION_HASH;
  private commandQueue: Promise<void> = Promise.resolve();
  private pendingCommands = 0;
  private unsignedReceipt: Omit<MatchReceiptV1, "signature"> | null = null;
  private tick = 0;
  private revision = 0;
  private receipt: MatchReceiptV1 | null = null;
  private finalizationPromise: Promise<MatchReceiptV1> | null = null;
  private closing = false;
  private started = false;
  private closure: Pick<MatchReceiptV1, "closureReason" | "issuedAt" | "result"> | undefined;
  phase: MatchSessionPhase = "waiting";

  constructor(private readonly options: AuthoritativeMatchSessionOptions) {
    if (
      options.homeTicket.roomId !== options.roomId ||
      options.awayTicket.roomId !== options.roomId
    ) {
      throw new Error("match tickets must belong to the session room");
    }
    if (options.homeTicket.seat !== "home" || options.awayTicket.seat !== "away") {
      throw new Error("match tickets must be assigned to their matching seats");
    }
    if (options.homeTicket.userId === options.awayTicket.userId) {
      throw new Error("match seats must belong to different users");
    }
    this.tickets = { home: { ...options.homeTicket }, away: { ...options.awayTicket } };
  }

  connect(ticket: MatchTicketV1, now: number): MatchSeat {
    this.assertBoundTicket(ticket, now);
    if (this.phase === "finalized" || this.closing) return ticket.seat;
    const deadline = this.reconnectDeadlines.get(ticket.seat);
    if (deadline !== undefined && now >= deadline) throw new Error("reconnection window expired");
    this.connected.add(ticket.userId);
    this.reconnectDeadlines.delete(ticket.seat);
    this.refreshPhase();
    return ticket.seat;
  }

  /** Replace an expired or expiring seat ticket without resetting match state.
   * Issuance and user reauthentication belong to the transport owner. */
  async renewTicket(input: unknown): Promise<void> {
    const verify = this.options.verifyTicket;
    if (!verify) throw new Error("match ticket renewal verifier is not configured");
    // Parsing creates a private copy so a caller cannot change the claims
    // while the asynchronous signature check is in flight.
    const candidate = Object.freeze(parseMatchTicketV1(input));
    this.assertEligibleRenewal(candidate, (this.options.now ?? Date.now)());
    let valid = false;
    try {
      valid = await verify(candidate);
    } catch {
      // Fail closed without exposing signer or key configuration details.
    }
    if (!valid) throw new Error("invalid match ticket signature");
    // A newer ticket, finalization, expiry, or a reconnect timeout may have
    // won the race while the verifier was waiting for Web Crypto.
    this.assertEligibleRenewal(candidate, (this.options.now ?? Date.now)());
    this.tickets[candidate.seat] = { ...candidate };
  }

  disconnect(userId: string, now: number): void {
    const seat = this.seatForUser(userId);
    if (!seat || !this.connected.has(userId) || this.closing || this.phase === "finalized") return;
    this.connected.delete(userId);
    this.reconnectDeadlines.set(seat, now + RECONNECT_WINDOW_MS);
    this.setPhase("reconnecting");
  }

  async receive(
    ticket: MatchTicketV1,
    command: MatchCommandV1,
    now: number,
  ): Promise<MatchCommandOutcome> {
    this.assertBoundTicket(ticket, now);
    const input = parseMatchCommandV1(command);
    // Reject cross-room commands before reconnecting a seat or mutating
    // liveness. A valid ticket must not admit a command for another room.
    if (input.roomId !== this.options.roomId)
      return this.reject(ticket.userId, input.sequence, "command_rejected", now);
    if (this.closing || this.receipt || this.phase === "finalized")
      return this.reject(ticket.userId, input.sequence, "command_rejected", now);
    if (this.pendingCommands >= MAX_PENDING_COMMANDS)
      return this.reject(ticket.userId, input.sequence, "rate_limited", now);

    // Admit connection synchronously; queue draining must not cancel a
    // disconnect/reconnect deadline that occurs after this command arrives.
    const seat = this.connect(ticket, now);
    const userId = ticket.userId;
    this.pendingCommands += 1;
    const outcome = this.commandQueue.then(() => this.applyCommand(seat, userId, input, now));
    this.commandQueue = outcome.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await outcome;
    } finally {
      this.pendingCommands -= 1;
    }
  }

  private async applyCommand(
    seat: MatchSeat,
    userId: string,
    command: MatchCommandV1,
    now: number,
  ): Promise<MatchCommandOutcome> {
    if (this.closing || this.receipt)
      return this.reject(userId, command.sequence, "command_rejected", now);
    if (command.roomId !== this.options.roomId)
      return this.reject(userId, command.sequence, "command_rejected", now);

    const priorSequence = this.lastSequence.get(userId) ?? 0;
    if (command.sequence <= priorSequence)
      return this.reject(userId, command.sequence, "sequence_not_monotonic", now);
    if (!this.reserveRateWindow(userId, command.kind, now))
      return this.reject(userId, command.sequence, "rate_limited", now);

    // Hash and validate before applying any engine effect. If hashing fails,
    // the engine remains unchanged and the queue is recovered for later input.
    const { hash } = await appendCommandHash(this.commandHash, command);
    if (this.closing || this.receipt)
      return this.reject(userId, command.sequence, "command_rejected", now);

    let applied = true;
    let closureReason: MatchClosureReason | undefined;
    switch (command.kind) {
      case "set_tactics":
        applied = this.options.engine.applyTactics(seat, command.payload);
        if (applied) this.tactics.set(seat, command.payload);
        break;
      case "substitute":
        applied = this.options.engine.substitute(
          seat,
          command.payload.playerOut,
          command.payload.playerIn,
        );
        break;
      case "forfeit":
        closureReason = "forfeit";
        break;
      case "ready":
        this.readySeats.add(seat);
        this.refreshPhase();
        break;
      case "ack_snapshot":
        break;
    }

    if (!applied) return this.reject(userId, command.sequence, "command_rejected", now);
    this.lastSequence.set(userId, command.sequence);
    this.commandHash = hash;
    if (closureReason) await this.finalize(closureReason, now, seat);
    return { accepted: true };
  }

  advanceFixedTick(): void {
    if (this.closing) return;
    if (!this.started || (this.phase !== "live" && this.phase !== "reconnecting")) return;
    if (!this.options.engine.advanceFixedStep()) return;
    this.tick += 1;
    this.revision += 1;
  }

  snapshot(): MatchSnapshotV1 {
    return {
      version: MATCH_PROTOCOL_VERSION,
      roomId: this.options.roomId,
      tick: this.tick,
      revision: this.revision,
      phase: this.phase,
      publicState: this.options.engine.publicState(),
      presentationEvents: this.options.engine.presentationEvents().slice(0, 64),
    };
  }

  lastTacticsFor(seat: MatchSeat): TacticalCommandPayloadV1 | undefined {
    return this.tactics.get(seat);
  }

  async expireReconnects(now: number): Promise<MatchReceiptV1 | null> {
    if (this.phase === "finalized") return this.receipt ?? this.finalize("completed", now);
    for (const [seat, deadline] of this.reconnectDeadlines) {
      if (now >= deadline) return this.finalize("abandoned", now, seat);
    }
    return null;
  }

  async finalize(
    closureReason: MatchClosureReason,
    now: number,
    loser?: MatchSeat,
  ): Promise<MatchReceiptV1> {
    if (this.receipt) return this.receipt;
    // Freeze phase, result and command hash synchronously. Signing is delivery,
    // not authority: pending commands and ticks cannot change this receipt.
    this.closing = true;
    this.unsignedReceipt ??= {
      version: MATCH_PROTOCOL_VERSION,
      roomId: this.options.roomId,
      simulationVersion: this.options.simulationVersion,
      commandHash: this.commandHash,
      result: { ...this.options.engine.finalResult(loser) },
      closureReason,
      idempotencyKey: this.options.idempotencyKey,
      issuedAt: now,
    };
    this.phase = "finalized";
    const unsigned = this.unsignedReceipt;
    const finalizationPromise =
      this.finalizationPromise ??
      (this.finalizationPromise = (async () => {
        const signature = await this.options.signer.sign({
          ...unsigned,
          result: { ...unsigned.result },
        });
        const receipt = parseMatchReceiptV1({ ...unsigned, signature });
        this.receipt = receipt;
        this.phase = "finalized";
        return receipt;
      })());

    try {
      return await finalizationPromise;
    } catch (error) {
      if (this.finalizationPromise === finalizationPromise) this.finalizationPromise = null;
      throw error;
    }
  }

  private assertBoundTicket(ticket: MatchTicketV1, now: number): void {
    assertCurrentTicket(ticket, now);
    if (ticket.issuedAt > now) throw new Error("match ticket is not yet valid");
    if (ticket.roomId !== this.options.roomId) {
      throw new Error("ticket room does not match this authoritative match session");
    }
    const expected = this.tickets[ticket.seat];
    if (
      ticket.userId !== expected.userId ||
      ticket.version !== expected.version ||
      ticket.issuedAt !== expected.issuedAt ||
      ticket.expiresAt !== expected.expiresAt ||
      ticket.nonce !== expected.nonce ||
      ticket.signature !== expected.signature
    ) {
      throw new Error("ticket does not belong to this authoritative match session");
    }
  }

  private assertEligibleRenewal(ticket: MatchTicketV1, now: number): void {
    if (this.closing || this.receipt) throw new Error("match ticket renewal is closed");
    assertCurrentTicket(ticket, now);
    const expected = this.tickets[ticket.seat];
    if (
      ticket.roomId !== this.options.roomId ||
      ticket.userId !== expected.userId ||
      ticket.version !== expected.version ||
      ticket.issuedAt <= expected.issuedAt ||
      ticket.expiresAt <= expected.expiresAt ||
      ticket.nonce === expected.nonce
    ) {
      throw new Error("match ticket renewal does not match the current seat");
    }
    const deadline = this.reconnectDeadlines.get(ticket.seat);
    if (deadline !== undefined && now >= deadline) throw new Error("reconnection window expired");
  }

  private seatForUser(userId: string): MatchSeat | null {
    if (this.tickets.home.userId === userId) return "home";
    if (this.tickets.away.userId === userId) return "away";
    return null;
  }

  private refreshPhase(): void {
    if (this.closing || this.phase === "finalized") return;
    if (this.connected.size === 2 && this.readySeats.size === 2) {
      this.started = true;
      this.setPhase("live");
      return;
    }
    this.setPhase(this.reconnectDeadlines.size > 0 ? "reconnecting" : "waiting");
  }

  private setPhase(phase: MatchSessionPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.revision += 1;
  }

  private reject(
    userId: string,
    sequence: number,
    reason: InvalidMatchCommand["reason"],
    at: number,
  ): MatchCommandOutcome {
    if (this.invalidAttempts.length >= MAX_RECORDED_INVALID_COMMANDS)
      this.invalidAttempts.splice(
        0,
        this.invalidAttempts.length - MAX_RECORDED_INVALID_COMMANDS + 1,
      );
    this.invalidAttempts.push({ userId, sequence, reason, at });
    return { accepted: false, reason };
  }

  private reserveRateWindow(userId: string, kind: MatchCommandKind, now: number): boolean {
    const limit = this.options.commandLimits?.[kind] ?? DEFAULT_COMMAND_LIMITS[kind];
    if (limit.limit < 1 || limit.windowMs < 1) return false;
    const key = `${userId}:${kind}`;
    const liveEntries = (this.rateWindows.get(key) ?? []).filter((at) => now - at < limit.windowMs);
    if (liveEntries.length >= limit.limit) {
      this.rateWindows.set(key, liveEntries);
      return false;
    }
    liveEntries.push(now);
    this.rateWindows.set(key, liveEntries);
    return true;
  }
}
