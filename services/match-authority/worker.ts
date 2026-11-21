import { DurableObject } from "cloudflare:workers";

import { CanonicalAuthoritativeMatchEngine } from "../../src/game/online/canonical-authoritative-engine.server";
import type { CanonicalMatchEngineCheckpointV1 } from "../../src/game/online/canonical-authoritative-engine.server";
import { AuthoritativeMatchSession } from "../../src/game/online/authoritative-match-session";
import type { AuthoritativeSessionCheckpointV1 } from "../../src/game/online/authoritative-match-session";
import { AuthoritativeSocketAdmission } from "../../src/game/online/authoritative-socket-admission.server";
import { createSecureMatchSocketBridge } from "../../src/game/online/secure-socket-bridge.server";
import { createMatchTicketNonce, signMatchTicketV1 } from "../../src/game/online/ticket-signing";
import {
  createMatchReceiptSigner,
  verifySignedMatchReceipt,
} from "../../src/game/online/receipt-signing.server";
import type { MatchReceiptV1, MatchSeat } from "../../src/game/online/match-protocol";
import { allocateQueuePair, loadPrivateLiveRoom, settleAuthorityReceipt } from "./supabase";
import { validateMatchAuthorityActivation } from "./worker-activation";
import { reserveTextFrame, SocketReservations } from "./socket-reservations";
import { CooperativeLobby } from "./cooperative-lobby";
import { CooperativeGame, type CooperativeGameCheckpoint } from "./cooperative-game";
import { canonicalize } from "../../src/game/online/session-hash";
import {
  loadStagingCooperativeFixture,
  loadStagingCooperativeRoster,
  type CooperativeFixture,
} from "./supabase";
import type { AuthorityDatabaseEnv, PrivateMatchDescriptor } from "./supabase";

interface Env extends AuthorityDatabaseEnv {
  MATCH_ROOMS: DurableObjectNamespace<MatchRoomDO>;
  COOPERATIVE_ROOMS?: DurableObjectNamespace<CooperativeRoomDO>;
  MATCH_COOPERATIVE_AUTHORITY_ENABLED?: string;
  MATCH_COOPERATIVE_TICKET_SIGNING_SECRET?: string;
  MATCH_AUTHORITY_ENABLED: string;
  MATCH_QUEUE_CRON_ENABLED: string;
  MATCH_TICKET_SIGNING_SECRET: string;
  MATCH_RECEIPT_SIGNING_SECRET: string;
  ALLOWED_ORIGIN: string;
}

