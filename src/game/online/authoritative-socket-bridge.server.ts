import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchSeat,
  type MatchTicketV1,
} from "./match-protocol";
import { AuthoritativeMatchSession } from "./authoritative-match-session";

/**
 * WebSocket framing around the existing server-owned simulation/session.
 * This is not an unauthenticated HTTP upgrade endpoint: the transport must
 * authenticate the connection and provide a real HMAC verifier before attach.
 */
export interface MatchSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(payload: string): void;
  close(code: number, reason: string): void;
}

export interface SocketBridgeOptions {
  session: AuthoritativeMatchSession;
  /** Must cryptographically verify ticket signature, claims and revocation. */
  verifyTicket: (ticket: MatchTicketV1) => Promise<boolean>;
  now?: () => number;
}

interface Connection {
  socket: MatchSocket;
  ticket: MatchTicketV1;
  seat: MatchSeat;
  lastActivityAt: number;
  strikes: number;
}

const MAX_MESSAGE_BYTES = 4096;
const MAX_BUFFERED_BYTES = 128 * 1024;
const MAX_INACTIVE_MS = 45_000;
const MAX_STRIKES = 3;
const WS_OPEN = 1;
const utf8 = new TextEncoder();

export class AuthoritativeSocketBridge {
  private readonly peers = new Map<MatchSeat, Connection>();
  private readonly now: () => number;
  private announcedFinalKey: string | null = null;

  constructor(private readonly options: SocketBridgeOptions) {
    this.now = options.now ?? Date.now;
  }

  async attach(socket: MatchSocket, ticketInput: unknown): Promise<MatchSeat | null> {
    let ticket: MatchTicketV1;
    try {
      ticket = parseMatchTicketV1(ticketInput);
      // Signature verification happens *before* session.connect; unverified
      // input must never change room liveness, ready state or simulation.
      if (!(await this.options.verifyTicket(ticket))) throw new Error("invalid ticket signature");
      if (socket.readyState !== WS_OPEN) return null;
      const seat = this.options.session.connect(ticket, this.now());
      const previous = this.peers.get(seat);
      const peer: Connection = {
        socket,
        ticket,
        seat,
        lastActivityAt: this.now(),
        strikes: 0,
      };
      this.peers.set(seat, peer);
      if (previous && previous.socket !== socket) previous.socket.close(4001, "session_replaced");
      this.send(peer, {
        type: "ready",
        version: MATCH_PROTOCOL_VERSION,
        seat,
        snapshot: this.options.session.snapshot(),
      });
      return seat;
    } catch {
      socket.close(1008, "ticket_rejected");
      return null;
    }
  }

  /** Called by the WebSocket runtime for each incoming frame, in receive order. */
  async onMessage(socket: MatchSocket, raw: unknown): Promise<void> {
    const peer = this.find(socket);
    if (!peer) {
      socket.close(1008, "not_authenticated");
      return;
    }
    if (
      typeof raw !== "string" ||
      raw.length > MAX_MESSAGE_BYTES ||
      utf8.encode(raw).byteLength > MAX_MESSAGE_BYTES
    ) {
      this.strike(peer, "invalid_frame");
      return;
    }
    let input: unknown;
    try {
      input = JSON.parse(raw) as unknown;
    } catch {
      this.strike(peer, "invalid_json");
      return;
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      this.strike(peer, "invalid_envelope");
      return;
    }
    const envelope = input as Record<string, unknown>;
    const keys = Object.keys(envelope);
    if (envelope["type"] === "ping" && keys.length === 1) {
      peer.lastActivityAt = this.now();
      this.send(peer, { type: "pong", version: MATCH_PROTOCOL_VERSION });
      return;
    }
    if (envelope["type"] !== "command" || keys.length !== 2 || !keys.includes("command")) {
      this.strike(peer, "unsupported_envelope");
      return;
    }
    try {
      const command = parseMatchCommandV1(envelope["command"]);
      const outcome = await this.options.session.receive(peer.ticket, command, this.now());
      peer.lastActivityAt = this.now();
      this.send(peer, {
        type: outcome.accepted ? "ack" : "nack",
        version: MATCH_PROTOCOL_VERSION,
        sequence: command.sequence,
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      });
      if (this.options.session.phase === "finalized") this.broadcastSnapshot();
    } catch {
      this.strike(peer, "invalid_command");
    }
  }

  /** A WebSocket close from a replaced socket must not disconnect its replacement. */
  detach(socket: MatchSocket): void {
    const peer = this.find(socket);
    if (!peer) return;
    this.peers.delete(peer.seat);
    this.options.session.disconnect(peer.ticket.userId, this.now());
  }

  /** The Durable Object calls pulse on its own clock, never from a browser tick. */
  async pulse(): Promise<void> {
    const now = this.now();
    for (const peer of this.peers.values()) {
      if (peer.socket.readyState !== WS_OPEN || now - peer.lastActivityAt > MAX_INACTIVE_MS) {
        peer.socket.close(1001, "connection_timeout");
        this.detach(peer.socket);
      }
    }
    // The room owns its clock; no client can choose a future frame number.
    this.options.session.advanceFixedTick();
    this.broadcastSnapshot();
    const receipt = await this.options.session.expireReconnects(now);
    if (receipt && this.announcedFinalKey !== receipt.idempotencyKey) {
      this.announcedFinalKey = receipt.idempotencyKey;
      this.broadcast({ type: "final", version: MATCH_PROTOCOL_VERSION, receipt });
    }
  }

  broadcastSnapshot(): void {
    this.broadcast({
      type: "snapshot",
      version: MATCH_PROTOCOL_VERSION,
      snapshot: this.options.session.snapshot(),
    });
  }

  close(): void {
    for (const peer of this.peers.values()) peer.socket.close(1001, "server_shutdown");
    this.peers.clear();
  }

  private find(socket: MatchSocket): Connection | undefined {
    for (const peer of this.peers.values()) if (peer.socket === socket) return peer;
    return undefined;
  }

  private strike(peer: Connection, reason: string): void {
    peer.strikes += 1;
    this.send(peer, { type: "error", version: MATCH_PROTOCOL_VERSION, reason });
    if (peer.strikes >= MAX_STRIKES) {
      peer.socket.close(1008, "too_many_invalid_messages");
      this.detach(peer.socket);
    }
  }

  private send(peer: Connection, payload: object): void {
    if (peer.socket.readyState !== WS_OPEN) return;
    if (peer.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      peer.socket.close(1013, "slow_consumer");
      this.detach(peer.socket);
      return;
    }
    try {
      peer.socket.send(JSON.stringify(payload));
    } catch {
      this.detach(peer.socket);
    }
  }

  private broadcast(payload: object): void {
    for (const peer of this.peers.values()) this.send(peer, payload);
  }
}
