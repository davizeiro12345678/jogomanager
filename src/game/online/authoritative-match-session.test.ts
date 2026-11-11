import { describe, expect, it, vi } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type MatchTicketV1,
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";
import { signMatchTicketV1, verifyMatchTicketV1 } from "./ticket-signing";
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;
  finished = false;
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    if (this.finished) return false;
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
    return true;
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
    verifyTicket?: (ticket: MatchTicketV1) => Promise<boolean>;
    now?: () => number;
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
    verifyTicket: options.verifyTicket,
    now: options.now,
import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects an expired ticket whose signed expiration was extended by the caller", () => {
    const { session } = createSession();
    const extended = parseMatchTicketV1({ ...ticket("home"), expiresAt: issuedAt + 240_000 });
    expect(() => session.connect(extended, issuedAt + 120_001)).toThrow(/ticket/i);
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects modified ticket timestamps even when the original nonce and signature are reused", () => {
    const { session } = createSession();
    const home = ticket("home");

    expect(() =>
      session.connect({ ...home, expiresAt: home.expiresAt + 120_000 }, home.expiresAt + 1),
    ).toThrow(/ticket/i);
    expect(() => session.connect({ ...home, issuedAt: home.issuedAt - 1 }, issuedAt)).toThrow(
      /ticket/i,
    );
    expect(() => session.connect(home, home.issuedAt - 1)).toThrow(/ticket/i);
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("does not reconnect a disconnected seat merely by draining an already admitted command", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    await session.receive(home, command(1), issuedAt);
    await session.receive(ticket("away"), command(1), issuedAt);
    expect(session.phase).toBe("live");

    const pending = session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    session.disconnect(home.userId, issuedAt + 2);
    await expect(pending).resolves.toEqual({ accepted: true });

    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.phase).toBe("reconnecting");
    expect(await session.expireReconnects(issuedAt + 60_001)).toBeNull();
    expect(await session.expireReconnects(issuedAt + 60_002)).toMatchObject({
      closureReason: "abandoned",
      result: { winner: "away" },
    });
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("closes as abandoned after the reconnection window and emits a signed receipt", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const receipt = await session.expireReconnects(issuedAt + 60_001);

    expect(receipt).toMatchObject({ closureReason: "abandoned", result: { winner: "away" } });
    expect(session.phase).toBe("finalized");
  });

  it("includes the accepted forfeit command in the signed receipt hash", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const receipt = await session.finalize("forfeit", issuedAt + 2);

    expect(outcome).toEqual({ accepted: true });
    expect(receipt).toMatchObject({ closureReason: "forfeit", commandHash: expectedHash.hash });
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("closes as abandoned after the reconnection window and emits a signed receipt", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const receipt = await session.expireReconnects(issuedAt + 60_001);

    expect(receipt).toMatchObject({ closureReason: "abandoned", result: { winner: "away" } });
    expect(session.phase).toBe("finalized");
  });

  it("includes the accepted forfeit command in the signed receipt hash", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const receipt = await session.finalize("forfeit", issuedAt + 2);

    expect(outcome).toEqual({ accepted: true });
    expect(receipt).toMatchObject({ closureReason: "forfeit", commandHash: expectedHash.hash });
  });

  it("hash-links every concurrent command in session admission order", async () => {
    const { session } = createSession();
    const commands = Array.from({ length: 12 }, (_, index) => command(index + 1, "ack_snapshot"));
    let expectedHash = GENESIS_SESSION_HASH;
    for (const input of commands) {
      expectedHash = (await appendCommandHash(expectedHash, input)).hash;
    }

    const outcomes = await Promise.all(
      commands.map((input, index) =>
        session.receive(ticket(index % 2 ? "away" : "home"), input, issuedAt + index),
      ),
    );
    const receipt = await session.finalize("completed", issuedAt + commands.length);

    expect(outcomes.every((outcome) => outcome.accepted)).toBe(true);
    expect(receipt.commandHash).toBe(expectedHash);
  });

  it("freezes simulation, commands and reconnection while a receipt is being signed", async () => {
    const signature = deferred<string>();
    const { session, engine } = createSession({ signer: { sign: () => signature.promise } });
    await session.receive(ticket("home"), command(1), issuedAt);
    await session.receive(ticket("away"), command(1), issuedAt);
    session.advanceFixedTick();
    const before = session.snapshot();

    const finalization = session.finalize("completed", issuedAt + 1);
    session.advanceFixedTick();
    const late = await session.receive(ticket("home"), command(2, "set_tactics"), issuedAt + 2);
    session.disconnect(homeUserId, issuedAt + 3);
    session.connect(ticket("home"), issuedAt + 4);

    expect(late).toEqual({ accepted: false, reason: "command_rejected" });
    expect(engine.tacticalChanges).toHaveLength(0);
    expect(session.snapshot()).toMatchObject({ tick: before.tick, revision: before.revision });
    expect(session.phase).toBe("finalized");
    signature.resolve("authoritative-server-receipt-signature");
    expect((await finalization).result).toEqual({ homeGoals: 1, awayGoals: 0, winner: "home" });
  });

  it("retries signing the same frozen receipt without reopening the match or changing its result", async () => {
    const signedInputs: Array<Omit<MatchReceiptV1, "signature">> = [];
    let attempt = 0;
    const { session, engine } = createSession({
      signer: {
        sign: async (unsigned) => {
          signedInputs.push(structuredClone(unsigned));
          if (attempt++ === 0) throw new Error("signer unavailable");
          return "authoritative-server-receipt-signature";
        },
      },
    });

    await expect(session.finalize("completed", issuedAt + 1)).rejects.toThrow("signer unavailable");
    const late = await session.receive(ticket("home"), command(1, "set_tactics"), issuedAt + 2);
    session.advanceFixedTick();
    const receipt = await session.finalize("forfeit", issuedAt + 3, "home");

    expect(late).toEqual({ accepted: false, reason: "command_rejected" });
    expect(engine.tacticalChanges).toHaveLength(0);
    expect(session.snapshot().tick).toBe(0);
    expect(signedInputs).toHaveLength(2);
    expect(signedInputs[1]).toEqual(signedInputs[0]);
    expect(receipt).toMatchObject({
      closureReason: "completed",
      issuedAt: issuedAt + 1,
      result: { homeGoals: 1, awayGoals: 0, winner: "home" },
    });
  });

  it("rejects a command overtaken by finalization before its hash commits", async () => {
    const { session, engine } = createSession();
    const input = session.receive(ticket("home"), command(1, "set_tactics"), issuedAt);
    const receipt = session.finalize("completed", issuedAt + 1);

    await expect(input).resolves.toEqual({ accepted: false, reason: "command_rejected" });
    expect(engine.tacticalChanges).toHaveLength(0);
    expect((await receipt).commandHash).toBe(GENESIS_SESSION_HASH);
  });

  it("closes a queued forfeit without deadlocking or applying following commands", async () => {
    const { session, engine } = createSession();
    const forfeit = command(1, "forfeit");
    const expectedHash = (await appendCommandHash(GENESIS_SESSION_HASH, forfeit)).hash;
    const outcomes = await Promise.all([
      session.receive(ticket("home"), forfeit, issuedAt),
      session.receive(ticket("away"), command(1, "set_tactics"), issuedAt + 1),
    ]);

    expect(outcomes).toEqual([{ accepted: true }, { accepted: false, reason: "command_rejected" }]);
    expect(engine.tacticalChanges).toHaveLength(0);
    expect((await session.finalize("completed", issuedAt + 2)).commandHash).toBe(expectedHash);
  });

  it("does not mutate the engine or poison later commands when hashing fails", async () => {
    const { session, engine } = createSession();
    const digest = vi.spyOn(globalThis.crypto.subtle, "digest");
    digest.mockRejectedValueOnce(new Error("digest unavailable"));
    try {
      await expect(
        session.receive(ticket("home"), command(1, "set_tactics"), issuedAt),
      ).rejects.toThrow("digest unavailable");
      expect(engine.tacticalChanges).toHaveLength(0);
      await expect(
        session.receive(ticket("home"), command(1, "set_tactics"), issuedAt + 1),
      ).resolves.toEqual({ accepted: true });
      expect(engine.tacticalChanges).toHaveLength(1);
    } finally {
      digest.mockRestore();
    }
  });

  it("owns the validated payload before queuing it and rejects extra authority fields", async () => {
    const { session, engine } = createSession();
    const input = command(1, "set_tactics");
    const accepted = session.receive(ticket("home"), input, issuedAt);
    if (input.kind === "set_tactics") input.payload.formation = "5-3-2";

    await expect(accepted).resolves.toEqual({ accepted: true });
    expect(engine.tacticalChanges).toEqual([{ seat: "home", formation: "4-3-3" }]);
    const forged = { ...command(2), score: { home: 99, away: 0 } };
    await expect(session.receive(ticket("home"), forged, issuedAt)).rejects.toThrow();
  });

  it("bounds queued commands and the retained invalid-attempt diagnostics", async () => {
    const { session } = createSession();
    const outcomes = await Promise.all(
      Array.from({ length: 65 }, (_, index) =>
        session.receive(ticket("home"), command(index + 1, "ack_snapshot"), issuedAt),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.accepted)).toHaveLength(64);
    expect(outcomes[64]).toEqual({ accepted: false, reason: "rate_limited" });

    await session.finalize("completed", issuedAt + 1);
    for (let index = 0; index < 140; index++) {
      await session.receive(ticket("home"), command(100 + index), issuedAt + 2);
    }
    expect(session.invalidAttempts).toHaveLength(128);
    expect(session.invalidAttempts[127]?.sequence).toBe(239);
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("closes as abandoned after the reconnection window and emits a signed receipt", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const receipt = await session.expireReconnects(issuedAt + 60_001);

    expect(receipt).toMatchObject({ closureReason: "abandoned", result: { winner: "away" } });
    expect(session.phase).toBe("finalized");
  });

  it("includes the accepted forfeit command in the signed receipt hash", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const receipt = await session.finalize("forfeit", issuedAt + 2);

    expect(outcome).toEqual({ accepted: true });
    expect(receipt).toMatchObject({ closureReason: "forfeit", commandHash: expectedHash.hash });
  });

  it("creates a final receipt once even when finalization is retried", async () => {
    const { session, signatureCount } = createSession();

    const first = await session.finalize("completed", issuedAt + 1);
    const repeated = await session.finalize("completed", issuedAt + 2);

    expect(first).toEqual(repeated);
    expect(first.idempotencyKey).toBe("42711d45-34a3-4d6b-81bb-a67db8b7e4f0");
    expect(signatureCount()).toBe(1);
  });

  it("shares one in-flight finalization when concurrent callers request different receipts", async () => {
    const signature = deferred<string>();
    let signatureCount = 0;
    const { session } = createSession({
      signer: {
        sign: async () => {
          signatureCount += 1;
          return signature.promise;
        },
      },
    });

    const firstPromise = session.finalize("completed", issuedAt + 1);
    const secondPromise = session.finalize("forfeit", issuedAt + 2, "home");

    expect(signatureCount).toBe(1);
    signature.resolve("one-authoritative-signature");
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(second).toEqual(first);
    expect(first).toMatchObject({ closureReason: "completed", issuedAt: issuedAt + 1 });
    expect(first.result).toEqual({ homeGoals: 1, awayGoals: 0, winner: "home" });
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("closes as abandoned after the reconnection window and emits a signed receipt", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const receipt = await session.expireReconnects(issuedAt + 60_001);

    expect(receipt).toMatchObject({ closureReason: "abandoned", result: { winner: "away" } });
    expect(session.phase).toBe("finalized");
  });

  it("includes the accepted forfeit command in the signed receipt hash", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const receipt = await session.finalize("forfeit", issuedAt + 2);

    expect(outcome).toEqual({ accepted: true });
    expect(receipt).toMatchObject({ closureReason: "forfeit", commandHash: expectedHash.hash });
  });

  it("creates a final receipt once even when finalization is retried", async () => {
    const { session, signatureCount } = createSession();

    const first = await session.finalize("completed", issuedAt + 1);
    const repeated = await session.finalize("completed", issuedAt + 2);

    expect(first).toEqual(repeated);
    expect(first.idempotencyKey).toBe("42711d45-34a3-4d6b-81bb-a67db8b7e4f0");
    expect(signatureCount()).toBe(1);
  });

  it("shares one in-flight finalization when concurrent callers request different receipts", async () => {
    const signature = deferred<string>();
    let signatureCount = 0;
    const { session } = createSession({
      signer: {
        sign: async () => {
          signatureCount += 1;
          return signature.promise;
        },
      },
    });

    const firstPromise = session.finalize("completed", issuedAt + 1);
    const secondPromise = session.finalize("forfeit", issuedAt + 2, "home");

    expect(signatureCount).toBe(1);
    signature.resolve("one-authoritative-signature");
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(second).toEqual(first);
    expect(first).toMatchObject({ closureReason: "completed", issuedAt: issuedAt + 1 });
    expect(first.result).toEqual({ homeGoals: 1, awayGoals: 0, winner: "home" });
  });

  it("hash-links simultaneous commands in arrival order across both seats", async () => {
    const { session } = createSession();
    const first = command(1, "set_tactics");
    const second = command(1, "ready");
    const expectedFirst = await appendCommandHash(GENESIS_SESSION_HASH, first);
    const expectedLast = await appendCommandHash(expectedFirst.hash, second);

    const outcomes = await Promise.all([
      session.receive(ticket("home"), first, issuedAt + 1),
      session.receive(ticket("away"), second, issuedAt + 2),
    ]);
    const receipt = await session.finalize("completed", issuedAt + 3);

    expect(outcomes).toEqual([{ accepted: true }, { accepted: true }]);
    expect(receipt.commandHash).toBe(expectedLast.hash);
  });

  it("waits for an accepted command digest before signing a final receipt", async () => {
    const { session } = createSession();
    const tactics = command(1, "set_tactics");
    const expected = await appendCommandHash(GENESIS_SESSION_HASH, tactics);

    const accepted = session.receive(ticket("home"), tactics, issuedAt + 1);
    const closing = session.finalize("completed", issuedAt + 2);
    await accepted;

    expect((await closing).commandHash).toBe(expected.hash);
  });

  it("freezes ticks and rejects mutations while the receipt signature is pending", async () => {
    const signature = deferred<string>();
    const { session, engine } = createSession({
      signer: { sign: () => signature.promise },
    });
    await session.receive(ticket("home"), command(1), issuedAt + 1);
    await session.receive(ticket("away"), command(1), issuedAt + 2);
    session.advanceFixedTick();

    const closing = session.finalize("completed", issuedAt + 3);
    session.advanceFixedTick();
    session.disconnect(homeUserId, issuedAt + 4);
    const mutation = await session.receive(ticket("home"), command(2, "set_tactics"), issuedAt + 5);
    signature.resolve("one-authoritative-signature");
    await closing;

    expect(session.snapshot().tick).toBe(1);
    expect(mutation).toEqual({ accepted: false, reason: "command_rejected" });
    expect(engine.tacticalChanges).toHaveLength(0);
    expect(session.phase).toBe("finalized");
  });

  it("bounds rejected-command history during a replay flood", async () => {
    const { session } = createSession();
    await session.receive(ticket("home"), command(1), issuedAt);
    for (let i = 0; i < 1_000; i += 1) {
      await session.receive(ticket("home"), command(1), issuedAt + i);
    }
    expect(session.invalidAttempts.length).toBeLessThanOrEqual(128);
    expect(session.invalidAttempts.at(-1)?.at).toBe(issuedAt + 999);
  });

  it("limits tactical-command bursts even without caller-supplied limits", async () => {
    const { session, engine } = createSession();
    const outcomes = [];
    for (let sequence = 1; sequence <= 13; sequence += 1) {
      outcomes.push(
        await session.receive(ticket("home"), command(sequence, "set_tactics"), issuedAt),
      );
    }
    expect(outcomes.filter((outcome) => outcome.accepted)).toHaveLength(12);
    expect(outcomes.at(-1)).toEqual({ accepted: false, reason: "rate_limited" });
    expect(engine.tacticalChanges).toHaveLength(12);
  });

  it("closes input synchronously when a forfeit is accepted", async () => {
    const { session, engine } = createSession();
    const forfeit = session.receive(ticket("home"), command(1, "forfeit"), issuedAt + 1);
    const mutation = session.receive(ticket("away"), command(1, "set_tactics"), issuedAt + 2);
    expect(await forfeit).toEqual({ accepted: true });
    expect(await mutation).toEqual({ accepted: false, reason: "command_rejected" });
    expect(engine.tacticalChanges).toHaveLength(0);
    expect((await session.finalize("completed", issuedAt + 3)).closureReason).toBe("forfeit");
  });

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("closes as abandoned after the reconnection window and emits a signed receipt", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const receipt = await session.expireReconnects(issuedAt + 60_001);

    expect(receipt).toMatchObject({ closureReason: "abandoned", result: { winner: "away" } });
    expect(session.phase).toBe("finalized");
  });

  it("includes the accepted forfeit command in the signed receipt hash", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const receipt = await session.finalize("forfeit", issuedAt + 2);

    expect(outcome).toEqual({ accepted: true });
    expect(receipt).toMatchObject({ closureReason: "forfeit", commandHash: expectedHash.hash });
  });

  it("creates a final receipt once even when finalization is retried", async () => {
    const { session, signatureCount } = createSession();

    const first = await session.finalize("completed", issuedAt + 1);
    const repeated = await session.finalize("completed", issuedAt + 2);

    expect(first).toEqual(repeated);
    expect(first.idempotencyKey).toBe("42711d45-34a3-4d6b-81bb-a67db8b7e4f0");
    expect(signatureCount()).toBe(1);
  });

  it("shares one in-flight finalization when concurrent callers request different receipts", async () => {
    const signature = deferred<string>();
    let signatureCount = 0;
    const { session } = createSession({
      signer: {
        sign: async () => {
          signatureCount += 1;
          return signature.promise;
        },
      },
    });

    const firstPromise = session.finalize("completed", issuedAt + 1);
    const secondPromise = session.finalize("forfeit", issuedAt + 2, "home");

    expect(signatureCount).toBe(1);
    signature.resolve("one-authoritative-signature");
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(second).toEqual(first);
    expect(first).toMatchObject({ closureReason: "completed", issuedAt: issuedAt + 1 });
    expect(first.result).toEqual({ homeGoals: 1, awayGoals: 0, winner: "home" });
  });

  it("includes forfeit in the command hash and replays the same receipt", async () => {
    const { session, signatureCount } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const first = await session.finalize("forfeit", issuedAt + 2);
    const replay = await session.finalize("forfeit", issuedAt + 3);

    expect(outcome).toEqual({ accepted: true });
    expect(first.commandHash).toBe(expectedHash.hash);
    expect(replay).toEqual(first);
    expect(signatureCount()).toBe(1);
  });

  it("only publishes sanitized presentation state", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const away = ticket("away");
    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    await session.receive(home, command(1, "ready"), issuedAt + 1);
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    session.advanceFixedTick();

    const snapshot = session.snapshot();

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("closes as abandoned after the reconnection window and emits a signed receipt", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const receipt = await session.expireReconnects(issuedAt + 60_001);

    expect(receipt).toMatchObject({ closureReason: "abandoned", result: { winner: "away" } });
    expect(session.phase).toBe("finalized");
  });

  it("includes the accepted forfeit command in the signed receipt hash", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const receipt = await session.finalize("forfeit", issuedAt + 2);

    expect(outcome).toEqual({ accepted: true });
    expect(receipt).toMatchObject({ closureReason: "forfeit", commandHash: expectedHash.hash });
  });

  it("creates a final receipt once even when finalization is retried", async () => {
    const { session, signatureCount } = createSession();

    const first = await session.finalize("completed", issuedAt + 1);
    const repeated = await session.finalize("completed", issuedAt + 2);

    expect(first).toEqual(repeated);
    expect(first.idempotencyKey).toBe("42711d45-34a3-4d6b-81bb-a67db8b7e4f0");
    expect(signatureCount()).toBe(1);
  });

  it("shares one in-flight finalization when concurrent callers request different receipts", async () => {
    const signature = deferred<string>();
    let signatureCount = 0;
    const { session } = createSession({
      signer: {
        sign: async () => {
          signatureCount += 1;
          return signature.promise;
        },
      },
    });

    const firstPromise = session.finalize("completed", issuedAt + 1);
    const secondPromise = session.finalize("forfeit", issuedAt + 2, "home");

    expect(signatureCount).toBe(1);
    signature.resolve("one-authoritative-signature");
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(second).toEqual(first);
    expect(first).toMatchObject({ closureReason: "completed", issuedAt: issuedAt + 1 });
    expect(first.result).toEqual({ homeGoals: 1, awayGoals: 0, winner: "home" });
  });

  it("includes forfeit in the command hash and replays the same receipt", async () => {
    const { session, signatureCount } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const first = await session.finalize("forfeit", issuedAt + 2);
    const replay = await session.finalize("forfeit", issuedAt + 3);

    expect(outcome).toEqual({ accepted: true });
    expect(first.commandHash).toBe(expectedHash.hash);
    expect(replay).toEqual(first);
    expect(signatureCount()).toBe(1);
  });

  it("only publishes sanitized presentation state", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const away = ticket("away");
    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    await session.receive(home, command(1, "ready"), issuedAt + 1);
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    session.advanceFixedTick();

    const snapshot = session.snapshot();

    expect(snapshot).toMatchObject({ tick: 1, revision: 2, phase: "live" });
    expect(JSON.stringify(snapshot)).not.toMatch(/seed|internal|reward/i);
    expect(snapshot.publicState.score).toEqual({ home: 1, away: 0 });
  });
});

    expect(JSON.stringify(snapshot)).not.toMatch(/seed|internal|reward/i);
    expect(snapshot.publicState.score).toEqual({ home: 1, away: 0 });
  });
});

