import {
  MATCH_PROTOCOL_VERSION,
  MatchCommandV1Schema,
  assertCurrentTicket,
  parseMatchTicketV1,
  parseMatchReceiptV1,
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
  advanceFixedStep(): void;
  isFinished?(): boolean;
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

interface AuthoritativeMatchSessionCommonOptions {
  roomId: string;
  homeTicket: MatchTicketV1;
  engine: AuthoritativeMatchEngine;
  signer: MatchReceiptSigner;
  simulationVersion: string;
  idempotencyKey: string;
  commandLimits?: Partial<Record<MatchCommandKind, CommandRateLimit>> | undefined;
}

export type AuthoritativeMatchSessionOptions = AuthoritativeMatchSessionCommonOptions &
  ({ awayIsAi: true; awayTicket?: never } | { awayIsAi?: false; awayTicket: MatchTicketV1 });

const RECONNECT_WINDOW_MS = 60_000;
const MAX_PENDING_COMMANDS = 64;
const DEFAULT_COMMAND_LIMITS: Record<MatchCommandKind, CommandRateLimit> = {
  ready: { limit: 5, windowMs: 10_000 },
  set_tactics: { limit: 12, windowMs: 10_000 },
  substitute: { limit: 6, windowMs: 60_000 },
  forfeit: { limit: 3, windowMs: 10_000 },
  ack_snapshot: { limit: 120, windowMs: 10_000 },
};

/**
 * Server-only match coordinator. It accepts narrow, signed commands and
 * publishes only presentation-safe state; the engine remains the sole owner
 * of score, simulation and rewards.
 */
export class AuthoritativeMatchSession {
  readonly invalidAttempts: InvalidMatchCommand[] = [];

  private readonly tickets: { home: MatchTicketV1; away: MatchTicketV1 | null };
  private readonly connected = new Set<string>();
  private readonly readySeats = new Set<MatchSeat>();
  private readonly lastSequence = new Map<string, number>();
  private readonly rateWindows = new Map<string, number[]>();
  private readonly reconnectDeadlines = new Map<MatchSeat, number>();
  private readonly tactics = new Map<MatchSeat, TacticalCommandPayloadV1>();
  private commandHash = GENESIS_SESSION_HASH;
  private tick = 0;
  private revision = 0;
  private receipt: MatchReceiptV1 | null = null;
  private workQueue: Promise<void> = Promise.resolve();
  private pendingWork = 0;
  phase: MatchSessionPhase = "waiting";

  constructor(private readonly options: AuthoritativeMatchSessionOptions) {
    if ((options.awayIsAi && options.awayTicket) || (!options.awayIsAi && !options.awayTicket)) {
      throw new Error("match must have either an AI opponent or an away ticket");
    }
    if (
      options.homeTicket.roomId !== options.roomId ||
      (options.awayTicket && options.awayTicket.roomId !== options.roomId)
    ) {
      throw new Error("match tickets must belong to the session room");
    }
    if (
      options.homeTicket.seat !== "home" ||
      (options.awayTicket && options.awayTicket.seat !== "away")
    ) {
      throw new Error("match tickets must be assigned to their matching seats");
    }
    if (options.awayTicket?.userId === options.homeTicket.userId) {
      throw new Error("human match seats must belong to distinct accounts");
    }
    this.tickets = { home: options.homeTicket, away: options.awayTicket ?? null };
    if (options.awayIsAi) this.readySeats.add("away");
  }

  connect(ticket: MatchTicketV1, now: number): MatchSeat {
    this.assertBoundTicket(ticket, now);
    const reconnectDeadline = this.reconnectDeadlines.get(ticket.seat);
    if (reconnectDeadline !== undefined && now >= reconnectDeadline) {
      throw new Error("match reconnection window expired");
    }
    this.connected.add(ticket.userId);
    this.reconnectDeadlines.delete(ticket.seat);
    this.refreshPhase();
    return ticket.seat;
  }

  disconnect(userId: string, now: number): void {
    const seat = this.seatForUser(userId);
    if (!seat || this.phase === "finalized") return;
    this.connected.delete(userId);
    this.reconnectDeadlines.set(seat, now + RECONNECT_WINDOW_MS);
    this.phase = "reconnecting";
  }

  receive(
    ticket: MatchTicketV1,
    command: MatchCommandV1,
    now: number,
  ): Promise<MatchCommandOutcome> {
    if (this.pendingWork >= MAX_PENDING_COMMANDS) {
      return Promise.resolve({ accepted: false, reason: "rate_limited" });
    }
    return this.serialize(() => this.receiveSerial(ticket, command, now));
  }

  private async receiveSerial(
    ticket: MatchTicketV1,
    input: MatchCommandV1,
    now: number,
  ): Promise<MatchCommandOutcome> {
    const seat = this.connect(ticket, now);
    const parsed = MatchCommandV1Schema.safeParse(input);
    if (!parsed.success) return this.reject(ticket.userId, 0, "command_rejected", now);
    const command = parsed.data;
    if (this.receipt) return this.reject(ticket.userId, command.sequence, "command_rejected", now);
    if (command.roomId !== this.options.roomId) {
      return this.reject(ticket.userId, command.sequence, "command_rejected", now);
    }

    const priorSequence = this.lastSequence.get(ticket.userId) ?? 0;
    if (command.sequence <= priorSequence) {
      return this.reject(ticket.userId, command.sequence, "sequence_not_monotonic", now);
    }
    if (!this.reserveRateWindow(ticket.userId, command.kind, now)) {
      return this.reject(ticket.userId, command.sequence, "rate_limited", now);
    }

    let applied = true;
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
        break;
      case "ready":
        this.readySeats.add(seat);
        this.refreshPhase();
        break;
      case "ack_snapshot":
        break;
    }

    if (!applied) return this.reject(ticket.userId, command.sequence, "command_rejected", now);
    this.lastSequence.set(ticket.userId, command.sequence);
    this.commandHash = (await appendCommandHash(this.commandHash, command)).hash;
    if (command.kind === "forfeit") await this.finalizeSerial("forfeit", now, seat);
    return { accepted: true };
  }

  advanceFixedTick(): void {
    // Preserve a total ordering between accepted commands and engine ticks.
    if (this.pendingWork > 0) return;
    if (this.options.engine.isFinished?.()) return;
    if (this.phase !== "live" && this.phase !== "reconnecting") return;
    this.options.engine.advanceFixedStep();
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

  expireReconnects(now: number): Promise<MatchReceiptV1 | null> {
    return this.serialize(async () => {
      if (this.phase === "finalized") return this.receipt;
      for (const [seat, deadline] of this.reconnectDeadlines) {
        if (now >= deadline) return this.finalizeSerial("abandoned", now, seat);
      }
      return null;
    });
  }

  finalize(
    closureReason: MatchClosureReason,
    now: number,
    loser?: MatchSeat,
  ): Promise<MatchReceiptV1> {
    return this.serialize(() => this.finalizeSerial(closureReason, now, loser));
  }

  private async finalizeSerial(
    closureReason: MatchClosureReason,
    now: number,
    loser?: MatchSeat,
  ): Promise<MatchReceiptV1> {
    if (this.receipt) return this.receipt;
    const unsigned = {
      version: MATCH_PROTOCOL_VERSION,
      roomId: this.options.roomId,
      simulationVersion: this.options.simulationVersion,
      commandHash: this.commandHash,
      result: this.options.engine.finalResult(loser),
      closureReason,
      idempotencyKey: this.options.idempotencyKey,
      issuedAt: now,
    } as const;
    const signature = await this.options.signer.sign(unsigned);
    this.receipt = parseMatchReceiptV1({ ...unsigned, signature });
    this.phase = "finalized";
    return this.receipt;
  }

  private assertBoundTicket(ticket: MatchTicketV1, now: number): void {
    assertCurrentTicket(parseMatchTicketV1(ticket), now);
    if (ticket.roomId !== this.options.roomId) {
      throw new Error("ticket room does not match this authoritative match session");
    }
    const expected = this.tickets[ticket.seat];
    if (
      !expected ||
      ticket.userId !== expected.userId ||
      ticket.nonce !== expected.nonce ||
      ticket.issuedAt !== expected.issuedAt ||
      ticket.expiresAt !== expected.expiresAt ||
      ticket.signature !== expected.signature
    ) {
      throw new Error("ticket does not belong to this authoritative match session");
    }
  }

  private seatForUser(userId: string): MatchSeat | null {
    if (this.tickets.home.userId === userId) return "home";
    if (this.tickets.away?.userId === userId) return "away";
    return null;
  }

  private refreshPhase(): void {
    if (this.phase === "finalized") return;
    if (this.connected.size === (this.tickets.away ? 2 : 1) && this.readySeats.size === 2) {
      this.phase = "live";
      return;
    }
    this.phase = this.reconnectDeadlines.size > 0 ? "reconnecting" : "waiting";
  }

  private reject(
    userId: string,
    sequence: number,
    reason: InvalidMatchCommand["reason"],
    at: number,
  ): MatchCommandOutcome {
    if (this.invalidAttempts.length >= 256) this.invalidAttempts.shift();
    this.invalidAttempts.push({ userId, sequence, reason, at });
    return { accepted: false, reason };
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    this.pendingWork += 1;
    const result = this.workQueue.then(operation);
    this.workQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      this.pendingWork -= 1;
    });
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
