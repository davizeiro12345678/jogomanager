import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuthoritativeMatchSocketClient,
  type AuthorityClientSocket,
} from "./authoritative-socket-client";
import { AuthoritativeSocketAdmission } from "./authoritative-socket-admission.server";
import { AuthoritativeMatchSession } from "./authoritative-match-session";
import { createSecureMatchSocketBridge } from "./secure-socket-bridge.server";
import { signMatchTicketV1 } from "./ticket-signing";
import type { MatchSeat, MatchTicketV1 } from "./match-protocol";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const people = {
  home: "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9",
  away: "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef",
};
const signingKey = "integration-local-hmac-secret-with-no-production-key-2026";
const startedAt = 1_700_000_000_000;

class LoopbackSocket implements AuthorityClientSocket {
  readyState = 0;
  bufferedAmount = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly toServer: {
    readyState: number;
    bufferedAmount: number;
    send: (payload: string) => void;
    close: (code: number, reason: string) => void;
  };
  readonly admission: AuthoritativeSocketAdmission;
  closeCode: number | null = null;

  constructor(bridge: ReturnType<typeof createSecureMatchSocketBridge>) {
    this.toServer = {
      readyState: 0,
      bufferedAmount: 0,
      send: (raw: string) => {
        queueMicrotask(() => {
          if (this.readyState === 1) this.onmessage?.({ data: raw } as MessageEvent);
        });
      },
      close: (code: number) => this.close(code),
    };
    this.admission = new AuthoritativeSocketAdmission(bridge, this.toServer);
  }

  open(): void {
    this.readyState = 1;
    this.toServer.readyState = 1;
    queueMicrotask(() => this.onopen?.(new Event("open")));
  }

  send(raw: string): void {
    if (this.readyState !== 1) throw new Error("socket is closed");
    queueMicrotask(() => {
      void this.admission.onMessage(raw);
    });
  }

  close(code = 1000): void {
    if (this.readyState === 3) return;
    this.closeCode = code;
    this.readyState = 3;
    this.toServer.readyState = 3;
    this.admission.detach();
    this.onclose?.({ code } as CloseEvent);
  }
}

async function seatTicket(seat: MatchSeat): Promise<MatchTicketV1> {
  return signMatchTicketV1(
    {
      version: 1,
      roomId,
      userId: people[seat],
      seat,
      issuedAt: startedAt,
      expiresAt: startedAt + 60_000,
      nonce: "isolated-two-clients-" + seat + "-nonce-for-test",
    },
    signingKey,
  );
}

afterEach(() => vi.useRealTimers());

describe("two independent authoritative client transports, without physical devices", () => {
  it("admits separate signed seats and broadcasts the same canonical clock and score", async () => {
    let steps = 0;
    const [homeTicket, awayTicket] = await Promise.all([
      seatTicket("home"),
      seatTicket("away"),
    ]);
    const session = new AuthoritativeMatchSession({
      roomId,
      homeTicket,
      awayTicket,
      simulationVersion: "contact-2",
      idempotencyKey: "ed789e32-880d-4be9-a966-4293f3dd5df1",
      signer: { sign: async () => "integration-only-signed-server-receipt" },
      engine: {
        advanceFixedStep: () => {
          steps += 1;
          return true;
        },
        publicState: () => ({
          minute: steps,
          score: { home: steps >= 2 ? 1 : 0, away: 0 },
          possession: { home: 55, away: 45 },
        }),
        presentationEvents: () => [],
        applyTactics: () => true,
        substitute: () => true,
        finalResult: () => ({ homeGoals: 1, awayGoals: 0, winner: "home" }),
      },
    });
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: signingKey,
      now: () => startedAt + 100,
    });
    const pairs: LoopbackSocket[] = [];
    const makeClient = (seat: MatchSeat) =>
      new AuthoritativeMatchSocketClient({
        gatewayUrl: `wss://match.jogomanager.com/rooms/${roomId}/socket`,
        pageOrigin: "https://jogomanager.com",
        roomId,
        issueTicket: () => seatTicket(seat),
        onEvent: () => undefined,
        onStatus: (status) => {
          if (status === "connected") clients[seat].sendCommand({
            kind: "ready",
            payload: { ready: true },
          });
        },
        socketFactory: () => {
          const socket = new LoopbackSocket(bridge);
          pairs.push(socket);
          return socket;
        },
        now: () => startedAt + 100,
      });
    const clients = {
      home: null as unknown as AuthoritativeMatchSocketClient,
      away: null as unknown as AuthoritativeMatchSocketClient,
    };
    clients.home = makeClient("home");
    clients.away = makeClient("away");
    try {
      clients.home.start();
      clients.away.start();
      await vi.waitFor(() => expect(pairs).toHaveLength(2));
      for (const socket of pairs) socket.open();
      await vi.waitFor(() => {
        expect(clients.home.statusSnapshot()).toBe("connected");
        expect(clients.away.statusSnapshot()).toBe("connected");
        expect(session.phase).toBe("live");
      });
      await bridge.pulse();
      await bridge.pulse();
      await vi.waitFor(() => {
        expect(clients.home.officialSnapshot()?.tick).toBe(2);
        expect(clients.away.officialSnapshot()?.tick).toBe(2);
      });
      expect(clients.home.officialSnapshot()).toEqual(clients.away.officialSnapshot());
      expect(clients.home.officialSnapshot()?.publicState.score.home).toBe(1);
      expect(clients.away.latencySummary().accepted).toBeGreaterThanOrEqual(1);
      expect(clients.home.latencySummary().accepted).toBeGreaterThanOrEqual(1);
    } finally {
      clients.home.dispose();
      clients.away.dispose();
      bridge.close();
    }
  });

  it("rejects tampered second-device ticket before admitting its seat", async () => {
    const [homeTicket, awayTicket] = await Promise.all([
      seatTicket("home"),
      seatTicket("away"),
    ]);
    const session = new AuthoritativeMatchSession({
      roomId,
      homeTicket,
      awayTicket,
      simulationVersion: "contact-2",
      idempotencyKey: "ed789e32-880d-4be9-a966-4293f3dd5df1",
      signer: { sign: async () => "integration-only-server-receipt-signature" },
      engine: {
        advanceFixedStep: () => true,
        publicState: () => ({
          minute: 0,
          score: { home: 0, away: 0 },
          possession: { home: 50, away: 50 },
        }),
        presentationEvents: () => [],
        applyTactics: () => false,
        substitute: () => false,
        finalResult: () => ({ homeGoals: 0, awayGoals: 0, winner: "draw" }),
      },
    });
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: signingKey,
      now: () => startedAt + 100,
    });
    let pair: LoopbackSocket | null = null;
    const client = new AuthoritativeMatchSocketClient({
      gatewayUrl: `wss://match.jogomanager.com/rooms/${roomId}/socket`,
      pageOrigin: "https://jogomanager.com",
      roomId,
      issueTicket: async () => ({ ...awayTicket, userId: people.home }),
      onEvent: () => undefined,
      socketFactory: () => {
        pair = new LoopbackSocket(bridge);
        return pair;
      },
      now: () => startedAt + 100,
    });
    try {
      client.start();
      await vi.waitFor(() => expect(pair).not.toBeNull());
      (pair as LoopbackSocket | null)?.open();
      await vi.waitFor(() => expect(client.statusSnapshot()).toBe("unavailable"));
      expect(session.phase).toBe("waiting");
      expect(session.snapshot().tick).toBe(0);
    } finally {
      client.dispose();
      bridge.close();
    }
  });
});
