import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuthoritativeMatchSocketClient,
  type AuthorityClientSocket,
} from "./authoritative-socket-client";
import type { MatchTicketV1 } from "./match-protocol";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const userId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const startAt = 1_700_000_000_000;
const state = (revision: number) => ({
  version: 1,
  roomId,
  revision,
  tick: revision,
  phase: "live",
  publicState: {
    minute: 0,
    score: { home: 0, away: 0 },
    possession: { home: 50, away: 50 },
  },
  presentationEvents: [],
});
const frame = (payload: object) => JSON.stringify({ version: 1, ...payload });
function ticket(now: number): MatchTicketV1 {
  return {
    version: 1,
    roomId,
    userId,
    seat: "home",
    issuedAt: now,
    expiresAt: now + 90_000,
    nonce: `test-nonce-${now}-for-client`,
    signature: "signed-test-ticket-with-correct-safe-format",
  };
}

class FakeSocket implements AuthorityClientSocket {
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly sent: string[] = [];
  closeCode: number | null = null;

  send(raw: string): void {
    if (this.readyState !== 1) throw new Error("socket closed");
    this.sent.push(raw);
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  message(raw: string): void {
    this.onmessage?.({ data: raw } as MessageEvent);
  }
  close(code = 1000): void {
    this.closeCode = code;
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }
}

function fixture() {
  let now = startAt;
  let requested = 0;
  const sockets: FakeSocket[] = [];
  const events: string[] = [];
  const statuses: string[] = [];
  const client = new AuthoritativeMatchSocketClient({
    gatewayUrl: "wss://match.jogomanager.com/rooms",
    pageOrigin: "https://jogomanager.com",
    roomId,
    issueTicket: async () => {
      requested += 1;
      return ticket(now);
    },
    onEvent: (event) => events.push(event.kind),
    onStatus: (status) => statuses.push(status),
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    now: () => now,
  });
  return {
    client,
    sockets,
    events,
    statuses,
    requests: () => requested,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const flush = async () => {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
});

describe("staged authoritative WSS client", () => {
  it("rejects an insecure or foreign-host gateway before sending a signed ticket", () => {
    const f = fixture();
    expect(
      () =>
        new AuthoritativeMatchSocketClient({
          gatewayUrl: "wss://evil.example/rooms",
          pageOrigin: "https://jogomanager.com",
          roomId,
          issueTicket: async () => ticket(startAt),
          onEvent: () => undefined,
        }),
    ).toThrow(/trusted/i);
    expect(
      () =>
        new AuthoritativeMatchSocketClient({
          gatewayUrl: "ws://match.jogomanager.com/rooms",
          pageOrigin: "https://jogomanager.com",
          roomId,
          issueTicket: async () => ticket(startAt),
          onEvent: () => undefined,
        }),
    ).toThrow(/trusted/i);
    expect(f.requests()).toBe(0);
  });

  it("waits for signed server ready before allowing sequenced player commands", async () => {
    const f = fixture();
    f.client.start();
    await flush();
    expect(f.requests()).toBe(1);
    expect(f.sockets).toHaveLength(1);
    expect(f.client.sendCommand({ kind: "ready", payload: { ready: true } })).toBe(false);

    const socket = f.sockets[0]!;
    socket.open();
    expect(JSON.parse(socket.sent[0]!)).toMatchObject({
      type: "authenticate",
      version: 1,
      ticket: { roomId, userId, seat: "home" },
    });
    expect(f.client.sendCommand({ kind: "ready", payload: { ready: true } })).toBe(false);
    socket.message(frame({ type: "ready", seat: "home", snapshot: state(1) }));
    expect(f.statuses.at(-1)).toBe("connected");
    expect(f.client.sendCommand({ kind: "ready", payload: { ready: true } })).toBe(true);
    expect(JSON.parse(socket.sent[1]!)).toMatchObject({
      type: "command",
      command: { roomId, version: 1, sequence: 1, kind: "ready" },
    });
    expect(f.events).toContain("ready");
    f.client.dispose();
  });

  it("rejects forged seats and does not join a room from a different domain", async () => {
    const f = fixture();
    f.client.start();
    await flush();
    const socket = f.sockets[0]!;
    socket.open();
    socket.message(frame({ type: "ready", seat: "away", snapshot: state(1) }));
    expect(socket.closeCode).toBe(1008);
    expect(f.client.statusSnapshot()).toBe("unavailable");
    expect(f.client.sendCommand({ kind: "ready", payload: { ready: true } })).toBe(false);
    f.client.dispose();
  });

  it("preserves official revisions and command sequence after reconnect", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.client.start();
    await flush();
    const first = f.sockets[0]!;
    first.open();
    first.message(frame({ type: "ready", seat: "home", snapshot: state(10) }));
    expect(f.client.sendCommand({ kind: "ready", payload: { ready: true } })).toBe(true);
    first.close(1006);
    expect(f.client.statusSnapshot()).toBe("retrying");
    f.advance(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(f.requests()).toBe(2);
    const second = f.sockets[1]!;
    second.open();
    second.message(frame({ type: "ready", seat: "home", snapshot: state(10) }));
    expect(f.client.statusSnapshot()).toBe("connected");
    expect(f.client.officialSnapshot()?.revision).toBe(10);
    expect(f.client.sendCommand({ kind: "ready", payload: { ready: true } })).toBe(true);
    expect(JSON.parse(second.sent[1]!).command.sequence).toBe(2);
    f.client.dispose();
  });

  it("fails closed on ticket rejection without unlimited reconnect or exposing it in the URL", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.client.start();
    await flush();
    const socket = f.sockets[0]!;
    socket.open();
    socket.close(1008);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.client.statusSnapshot()).toBe("unavailable");
    expect(f.requests()).toBe(1);
    expect(f.sockets).toHaveLength(1);
    f.client.dispose();
  });

  it("disposal fences pending asynchronous ticket issuance", async () => {
    let resolve!: (value: MatchTicketV1) => void;
    const pending = new Promise<MatchTicketV1>((next) => {
      resolve = next;
    });
    let sockets = 0;
    const client = new AuthoritativeMatchSocketClient({
      gatewayUrl: "wss://match.jogomanager.com/rooms",
      pageOrigin: "https://jogomanager.com",
      roomId,
      issueTicket: async () => pending,
      onEvent: () => undefined,
      socketFactory: () => {
        sockets += 1;
        return new FakeSocket();
      },
      now: () => startAt,
    });
    client.start();
    client.dispose();
    resolve(ticket(startAt));
    await flush();
    expect(sockets).toBe(0);
  });
});