describe("authoritative ticket renewal", () => {
  const secret = "test-only-match-ticket-signing-secret-at-least-32-bytes";
  let clock = issuedAt;

  async function renewed(seat: MatchSeat, at: number, overrides: Partial<MatchTicketV1> = {}) {
    const { signature: _signature, ...claims } = ticket(seat);
    return signMatchTicketV1(
      {
        ...claims,
        issuedAt: at,
        expiresAt: at + 120_000,
        nonce: `renewed-ticket-${seat}-${at}`,
        ...overrides,
      },
      secret,
    );
  }

  function createRenewableSession(
    verifyTicket = (value: MatchTicketV1) => verifyMatchTicketV1(value, secret),
  ) {
    clock = issuedAt + 1;
    return createSession({ verifyTicket, now: () => clock });
  }

  it("renews an authenticated seat without resetting command sequence or the reconnect deadline", async () => {
    const { session } = createRenewableSession();
    const old = ticket("home");
    await session.receive(old, command(1, "ready"), issuedAt);
    session.disconnect(old.userId, issuedAt + 1);
    const fresh = await renewed("home", issuedAt + 1);

    await session.renewTicket(fresh);
    expect(() => session.connect(old, clock)).toThrow(/ticket/i);
    expect(session.phase).toBe("reconnecting");
    expect(session.connect(fresh, clock)).toBe("home");
    expect(await session.receive(fresh, command(1), clock)).toMatchObject({
      accepted: false,
      reason: "sequence_not_monotonic",
    });
    expect(await session.receive(fresh, command(2), clock)).toEqual({ accepted: true });
  });

  it("fails closed without a verifier and rejects forged or mismatched claims", async () => {
    clock = issuedAt + 1;
    const fresh = await renewed("home", clock);
    await expect(createSession({ now: () => clock }).session.renewTicket(fresh)).rejects.toThrow();
    const { session } = createRenewableSession();
    await expect(
      session.renewTicket({ ...fresh, nonce: "forged-renewal-nonce" }),
    ).rejects.toThrow();
    const wrongUser = await renewed("home", clock, { userId: awayUserId });
    await expect(session.renewTicket(wrongUser)).rejects.toThrow();
    const wrongRoom = await renewed("home", clock, {
      roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5",
    });
    await expect(session.renewTicket(wrongRoom)).rejects.toThrow();
    expect(session.connect(ticket("home"), clock)).toBe("home");
  });

  it("does not let a slower older renewal replace a newer one", async () => {
    const wait = deferred<boolean>();
    const older = await renewed("home", issuedAt + 1);
    const newer = await renewed("home", issuedAt + 2);
    const { session } = createRenewableSession((value) =>
      value.issuedAt === older.issuedAt ? wait.promise : Promise.resolve(true),
    );
    clock = issuedAt + 2;
    const pending = session.renewTicket(older);
    await session.renewTicket(newer);
    wait.resolve(true);
    await expect(pending).rejects.toThrow(/ticket/i);
    expect(session.connect(newer, clock)).toBe("home");
    expect(() => session.connect(older, clock)).toThrow(/ticket/i);
  });

  it("rechecks the clock after verification and cannot renew past the reconnection deadline", async () => {
    const wait = deferred<boolean>();
    const { session } = createRenewableSession(() => wait.promise);
    const old = ticket("home");
    session.connect(old, issuedAt);
    session.disconnect(old.userId, issuedAt + 1);
    const fresh = await renewed("home", issuedAt + 1);
    const pending = session.renewTicket(fresh);
    clock = issuedAt + 60_001;
    wait.resolve(true);
    await expect(pending).rejects.toThrow(/reconnection window expired/i);
    expect((await session.expireReconnects(clock))?.closureReason).toBe("abandoned");
  });

  it("cannot install a ticket after finalization starts", async () => {
    const wait = deferred<boolean>();
    const { session } = createRenewableSession(() => wait.promise);
    const fresh = await renewed("home", clock);
    const pending = session.renewTicket(fresh);
    await session.finalize("completed", clock);
    wait.resolve(true);
    await expect(pending).rejects.toThrow(/ticket/i);
  });

  it("does not retain caller-owned ticket objects across asynchronous verification", async () => {
    const wait = deferred<boolean>();
    const { session } = createRenewableSession(() => wait.promise);
    const fresh = await renewed("home", clock);
    const original = { ...fresh };
    const pending = session.renewTicket(fresh);
    fresh.expiresAt += 999_999;
    wait.resolve(true);
    await pending;
    expect(session.connect(original, clock)).toBe("home");
    expect(() => session.connect(fresh, clock)).toThrow(/ticket/i);
  });
});

