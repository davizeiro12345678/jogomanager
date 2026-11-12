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
import type { AuthorityDatabaseEnv, PrivateMatchDescriptor } from "./supabase";

interface Env extends AuthorityDatabaseEnv {
  MATCH_ROOMS: DurableObjectNamespace<MatchRoomDO>;
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
const FRAME_INTERVAL_MS = 1_000;
const FIXED_STEPS_PER_ALARM = 30;
const MAX_PENDING_SOCKETS = 8;

/**
 * Dedicated staging Worker: never expose this on the production domain before
 * integration tests and rollback drills. The browser sends only a short-lived
 * signed seat ticket in the first WebSocket frame, never the private seed.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.MATCH_AUTHORITY_ENABLED !== "true") return new Response(null, { status: 404 });
    const url = new URL(request.url);
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

export class MatchRoomDO extends DurableObject<Env> {
  private room: PrivateMatchDescriptor | null = null;
  private engine: CanonicalAuthoritativeMatchEngine | null = null;
  private session: AuthoritativeMatchSession | null = null;
  private bridge: ReturnType<typeof createSecureMatchSocketBridge> | null = null;
  private loading: Promise<void> | null = null;
  private serial: Promise<void> = Promise.resolve();
  private failed = false;
  private idempotencyKey: string | null = null;
  private pendingSockets = 0;

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
    if (
      this.env.MATCH_AUTHORITY_ENABLED !== "true" ||
      this.env.MATCH_TICKET_SIGNING_SECRET.trim().length < 32 ||
      this.env.MATCH_RECEIPT_SIGNING_SECRET.trim().length < 32
    )
      throw new Error("match owner configuration is incomplete");
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
      request.headers.get("origin") !== this.env.ALLOWED_ORIGIN ||
      this.pendingSockets >= MAX_PENDING_SOCKETS
    )
      return new Response("Connection rejected", { status: 403 });
    try {
      await this.serialize(() => this.ensureLoaded(roomId));
    } catch {
      return new Response("Match unavailable", { status: 503 });
    }
    if (this.session?.phase === "finalized")
      return new Response("Match finalized", { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.pendingSockets += 1;
    server.accept();
    const admission = new AuthoritativeSocketAdmission(this.bridge!, server);
    let detached = false;
    const finish = () => {
      if (detached) return;
      detached = true;
      this.pendingSockets -= 1;
      admission.detach();
    };
    server.addEventListener("message", (event: MessageEvent) => {
      void this.serialize(async () => {
        try {
          await admission.onMessage(event.data);
          // An authenticated client may have sent READY or forfeit.
          await this.scheduleNext();
        } catch {
          server.close(1011, "match_processing_failed");
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
    return new Response(null, { status: 101, webSocket: client });
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