interface PersistentRoom {
  version: 1;
  room: PrivateMatchDescriptor;
  idempotencyKey: string;
  engine: CanonicalMatchEngineCheckpointV1;
  session: AuthoritativeSessionCheckpointV1;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PATH = /^\/rooms\/([a-f0-9-]{36})\/socket$/i;
const COOPERATIVE_PATH = /^\/cooperative\/rooms\/([a-f0-9-]{36})\/socket$/i;
const FRAME_INTERVAL_MS = 1_000;
const FIXED_STEPS_PER_ALARM = 30;
const MAX_PENDING_SOCKETS = 8;

function cooperativeSecret(env: Env): string | null {
  if (
    env.MATCH_AUTHORITY_ENV !== "staging" ||
    env.MATCH_AUTHORITY_ENABLED !== "true" ||
    env.MATCH_COOPERATIVE_AUTHORITY_ENABLED !== "true"
  )
    return null;
  const secret = env.MATCH_COOPERATIVE_TICKET_SIGNING_SECRET?.trim();
  return secret &&
    secret.length >= 32 &&
    secret !== env.MATCH_TICKET_SIGNING_SECRET.trim() &&
    secret !== env.MATCH_RECEIPT_SIGNING_SECRET.trim()
    ? secret
    : null;
}

function cooperativeRoomId(url: URL): string | null {
  const roomId = COOPERATIVE_PATH.exec(url.pathname)?.[1]?.toLowerCase();
  return roomId && UUID.test(roomId) && !url.search && !url.hash ? roomId : null;
}

/**
 * Dedicated staging Worker: never expose this on the production domain before
 * integration tests and rollback drills. The browser sends only a short-lived
 * signed seat ticket in the first WebSocket frame, never the private seed.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.MATCH_AUTHORITY_ENABLED !== "true") return new Response(null, { status: 404 });
    try {
      validateMatchAuthorityActivation(env);
    } catch {
      return new Response("Match unavailable", { status: 503 });
    }
    const url = new URL(request.url);
    const cooperativeId = cooperativeRoomId(url);
    if (cooperativeId) {
      if (!cooperativeSecret(env) || !env.COOPERATIVE_ROOMS)
        return new Response(null, { status: 404 });
      if (
        request.headers.get("origin") !== env.ALLOWED_ORIGIN ||
        request.headers.get("upgrade")?.toLowerCase() !== "websocket"
      )
        return new Response(null, { status: 403 });
      return env.COOPERATIVE_ROOMS.get(env.COOPERATIVE_ROOMS.idFromName(cooperativeId)).fetch(
        request,
      );
    }
    const roomId = PATH.exec(url.pathname)?.[1]?.toLowerCase();
    if (
      !roomId ||
      !UUID.test(roomId) ||
      request.headers.get("upgrade")?.toLowerCase() !== "websocket" ||
      url.search ||
      url.hash
    )
      return new Response("Not found", { status: 404 });
    if (request.headers.get("origin") !== env.ALLOWED_ORIGIN)
      return new Response("Origin rejected", { status: 403 });
    return env.MATCH_ROOMS.get(env.MATCH_ROOMS.idFromName(roomId)).fetch(request);
  },

  /** Opt-in bounded allocation, serialized by the Postgres advisory lock. */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    if (env.MATCH_AUTHORITY_ENABLED !== "true" || env.MATCH_QUEUE_CRON_ENABLED !== "true") return;
    validateMatchAuthorityActivation(env);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = await allocateQueuePair(env);
      if (
        !result ||
        (typeof result === "object" && (result as { status?: string }).status === "host_capacity")
      )
        return;
      if (typeof result !== "object" || (result as { status?: string }).status !== "allocated")
        throw new Error("Match allocation returned an invalid result");
    }
  },
};

type PersistentCooperativeMatch = {
  version: 1;
  fixture: CooperativeFixture;
  idempotencyKey: string;
  engine: CanonicalMatchEngineCheckpointV1;
  game: CooperativeGameCheckpoint;
};

/** Four-seat match owner on a separate staging namespace. */
export class CooperativeRoomDO extends DurableObject<Env> {
  private readonly slots = new SocketReservations(MAX_PENDING_SOCKETS);
  private readonly authenticationQueue = new SocketReservations(MAX_PENDING_SOCKETS);
  private serial = Promise.resolve();
  private lobby: CooperativeLobby | undefined;
  private roomId: string | undefined;
  private match:
    | {
        fixture: CooperativeFixture;
        idempotencyKey: string;
        engine: CanonicalAuthoritativeMatchEngine;
        game: CooperativeGame;
      }
    | undefined;
  private failed = false;

  private serialize(work: () => Promise<void>): Promise<void> {
    const result = this.serial.then(work);
    this.serial = result.catch(() => undefined);
    return result;
  }

  private async restore(fixture: CooperativeFixture, prior?: PersistentCooperativeMatch) {
    const idempotencyKey = prior?.idempotencyKey ?? crypto.randomUUID();
    const engine = new CanonicalAuthoritativeMatchEngine(
      fixture.homeClub,
      fixture.awayClub,
      fixture.seed,
    );
    const game = new CooperativeGame(
      fixture.roster.roomId,
      engine,
      createMatchReceiptSigner(this.env.MATCH_RECEIPT_SIGNING_SECRET),
      idempotencyKey,
    );
    try {
      if (prior) {
        if (
          prior.version !== 1 ||
          prior.engine.tick !== prior.game.tick ||
          canonicalize(prior.fixture) !== canonicalize(fixture) ||
          (prior.game.receipt &&
            !(await verifySignedMatchReceipt(
              prior.game.receipt,
              this.env.MATCH_RECEIPT_SIGNING_SECRET,
            )))
        )
          throw new Error("cooperative fixture or checkpoint mismatch");
        engine.restoreCheckpoint(prior.engine);
        game.restore(prior.game);
      }
      this.match = { fixture, idempotencyKey, engine, game };
      await this.persist();
    } catch (error) {
      engine.dispose();
      this.match = undefined;
      throw error;
    }
  }

