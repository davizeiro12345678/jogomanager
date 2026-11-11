import { getRealtimeReconnectDelayMs } from "../multiplayer-connection";
import {
  MATCH_PROTOCOL_VERSION,
  assertCurrentTicket,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchCommandV1,
  type MatchTicketV1,
} from "./match-protocol";
import {
  AuthoritativePresentationFeed,
  type AuthorityFeedEvent,
} from "./authoritative-presentation-feed";

export interface AuthorityClientSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
}

export type AuthorityConnectionStatus =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "retrying"
  | "unavailable";

export interface AuthoritySocketClientOptions {
  /** Absolute WSS URL for the server-owned match gateway, never a user input. */
  gatewayUrl: string;
  /** Used to prevent a game key or signed ticket going to a foreign domain. */
  pageOrigin: string;
  roomId: string;
  issueTicket: () => Promise<MatchTicketV1>;
  onEvent: (event: AuthorityFeedEvent) => void;
  onStatus?: (status: AuthorityConnectionStatus) => void;
  socketFactory?: (url: string) => AuthorityClientSocket;
  now?: () => number;
}

const WS_OPEN = 1;
const AUTH_DEADLINE_MS = 5_000;

/**
 * Client transport only. A valid WSS origin, the real server HMAC admission
 * gateway and durable room storage are deployment prerequisites. The client
 * never sends a seed, state, score or reward. Every reconnection requests a
 * new verified ticket; monotonic command sequence survives socket replacement.
 */
export class AuthoritativeMatchSocketClient {
  private readonly feed: AuthoritativePresentationFeed;
  private readonly url: string;
  private socket: AuthorityClientSocket | null = null;
  private ticket: MatchTicketV1 | null = null;
  private started = false;
  private generation = 0;
  private retryCount = 0;
  private sequence = 0;
  private currentStatus: AuthorityConnectionStatus = "disconnected";
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private authTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: AuthoritySocketClientOptions) {
    const target = new URL(options.gatewayUrl);
    const page = new URL(options.pageOrigin);
    const trustedDomain = page.hostname;
    if (
      target.protocol !== "wss:" ||
      page.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.hash ||
      target.search ||
      !trustedDomain ||
      (target.hostname !== trustedDomain && !target.hostname.endsWith("." + trustedDomain))
    )
      throw new Error("match authority must use a trusted same-site WSS gateway");
    this.url = target.toString();
    this.feed = new AuthoritativePresentationFeed(options.roomId);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.connect();
  }

  dispose(): void {
    if (!this.started) return;
    this.started = false;
    this.generation += 1;
    this.clearTimers();
    this.ticket = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      this.clearSocketListeners(socket);
      socket.close(1000, "client_closed");
    }
    this.status("disconnected");
  }

  statusSnapshot(): AuthorityConnectionStatus {
    return this.currentStatus;
  }

  officialFeed(): AuthoritativePresentationFeed {
    return this.feed;
  }

  /**
   * Input is shaped as a command without authority fields. Zod refuses an
   * injected score, seed or identity. Never reuse a sequence after a failed
   * network send: the server may have accepted that frame.
   */
  sendCommand(input: Omit<MatchCommandV1, "version" | "roomId" | "sequence">): boolean {
    const socket = this.socket;
    if (this.currentStatus !== "connected" || !socket || socket.readyState !== WS_OPEN)
      return false;
    if (this.sequence >= Number.MAX_SAFE_INTEGER) return false;
    const command = parseMatchCommandV1({
      ...input,
      version: MATCH_PROTOCOL_VERSION,
      roomId: this.options.roomId,
      sequence: this.sequence + 1,
    });
    this.sequence += 1;
    try {
      socket.send(JSON.stringify({ type: "command", command }));
      return true;
    } catch {
      socket.close(1011, "send_failed");
      return false;
    }
  }

  private async connect(): Promise<void> {
    if (!this.started) return;
    const generation = ++this.generation;
    this.status("connecting");
    try {
      const candidate = parseMatchTicketV1(await this.options.issueTicket());
      if (!this.started || generation !== this.generation) return;
      const now = (this.options.now ?? Date.now)();
      assertCurrentTicket(candidate, now);
      if (candidate.roomId !== this.options.roomId)
        throw new Error("match ticket room mismatch");

      const socket = this.options.socketFactory
        ? this.options.socketFactory(this.url)
        : new WebSocket(this.url);
      this.socket = socket;
      this.ticket = candidate;
      socket.onopen = () => {
        if (!this.isCurrent(socket, generation)) return;
        this.status("authenticating");
        try {
          socket.send(
            JSON.stringify({
              type: "authenticate",
              version: MATCH_PROTOCOL_VERSION,
              ticket: candidate,
            }),
          );
        } catch {
          socket.close(1011, "auth_send_failed");
          return;
        }
        this.authTimer = setTimeout(() => {
          if (this.isCurrent(socket, generation) && this.currentStatus === "authenticating")
            socket.close(1008, "auth_timeout");
        }, AUTH_DEADLINE_MS);
      };
      socket.onmessage = (message) => {
        if (!this.isCurrent(socket, generation)) return;
        const event = this.feed.accept(message.data);
        if (event.kind === "ready") {
          if (event.seat !== candidate.seat) {
            this.status("unavailable");
            socket.close(1008, "seat_mismatch");
            return;
          }
          this.clearAuthTimer();
          this.retryCount = 0;
          this.status("connected");
        }
        if (event.kind === "final") this.clearAuthTimer();
        if (event.kind !== "ignored") this.options.onEvent(event);
      };
      socket.onclose = (close) => {
        if (!this.isCurrent(socket, generation)) return;
        this.clearAuthTimer();
        this.clearSocketListeners(socket);
        this.socket = null;
        this.ticket = null;
        // A rejected signature or a replaced session is not a reason to
        // repeatedly mint new tickets or fight another authorized device.
        if (close.code === 1008 || close.code === 4001) {
          this.status("unavailable");
          return;
        }
        this.retry();
      };
    } catch {
      if (this.started && generation === this.generation) this.retry();
    }
  }

  private retry(): void {
    if (!this.started || this.currentStatus === "unavailable") return;
    const delay = getRealtimeReconnectDelayMs(this.retryCount);
    this.retryCount += 1;
    this.status("retrying");
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private status(status: AuthorityConnectionStatus): void {
    this.currentStatus = status;
    this.options.onStatus?.(status);
  }

  private isCurrent(socket: AuthorityClientSocket, generation: number): boolean {
    return this.started && generation === this.generation && this.socket === socket;
  }

  private clearAuthTimer(): void {
    if (this.authTimer) clearTimeout(this.authTimer);
    this.authTimer = null;
  }

  private clearTimers(): void {
    this.clearAuthTimer();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private clearSocketListeners(socket: AuthorityClientSocket): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
  }
}