describe("match session lifecycle regressions", () => {
  it("keeps a pre-start reconnect at tick zero and rejects reconnection after the first deadline", async () => {
    const { session } = createSession();
    const home = ticket("home");
    await session.receive(home, command(1), issuedAt);
    session.disconnect(home.userId, issuedAt + 1);
    await session.receive(ticket("away"), command(1), issuedAt + 2);
    session.advanceFixedTick();
    expect(session.snapshot()).toMatchObject({ phase: "reconnecting", tick: 0 });
    session.disconnect(home.userId, issuedAt + 30_000);
    expect(() => session.connect(home, issuedAt + 60_001)).toThrow(/reconnection window expired/);
  });

  it("does not advance the published clock when the engine has already finished", async () => {
    const { session, engine } = createSession();
    await session.receive(ticket("home"), command(1), issuedAt);
    await session.receive(ticket("away"), command(1), issuedAt);
    engine.finished = true;
    const before = session.snapshot();
    session.advanceFixedTick();
    expect(session.snapshot()).toEqual(before);
  });

  it("retains the first closure decision after a signing failure", async () => {
    let attempts = 0;
    const { session } = createSession({
      signer: {
        sign: async () => {
          if (++attempts === 1) throw new Error("temporary signer failure");
          return "one-authoritative-signature";
        },
      },
    });
    await expect(session.finalize("forfeit", issuedAt + 1, "home")).rejects.toThrow();
    expect(await session.finalize("completed", issuedAt + 2)).toMatchObject({
      closureReason: "forfeit",
      issuedAt: issuedAt + 1,
      result: { homeGoals: 0, awayGoals: 3, winner: "away" },
    });
  });
});