  private async persist() {
    const match = this.match!;
    const engine = match.engine.checkpoint();
    const game = match.game.checkpoint();
    if (engine.tick !== game.tick) throw new Error("cooperative clocks diverged");
    await this.ctx.storage.put<PersistentCooperativeMatch>("cooperative-match", {
      version: 1,
      fixture: match.fixture,
      idempotencyKey: match.idempotencyKey,
      engine,
      game,
    });
  }

  private async bindGame(roomId: string) {
    const fixture = await loadStagingCooperativeFixture(this.env, roomId);
    if (!fixture && !this.match) {
      if (await this.ctx.storage.get("cooperative-match"))
        throw new Error("persisted cooperative fixture unavailable");
      return;
    }
    if (
      !fixture ||
      fixture.roster.roomId !== roomId ||
      (this.match && canonicalize(fixture) !== canonicalize(this.match.fixture))
    )
      throw new Error("cooperative fixture unavailable");
    if (!this.match) {
      const prior = await this.ctx.storage.get<PersistentCooperativeMatch>("cooperative-match");
      await this.restore(fixture, prior);
    }
  }

  private publish() {
    if (this.failed || !this.lobby || !this.match) return;
    this.lobby.broadcast(this.match.game.snapshot(this.lobby.onlineSeats()));
  }

  private async scheduleGame() {
    if (
      this.match?.game.canAdvance(this.lobby?.onlineSeats() ?? []) &&
      (await this.ctx.storage.getAlarm()) === null
    )
      await this.ctx.storage.setAlarm(Date.now() + FRAME_INTERVAL_MS);
  }

  async alarm(): Promise<void> {
    if (this.failed || !cooperativeSecret(this.env)) return;
    await this.serialize(async () => {
      if (!this.match) {
        const prior = await this.ctx.storage.get<PersistentCooperativeMatch>("cooperative-match");
        if (!prior || prior.game.receipt) return;
        const fixture = await loadStagingCooperativeFixture(this.env, prior.fixture.roster.roomId);
        if (!fixture) return;
        this.roomId = fixture.roster.roomId;
        await this.restore(fixture, prior);
      }
      const { game } = this.match!;
      try {
        const online = this.lobby?.onlineSeats() ?? [];
        if (!game.canAdvance(online)) return;
        const receipt = await game.advance(online, FIXED_STEPS_PER_ALARM, Date.now());
        await this.persist();
        this.publish();
        if (receipt) this.lobby?.broadcast({ type: "receipt", version: 2, receipt });
        else await this.ctx.storage.setAlarm(Date.now() + FRAME_INTERVAL_MS);
      } catch (error) {
        this.failed = true;
        throw error;
      }
    });
  }

