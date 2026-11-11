import { MATCH_PROTOCOL_VERSION, parseMatchTicketV1 } from "./match-protocol";
import {
  AuthoritativeSocketBridge,
  type MatchSocket,
} from "./authoritative-socket-bridge.server";

const MAX_AUTH_BYTES = 4096;
const AUTH_DEADLINE_MS = 5_000;
const utf8 = new TextEncoder();

/**
 * One WebSocket's first-frame authentication boundary.
 * The DO/runtime upgrades an HTTP request only after checking its route,
 * origin and resource limits; this class intentionally owns no public route.
 * Unauthenticated sockets never reach AuthoritativeMatchSession.
 */
export class AuthoritativeSocketAdmission {
  private state: "waiting" | "authenticating" | "ready" | "closed" = "waiting";
  private readonly deadline: ReturnType<typeof setTimeout>;

  constructor(
    private readonly bridge: AuthoritativeSocketBridge,
    private readonly socket: MatchSocket,
  ) {
    this.deadline = setTimeout(() => {
      if (this.state === "waiting" || this.state === "authenticating")
        this.deny("authentication_timeout");
    }, AUTH_DEADLINE_MS);
  }

  async onMessage(raw: unknown): Promise<void> {
    if (this.state === "closed") return;
    if (this.state === "ready") {
      await this.bridge.onMessage(this.socket, raw);
      return;
    }
    if (this.state !== "waiting") {
      this.deny("authentication_race");
      return;
    }
    if (
      typeof raw !== "string" ||
      raw.length > MAX_AUTH_BYTES ||
      utf8.encode(raw).byteLength > MAX_AUTH_BYTES
    ) {
      this.deny("invalid_auth_frame");
      return;
    }
    let envelope: unknown;
    try {
      envelope = JSON.parse(raw) as unknown;
    } catch {
      this.deny("invalid_auth_json");
      return;
    }
    if (
      envelope === null ||
      typeof envelope !== "object" ||
      Array.isArray(envelope) ||
      Object.keys(envelope).length !== 3 ||
      !Object.hasOwn(envelope, "type") ||
      !Object.hasOwn(envelope, "version") ||
      !Object.hasOwn(envelope, "ticket")
    ) {
      this.deny("invalid_auth_envelope");
      return;
    }
    const auth = envelope as Record<string, unknown>;
    if (auth["type"] !== "authenticate" || auth["version"] !== MATCH_PROTOCOL_VERSION) {
      this.deny("unsupported_auth");
      return;
    }
    try {
      const ticket = parseMatchTicketV1(auth["ticket"]);
      this.state = "authenticating";
      const seat = await this.bridge.attach(this.socket, ticket);
      if (this.isClosed()) {
        if (seat) this.bridge.detach(this.socket);
        return;
      }
      if (!seat) {
        this.deny("ticket_rejected");
        return;
      }
      clearTimeout(this.deadline);
      this.state = "ready";
    } catch {
      this.deny("ticket_rejected");
    }
  }

  // Avoid TypeScript incorrectly narrowing a mutable field across await:
  // the timeout or another frame can close the admission while HMAC runs.
  private isClosed(): boolean {
    return this.state === "closed";
  }

  detach(): void {
    if (this.state === "closed") return;
    const wasReady = this.state === "ready";
    this.state = "closed";
    clearTimeout(this.deadline);
    if (wasReady) this.bridge.detach(this.socket);
  }

  private deny(reason: string): void {
    if (this.state === "closed") return;
    this.state = "closed";
    clearTimeout(this.deadline);
    this.socket.close(1008, reason);
  }
}