describe("authoritative match serialization regressions", () => {
  it("rejects modified ticket timestamps even when the original nonce and signature are reused", () => {
    const { session } = createSession();
    const home = ticket("home");
    expect(() => session.connect({ ...home, expiresAt: home.expiresAt + 120_000 }, home.expiresAt + 1)).toThrow(/ticket/i);
    expect(() => session.connect({ ...home, issuedAt: home.issuedAt - 1 }, issuedAt)).toThrow(/ticket/i);
    expect(() => session.connect(home, home.issuedAt - 1)).toThrow(/ticket/i);
  });

  it("does not reconnect a disconnected seat merely by draining an already admitted command", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    await session.receive(home, command(1), issuedAt);
    await session.receive(ticket("away"), command(1), issuedAt);
    expect(session.phase).toBe("live");
    const pending = session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    session.disconnect(homeUserId, issuedAt + 2);
    await expect(pending).resolves.toEqual({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.phase).toBe("reconnecting");
    expect(await session.expireReconnects(issuedAt + 60_001)).toBeNull();
    expect(await session.expireReconnects(issuedAt + 60_002)).toMatchObject({
      closureReason: "abandoned",
      result: { winner: "away" },
    });
  });

  it("hash-links every concurrent command in session admission order", async () => {
    const { session } = createSession();
    const commands = Array.from({ length: 12 }, (_, index) => command(index + 1, "ack_snapshot"));
    let expectedHash = GENESIS_SESSION_HASH;
    for (const input of commands) expectedHash = (await appendCommandHash(expectedHash, input)).hash;
    const outcomes = await Promise.all(
      commands.map((input, index) =>
        session.receive(ticket(index % 2 ? "away" : "home"), input, issuedAt + index),
      ),
    );
    const receipt = await session.finalize("completed", issuedAt + commands.length);
    expect(outcomes.every((outcome) => outcome.accepted)).toBe(true);
    expect(receipt.commandHash).toBe(expectedHash);
  });

  it("freezes simulation, commands and reconnection while a receipt is being signed", async () => {
    const signature = deferred<string>();
    const { session, engine } = createSession({ signer: { sign: () => signature.promise } });
    await session.receive(ticket("home"), command(1), issuedAt);
    await session.receive(ticket("away"), command(1), issuedAt);
    session.advanceFixedTick();
    const before = session.snapshot();
    const finalization = session.finalize("completed", issuedAt + 1);
    session.advanceFixedTick();
    const late = await session.receive(ticket("home"), command(2, "set_tactics"), issuedAt + 2);
    session.disconnect(homeUserId, issuedAt + 3);
    session.connect(ticket("home"), issuedAt + 4);
    expect(late).toEqual({ accepted: false, reason: "command_rejected" });
    expect(engine.tacticalChanges).toHaveLength(0);
    expect(session.snapshot()).toMatchObject({ tick: before.tick, revision: before.revision });
    expect(session.phase).toBe("finalized");
    signature.resolve("authoritative-server-receipt-signature");
    expect((await finalization).result).toEqual({ homeGoals: 1, awayGoals: 0, winner: "home" });
  });

  it("retries signing the same frozen receipt without reopening the match or changing its result", async () => {
    const signedInputs: Array<Omit<MatchReceiptV1, "signature">> = [];
    let attempt = 0;
    const { session, engine } = createSession({
      signer: {
        sign: async (unsigned) => {
          signedInputs.push(structuredClone(unsigned));
          if (attempt++ === 0) throw new Error("signer unavailable");
          return "authoritative-server-receipt-signature";
        },
      },
    });
    await expect(session.finalize("completed", issuedAt + 1)).rejects.toThrow("signer unavailable");
    const late = await session.receive(ticket("home"), command(1, "set_tactics"), issuedAt + 2);
    session.advanceFixedTick();
    const receipt = await session.finalize("forfeit", issuedAt + 3, "home");
    expect(late).toEqual({ accepted: false, reason: "command_rejected" });
    expect(engine.tacticalChanges).toHaveLength(0);
    expect(session.snapshot().tick).toBe(0);
    expect(signedInputs).toHaveLength(2);
    expect(signedInputs[1]).toEqual(signedInputs[0]);
    expect(receipt).toMatchObject({
      closureReason: "completed",
      issuedAt: issuedAt + 1,
      result: { homeGoals: 1, awayGoals: 0, winner: "home" },
    });
  });

  it("rejects a command overtaken by finalization before its hash commits", async () => {
    const { session, engine } = createSession();
    const input = session.receive(ticket("home"), command(1, "set_tactics"), issuedAt);
    const receipt = session.finalize("completed", issuedAt + 1);
    await expect(input).resolves.toEqual({ accepted: false, reason: "command_rejected" });
    expect(engine.tacticalChanges).toHaveLength(0);
    expect((await receipt).commandHash).toBe(GENESIS_SESSION_HASH);
  });

  it("closes a queued forfeit without deadlocking or applying following commands", async () => {
    const { session, engine } = createSession();
    const forfeit = command(1, "forfeit");
    const expectedHash = (await appendCommandHash(GENESIS_SESSION_HASH, forfeit)).hash;
    const outcomes = await Promise.all([
      session.receive(ticket("home"), forfeit, issuedAt),
      session.receive(ticket("away"), command(1, "set_tactics"), issuedAt + 1),
    ]);
    expect(outcomes).toEqual([
      { accepted: true },
      { accepted: false, reason: "command_rejected" },
    ]);
    expect(engine.tacticalChanges).toHaveLength(0);
    expect((await session.finalize("completed", issuedAt + 2)).commandHash).toBe(expectedHash);
  });

  it("does not mutate the engine or poison later commands when hashing fails", async () => {
    const { session, engine } = createSession();
    const digest = vi.spyOn(globalThis.crypto.subtle, "digest");
    digest.mockRejectedValueOnce(new Error("digest unavailable"));
    try {
      await expect(session.receive(ticket("home"), command(1, "set_tactics"), issuedAt))
        .rejects.toThrow("digest unavailable");
      expect(engine.tacticalChanges).toHaveLength(0);
      await expect(session.receive(ticket("home"), command(1, "set_tactics"), issuedAt + 1))
        .resolves.toEqual({ accepted: true });
      expect(engine.tacticalChanges).toHaveLength(1);
    } finally {
      digest.mockRestore();
    }
  });

  it("owns the validated payload before queuing it and rejects extra authority fields", async () => {
    const { session, engine } = createSession();
    const input = command(1, "set_tactics");
    const accepted = session.receive(ticket("home"), input, issuedAt);
    if (input.kind === "set_tactics") input.payload.formation = "5-3-2";
    await expect(accepted).resolves.toEqual({ accepted: true });
    expect(engine.tacticalChanges).toEqual([{ seat: "home", formation: "4-3-3" }]);
    const forged = { ...command(2), score: { home: 99, away: 0 } };
    await expect(session.receive(ticket("home"), forged, issuedAt)).rejects.toThrow();
  });

  it("bounds queued commands and retained invalid-attempt diagnostics", async () => {
    const { session } = createSession();
    const outcomes = await Promise.all(
      Array.from({ length: 65 }, (_, index) =>
        session.receive(ticket("home"), command(index + 1, "ack_snapshot"), issuedAt),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.accepted)).toHaveLength(64);
    expect(outcomes[64]).toEqual({ accepted: false, reason: "rate_limited" });
    await session.finalize("completed", issuedAt + 1);
    for (let index = 0; index < 140; index++)
      await session.receive(ticket("home"), command(100 + index), issuedAt + 2);
    expect(session.invalidAttempts).toHaveLength(128);
    expect(session.invalidAttempts[127]?.sequence).toBe(239);
  });
});