  fetch(request: Request): Response {
    const roomId = cooperativeRoomId(new URL(request.url));
    try {
      validateMatchAuthorityActivation(this.env);
    } catch {
      return new Response(null, { status: 503 });
    }
    const secret = cooperativeSecret(this.env);
    if (!secret || !roomId || this.failed || (this.roomId && this.roomId !== roomId))
      return new Response(null, { status: 404 });
    if (
      request.headers.get("origin") !== this.env.ALLOWED_ORIGIN ||
      request.headers.get("upgrade")?.toLowerCase() !== "websocket"
    )
      return new Response(null, { status: 403 });
    const release = this.slots.tryReserve();
    if (!release) return new Response(null, { status: 429 });

    this.roomId = roomId;
    const lobby = (this.lobby ??= new CooperativeLobby({
      roomId,
      secret,
      loadRoster: () => loadStagingCooperativeRoster(this.env, roomId),
      claim: async (seat, issuedAt) => {
        const key = `ticket:${seat}`;
        const previous = await this.ctx.storage.get<number>(key);
        if (previous !== undefined && issuedAt <= previous) return false;
        await this.ctx.storage.put(key, issuedAt);
        return true;
      },
    }));

    let pair: WebSocketPair;
    try {
      pair = new WebSocketPair();
      pair[1].accept();
    } catch {
      release();
      return new Response(null, { status: 503 });
    }
    const { 0: client, 1: server } = pair;
    let detached = false;
    const cleanup = () => {
      if (detached) return;
      detached = true;
      clearTimeout(timeout);
      release();
      lobby.detach(server);
      void this.serialize(async () => this.publish());
    };
    const reject = (code: number, reason: string) => {
      try {
        server.close(code, reason);
      } finally {
        cleanup();
      }
    };
    let timeout = setTimeout(() => reject(1008, "auth_timeout"), 5_000);
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);
    let authenticating = false;
    let windowStart = 0;
    let frames = 0;
    server.addEventListener("message", ({ data }) => {
      if (detached) return;
      const now = Date.now();
      if (now - windowStart >= 1000) {
        windowStart = now;
        frames = 0;
      }
      const releaseFrame = ++frames <= 24 && reserveTextFrame(this.authenticationQueue, data);
      if (!releaseFrame) {
        reject(1008, "unexpected_frame");
        return;
      }
      void this.serialize(async () => {
        try {
          if (detached || server.readyState !== 1) return;
          if (this.failed) return reject(1011, "match_unavailable");
          const seat = lobby.seatFor(server);
          if (!seat && !authenticating) {
            authenticating = true;
            const expiresAt = await lobby.attach(server, data);
            clearTimeout(timeout);
            if (expiresAt === null) return reject(1008, "ticket_rejected");
            await this.bindGame(roomId);
            const admittedSeat = lobby.seatFor(server);
            if (!admittedSeat || detached || Date.now() >= expiresAt)
              return reject(4001, "ticket_expired");
            timeout = setTimeout(
              () => reject(4001, "ticket_expired"),
              Math.max(0, expiresAt - Date.now()),
            );
            const game = this.match?.game;
            if (game) {
              await this.scheduleGame();
              lobby.send(server, {
                type: "sequence",
                version: 2,
                sequence: game.lastSequence(admittedSeat),
              });
              const receipt = game.checkpoint().receipt;
              if (receipt) lobby.send(server, { type: "receipt", version: 2, receipt });
              this.publish();
            }
            return;
          }
          const game = this.match?.game;
          if (!seat || !game) return reject(1008, "unexpected_frame");
          const result = await game.receive(seat, data);
          if (!result) return reject(1008, "invalid_command");
          if (result.accepted) {
            try {
              await this.persist();
              await this.scheduleGame();
            } catch (error) {
              this.failed = true;
              throw error;
            }
          }
          lobby.send(server, { type: "command_result", version: 2, ...result });
          this.publish();
        } catch {
          reject(1011, "lobby_unavailable");
        } finally {
          releaseFrame();
        }
      });
    });
    return new Response(null, { status: 101, webSocket: client });
  }
}

export class MatchRoomDO extends DurableObject<Env> {
  private room: PrivateMatchDescriptor | null = null;
  private engine: CanonicalAuthoritativeMatchEngine | null = null;
  private session: AuthoritativeMatchSession | null = null;
  private bridge: ReturnType<typeof createSecureMatchSocketBridge> | null = null;
  private loading: Promise<void> | null = null;
  private serial: Promise<void> = Promise.resolve();
  private failed = false;
  private idempotencyKey: string | null = null;
  private readonly socketReservations = new SocketReservations(MAX_PENDING_SOCKETS);
  private readonly queuedRoomFrames = new SocketReservations(MAX_PENDING_SOCKETS * 16);

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.serial.then(work, work);
    this.serial = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  private async ensureLoaded(roomId: string | null): Promise<void> {
    if (this.failed) throw new Error("match owner is unavailable");
    if (this.session) {
      if (roomId && this.room?.roomId !== roomId) throw new Error("match object identity mismatch");
      if (roomId) {
        const live = await loadPrivateLiveRoom(this.env, roomId);
        if (
          !live ||
          live.homeId !== this.room.homeId ||
          live.awayId !== this.room.awayId ||
          live.seed !== this.room.seed ||
          live.revision !== this.room.revision
        )
          throw new Error("match room is no longer live");
      }
      return;
    }
    if (!this.loading) this.loading = this.load(roomId);
    try {
      await this.loading;
    } catch {
      this.failed = true;
      throw new Error("match object initialization failed");
    }
  }

