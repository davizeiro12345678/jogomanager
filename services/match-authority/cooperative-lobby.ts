import { z } from "zod";
import {
  CooperativeSeatTicketV2Schema,
  CooperativeSeatV2Schema,
  CooperativeRosterV2Schema,
  cooperativeSeatForUser,
  verifyCooperativeTicketSignature,
  type CooperativeSeatV2,
} from "../../src/game/online/cooperative-seat-ticket-v2.server";

const AuthenticationFrame = z
  .object({
    type: z.literal("authenticate"),
    version: z.literal(2),
    ticket: CooperativeSeatTicketV2Schema,
  })
  .strict();

type LobbySocket = Pick<WebSocket, "readyState" | "bufferedAmount" | "send" | "close">;

interface LobbyOptions {
  roomId: string;
  secret: string;
  loadRoster: () => Promise<unknown>;
  claim: (seat: CooperativeSeatV2, issuedAt: number) => Promise<boolean>;
  now?: () => number;
}

export class CooperativeLobby {
  private readonly peers = new Map<CooperativeSeatV2, LobbySocket>();

  constructor(private readonly options: LobbyOptions) {}

  /** The owning Durable Object serializes admissions and persists the ticket watermark. */
  async attach(socket: LobbySocket, raw: string): Promise<number | null> {
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return null;
    }
    const frame = AuthenticationFrame.safeParse(input);
    if (!frame.success || frame.data.ticket.roomId.toLowerCase() !== this.options.roomId)
      return null;
    const { ticket } = frame.data;
    const now = this.options.now ?? Date.now;
    if (!(await verifyCooperativeTicketSignature(ticket, this.options.secret, now()))) return null;
    const roster = CooperativeRosterV2Schema.safeParse(await this.options.loadRoster());
    if (!roster.success || roster.data.roomId.toLowerCase() !== this.options.roomId) {
      const peers = [...this.peers.values()];
      this.peers.clear();
      for (const peer of peers) peer.close(1008, "room_unavailable");
      return null;
    }
    if (
      ticket.expiresAt <= now() ||
      cooperativeSeatForUser(roster.data, ticket.userId) !== ticket.seat
    )
      return null;
    if (socket.readyState !== 1 || !(await this.options.claim(ticket.seat, ticket.issuedAt)))
      return null;
    if (socket.readyState !== 1) return null;
    const previous = this.peers.get(ticket.seat);
    this.peers.set(ticket.seat, socket);
    if (previous && previous !== socket) previous.close(4001, "session_replaced");
    this.send(socket, {
      type: "admitted",
      version: 2,
      roomId: this.options.roomId,
      seat: ticket.seat,
    });
    this.broadcastPresence();
    return ticket.expiresAt;
  }

  detach(socket: LobbySocket): void {
    for (const [seat, peer] of this.peers) {
      if (peer !== socket) continue;
      this.peers.delete(seat);
      this.broadcastPresence();
      return;
    }
  }

  private send(socket: LobbySocket, frame: object): void {
    if (socket.readyState !== 1) return;
    if (socket.bufferedAmount > 64 * 1024) {
      socket.close(1013, "slow_consumer");
      return;
    }
    try {
      socket.send(JSON.stringify(frame));
    } catch {
      socket.close(1011, "presence_unavailable");
    }
  }

  private broadcastPresence(): void {
    const seats = CooperativeSeatV2Schema.options.filter(
      (seat) => this.peers.get(seat)?.readyState === 1,
    );
    for (const peer of this.peers.values())
      this.send(peer, { type: "presence", version: 2, roomId: this.options.roomId, seats });
  }
}