import { describe, expect, it } from "vitest";

import {
  MATCH_PROTOCOL_VERSION,
  parseMatchCommandV1,
  parseMatchTicketV1,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
} from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash } from "./session-hash";
import {
  AuthoritativeMatchSession,
  type AuthoritativeMatchEngine,
  type MatchReceiptSigner,
} from "./authoritative-match-session";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeUserId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayUserId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const issuedAt = 1_700_000_000_000;

function ticket(seat: MatchSeat) {
  return parseMatchTicketV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    userId: seat === "home" ? homeUserId : awayUserId,
    seat,
    issuedAt,
    expiresAt: issuedAt + 120_000,
    nonce: `ticket-nonce-for-${seat}-seat`,
    signature: `server-signature-for-${seat}-seat`,
  });
}

class FakeEngine implements AuthoritativeMatchEngine {
  readonly tacticalChanges: Array<{ seat: MatchSeat; formation: string }> = [];
  readonly substitutions: Array<{ seat: MatchSeat; playerOut: string; playerIn: string }> = [];
  private stepCount = 0;

  advanceFixedStep() {
    this.stepCount += 1;
  }

  publicState(): MatchPublicStateV1 {
    return {
      minute: Math.min(90, this.stepCount),
      score: { home: 1, away: 0 },
      possession: { home: 56, away: 44 },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.stepCount
      ? [{ id: `tick-${this.stepCount}`, type: "chance", tick: this.stepCount, team: "home" }]
      : [];
  }

  applyTactics(seat: MatchSeat, payload: { formation: string }) {
    this.tacticalChanges.push({ seat, formation: payload.formation });
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string) {
    this.substitutions.push({ seat, playerOut, playerIn });
    return true;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    return { homeGoals: 1, awayGoals: 0, winner: "home" as const };
  }
}

function command(
  sequence: number,
  kind: "ready" | "set_tactics" | "substitute" | "forfeit" | "ack_snapshot" = "ready",
) {
  const payloads = {
    ready: { ready: true },
    set_tactics: {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "high",
      width: "wide",
      tempo: "fast",
      lineHeight: "high",
    },
    substitute: { playerOut: "home-7", playerIn: "home-12" },
    forfeit: { confirmed: true },
    ack_snapshot: { revision: 1 },
  };
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind,
    payload: payloads[kind],
  });
}