  private async load(roomId: string | null): Promise<void> {
    validateMatchAuthorityActivation(this.env);
    const prior = await this.ctx.storage.get<PersistentRoom>("match");
    if (prior && (prior.version !== 1 || (roomId && prior.room.roomId !== roomId)))
      throw new Error("incompatible durable room checkpoint");
    const descriptor = prior?.room ?? (roomId ? await loadPrivateLiveRoom(this.env, roomId) : null);
    if (!descriptor) throw new Error("not a live server-owned match room");
    if (roomId) {
      // Database membership and room status are revalidated before every
      // upgrade, not merely when a stale Durable Object wakes.
      const live = await loadPrivateLiveRoom(this.env, roomId);
      if (
        !live ||
        live.homeId !== descriptor.homeId ||
        live.awayId !== descriptor.awayId ||
        live.homeClub !== descriptor.homeClub ||
        live.awayClub !== descriptor.awayClub ||
        live.revision !== descriptor.revision ||
        live.seed !== descriptor.seed
      )
        throw new Error("match was revoked or moved");
    }

    const bootstrap = async (seat: MatchSeat, userId: string) =>
      signMatchTicketV1(
        {
          version: 1,
          roomId: descriptor.roomId,
          userId,
          seat,
          issuedAt: 0,
          expiresAt: 1,
          nonce: createMatchTicketNonce(),
        },
        this.env.MATCH_TICKET_SIGNING_SECRET,
      );
    const [homeTicket, awayTicket] = await Promise.all([
      bootstrap("home", descriptor.homeId),
      bootstrap("away", descriptor.awayId),
    ]);
    const engine = new CanonicalAuthoritativeMatchEngine(
      descriptor.homeClub,
      descriptor.awayClub,
      descriptor.seed,
      { contactPhysicsRevision: descriptor.revision },
    );
    const receiptId = prior?.idempotencyKey ?? crypto.randomUUID();
    const session = new AuthoritativeMatchSession({
      roomId: descriptor.roomId,
      homeTicket,
      awayTicket,
      engine,
      signer: createMatchReceiptSigner(this.env.MATCH_RECEIPT_SIGNING_SECRET),
      simulationVersion: descriptor.revision === 2 ? "contact-2" : "contact-1",
      idempotencyKey: receiptId,
    });

    if (prior) {
      if (prior.engine.tick !== prior.session.tick)
        throw new Error("engine and session checkpoint tick mismatch");
      engine.restoreCheckpoint(prior.engine);
      session.restoreCheckpoint(prior.session, Date.now());
    }

    this.room = descriptor;
    this.engine = engine;
    this.session = session;
    this.idempotencyKey = receiptId;
    this.bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: this.env.MATCH_TICKET_SIGNING_SECRET,
      persistAfterCommand: () => this.persist(),
    });
    // On a restart, persist the new reconnect revision before any fresh
    // client receives a snapshot. On initial boot, persist the private seed.
    await this.persist();
    await this.scheduleNext();
  }

  private async persist(): Promise<void> {
    if (this.failed || !this.room || !this.engine || !this.session || !this.idempotencyKey)
      throw new Error("cannot persist incomplete authoritative room");
    try {
      const state: PersistentRoom = {
        version: 1,
        room: this.room,
        idempotencyKey: this.idempotencyKey,
        engine: this.engine.checkpoint(),
        session: this.session.checkpoint(),
      };
      if (state.engine.tick !== state.session.tick)
        throw new Error("canonical match clocks diverged");
      await this.ctx.storage.put("match", state);
    } catch {
      this.failed = true;
      this.bridge?.close();
      throw new Error("match checkpoint persistence failed");
    }
  }

  private async scheduleNext(): Promise<void> {
    if (this.failed) return;
    await this.ctx.storage.setAlarm(Date.now() + FRAME_INTERVAL_MS);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const roomId = PATH.exec(url.pathname)?.[1]?.toLowerCase();
    if (
      !roomId ||
      !UUID.test(roomId) ||
      request.headers.get("upgrade")?.toLowerCase() !== "websocket" ||
      request.headers.get("origin") !== this.env.ALLOWED_ORIGIN
    )
      return new Response("Connection rejected", { status: 403 });
    const release = this.socketReservations.tryReserve();
    if (!release) return new Response("Connection rejected", { status: 403 });
    let handedOff = false;
    let abortUpgrade: (() => void) | undefined;
    try {
      try {
        await this.serialize(() => this.ensureLoaded(roomId));
      } catch {
        return new Response("Match unavailable", { status: 503 });
      }
      if (this.session?.phase === "finalized")
        return new Response("Match finalized", { status: 409 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const pending = { admission: undefined as AuthoritativeSocketAdmission | undefined };
      abortUpgrade = () => {
        pending.admission?.detach();
        try {
          server.close(1011, "upgrade_failed");
        } catch {
          // The runtime may already have closed the socket.
        }
      };
      server.accept();
      const admission = new AuthoritativeSocketAdmission(this.bridge!, server);
      pending.admission = admission;
      let detached = false;
      const queuedFrames = new SocketReservations(16);
      const finish = () => {
        if (detached) return;
        detached = true;
        release();
        admission.detach();
      };
      server.addEventListener("message", (event: MessageEvent) => {
        if (detached) return;
        const releaseFrame = reserveTextFrame(queuedFrames, event.data);
        const releaseRoomFrame = releaseFrame ? this.queuedRoomFrames.tryReserve() : null;
        if (!releaseFrame || !releaseRoomFrame) {
          releaseFrame?.();
          finish();
          server.close(1008, "frame_limit_exceeded");
          return;
        }
        void this.serialize(async () => {
          try {
            if (detached) return;
            await admission.onMessage(event.data);
            await this.scheduleNext();
          } catch {
            server.close(1011, "match_processing_failed");
          } finally {
            releaseFrame();
            releaseRoomFrame();
          }
        });
      });
      server.addEventListener("close", () => {
        void this.serialize(async () => {
          finish();
          if (!this.failed) await this.persist();
        });
      });
      server.addEventListener("error", () => {
        void this.serialize(async () => {
          finish();
          if (!this.failed) await this.persist();
        });
      });
      const response = new Response(null, { status: 101, webSocket: client });
      handedOff = true;
      return response;
    } finally {
      if (!handedOff) {
        abortUpgrade?.();
        release();
      }
    }
  }

  /** Alarm-driven fixed tick loop. No browser can request a simulation tick. */
  async alarm(): Promise<void> {
    await this.serialize(async () => {
      await this.ensureLoaded(null);
      if (!this.bridge || !this.session || !this.engine) return;
      let receipt: MatchReceiptV1 | null = null;
      if (this.session.phase !== "finalized") {
        for (let index = 0; index < FIXED_STEPS_PER_ALARM; index += 1) {
          receipt = await this.bridge.pulse({ publish: false });
          if (receipt) break;
        }
        await this.persist();
      } else {
        receipt = await this.session.completeIfFinished(Date.now());
        await this.persist();
      }
      if (receipt) {
        try {
          if (!(await verifySignedMatchReceipt(receipt, this.env.MATCH_RECEIPT_SIGNING_SECRET)))
            throw new Error("receipt signing mismatch");
          const data = await settleAuthorityReceipt(this.env, {
            p_room: receipt.roomId,
            p_receipt_id: receipt.idempotencyKey,
            p_hash: receipt.commandHash,
            p_signature: receipt.signature,
            p_simulation_version: receipt.simulationVersion as "contact-1" | "contact-2",
            p_closure_reason: receipt.closureReason,
            p_home_goals: receipt.result.homeGoals,
            p_away_goals: receipt.result.awayGoals,
            p_minute: this.session.snapshot().publicState.minute,
          });
          const status = (data as { status?: string } | null)?.status;
          if (status !== "settled" && status !== "already_settled")
            throw new Error("authoritative settlement not acknowledged");
          this.bridge.broadcastSnapshot();
          this.bridge.broadcastReceipt(receipt);
          return;
        } catch {
          // A signed receipt is already durable; retry the exact same ID,
          // hash and score. Never rebuild or sign a new result on failure.
          await this.ctx.storage.setAlarm(Date.now() + 30_000);
          return;
        }
      }
      this.bridge.broadcastSnapshot();
      await this.scheduleNext();
    });
  }
}