function createSession(
  options: {
    limits?: Partial<Record<"set_tactics", { limit: number; windowMs: number }>>;
    signer?: MatchReceiptSigner;
  } = {},
) {
  const engine = new FakeEngine();
  let signatures = 0;
  const signer: MatchReceiptSigner = options.signer ?? {
    sign: async () => {
      signatures += 1;
      return "authoritative-server-receipt-signature";
    },
  };
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket: ticket("home"),
    awayTicket: ticket("away"),
    engine,
    signer,
    simulationVersion: "match-sim/1",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    commandLimits: options.limits,
  });
  return { session, engine, signatureCount: () => signatures };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("AuthoritativeMatchSession", () => {
  it("does not advance the server simulation until both authenticated seats explicitly confirm ready", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    const away = ticket("away");

    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    expect(session.phase).toBe("waiting");
    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(0);

    await session.receive(home, command(1, "ready"), issuedAt + 1);
    expect(session.phase).toBe("waiting");
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    expect(session.phase).toBe("live");

    session.advanceFixedTick();
    expect(session.snapshot().tick).toBe(1);
    expect(engine.publicState().minute).toBe(1);
  });

  it("binds each connection to the signed ticket room, user and seat", () => {
    const { session } = createSession();

    expect(session.connect(ticket("home"), issuedAt)).toBe("home");
    expect(() =>
      session.connect(
        parseMatchTicketV1({ ...ticket("away"), roomId: "7008a399-62df-4d47-a314-0c2eb2d4c4c5" }),
        issuedAt,
      ),
    ).toThrow(/room/i);
  });

  it("rejects repeated or stale command sequence without mutating the engine", async () => {
    const { session, engine } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);

    expect((await session.receive(home, command(2, "set_tactics"), issuedAt)).accepted).toBe(true);
    const repeated = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const stale = await session.receive(home, command(1, "set_tactics"), issuedAt + 2);

    expect(repeated).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(stale).toMatchObject({ accepted: false, reason: "sequence_not_monotonic" });
    expect(engine.tacticalChanges).toHaveLength(1);
    expect(session.invalidAttempts).toHaveLength(2);
  });

  it("applies an independent rate window for each command category", async () => {
    const { session, engine } = createSession({
      limits: { set_tactics: { limit: 1, windowMs: 5_000 } },
    });
    const home = ticket("home");
    session.connect(home, issuedAt);

    await session.receive(home, command(1, "set_tactics"), issuedAt);
    const limited = await session.receive(home, command(2, "set_tactics"), issuedAt + 1);
    const acknowledgement = await session.receive(home, command(2, "ack_snapshot"), issuedAt + 2);

    expect(limited).toMatchObject({ accepted: false, reason: "rate_limited" });
    expect(acknowledgement).toMatchObject({ accepted: true });
    expect(engine.tacticalChanges).toHaveLength(1);
  });

  it("keeps the last tactical plan during the 60-second reconnection window", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    await session.receive(home, command(1, "set_tactics"), issuedAt);

    session.disconnect(home.userId, issuedAt + 100);
    expect(session.phase).toBe("reconnecting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
    expect(await session.expireReconnects(issuedAt + 60_099)).toBeNull();

    session.connect(home, issuedAt + 60_099);
    expect(session.phase).toBe("waiting");
    expect(session.lastTacticsFor("home")?.formation).toBe("4-3-3");
  });

  it("closes as abandoned after the reconnection window and emits a signed receipt", async () => {
    const { session } = createSession();
    const home = ticket("home");
    session.connect(home, issuedAt);
    session.disconnect(home.userId, issuedAt + 1);

    const receipt = await session.expireReconnects(issuedAt + 60_001);

    expect(receipt).toMatchObject({ closureReason: "abandoned", result: { winner: "away" } });
    expect(session.phase).toBe("finalized");
  });

  it("includes the accepted forfeit command in the signed receipt hash", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const receipt = await session.finalize("forfeit", issuedAt + 2);

    expect(outcome).toEqual({ accepted: true });
    expect(receipt).toMatchObject({ closureReason: "forfeit", commandHash: expectedHash.hash });
  });

  it("creates a final receipt once even when finalization is retried", async () => {
    const { session, signatureCount } = createSession();

    const first = await session.finalize("completed", issuedAt + 1);
    const repeated = await session.finalize("completed", issuedAt + 2);

    expect(first).toEqual(repeated);
    expect(first.idempotencyKey).toBe("42711d45-34a3-4d6b-81bb-a67db8b7e4f0");
    expect(signatureCount()).toBe(1);
  });

  it("shares one in-flight finalization when concurrent callers request different receipts", async () => {
    const signature = deferred<string>();
    let signatureCount = 0;
    const { session } = createSession({
      signer: {
        sign: async () => {
          signatureCount += 1;
          return signature.promise;
        },
      },
    });

    const firstPromise = session.finalize("completed", issuedAt + 1);
    const secondPromise = session.finalize("forfeit", issuedAt + 2, "home");

    expect(signatureCount).toBe(1);
    signature.resolve("one-authoritative-signature");
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(second).toEqual(first);
    expect(first).toMatchObject({ closureReason: "completed", issuedAt: issuedAt + 1 });
    expect(first.result).toEqual({ homeGoals: 1, awayGoals: 0, winner: "home" });
  });

  it("includes forfeit in the command hash and replays the same receipt", async () => {
    const { session, signatureCount } = createSession();
    const home = ticket("home");
    const forfeit = command(1, "forfeit");
    const expectedHash = await appendCommandHash(GENESIS_SESSION_HASH, forfeit);

    const outcome = await session.receive(home, forfeit, issuedAt + 1);
    const first = await session.finalize("forfeit", issuedAt + 2);
    const replay = await session.finalize("forfeit", issuedAt + 3);

    expect(outcome).toEqual({ accepted: true });
    expect(first.commandHash).toBe(expectedHash.hash);
    expect(replay).toEqual(first);
    expect(signatureCount()).toBe(1);
  });

  it("only publishes sanitized presentation state", async () => {
    const { session } = createSession();
    const home = ticket("home");
    const away = ticket("away");
    session.connect(home, issuedAt);
    session.connect(away, issuedAt);
    await session.receive(home, command(1, "ready"), issuedAt + 1);
    await session.receive(away, command(1, "ready"), issuedAt + 2);
    session.advanceFixedTick();

    const snapshot = session.snapshot();

    expect(snapshot).toMatchObject({ tick: 1, revision: 1, phase: "live" });
    expect(JSON.stringify(snapshot)).not.toMatch(/seed|internal|reward/i);
    expect(snapshot.publicState.score).toEqual({ home: 1, away: 0 });
  });
});
