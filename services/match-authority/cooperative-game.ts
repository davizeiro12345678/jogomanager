import { z } from "zod";
import type {
  AuthoritativeMatchEngine,
  MatchReceiptSigner,
} from "../../src/game/online/authoritative-match-session";
import {
  canExecuteCooperativeSeatCommand,
  CooperativeSeatV2Schema,
  cooperativeTeamForSeat,
  type CooperativeSeatV2,
} from "../../src/game/online/cooperative-seat-ticket-v2.server";
import {
  MatchCommandV1Schema,
  parseMatchReceiptV1,
  type MatchReceiptV1,
} from "../../src/game/online/match-protocol";
import { MATCH_SIMULATION_TICK_LIMIT } from "../../src/game/sim-contracts";
import {
  appendCooperativeCommandHash,
  GENESIS_SESSION_HASH,
} from "../../src/game/online/session-hash";

const seats = CooperativeSeatV2Schema.options;
const sequencesSchema = z.partialRecord(CooperativeSeatV2Schema, z.number().int().positive());
const stateSchema = z
  .object({
    ready: z.array(CooperativeSeatV2Schema).max(4),
    sequences: sequencesSchema,
    tick: z.number().int().min(0).max(MATCH_SIMULATION_TICK_LIMIT),
    started: z.boolean(),
    commandHash: z.string().regex(/^[a-f0-9]{64}$/),
    receipt: z.unknown(),
  })
  .strict();
const commandFrame = z
  .object({
    type: z.literal("command"),
    version: z.literal(2),
    command: MatchCommandV1Schema,
  })
  .strict();

export type CooperativeGameCheckpoint = Omit<z.infer<typeof stateSchema>, "receipt"> & {
  receipt: MatchReceiptV1 | null;
};

export class CooperativeGame {
  private state: CooperativeGameCheckpoint = {
    ready: [],
    sequences: {},
    tick: 0,
    started: false,
    commandHash: GENESIS_SESSION_HASH,
    receipt: null,
  };

  constructor(
    private readonly roomId: string,
    private readonly engine: AuthoritativeMatchEngine,
    private readonly signer: MatchReceiptSigner,
    private readonly idempotencyKey: string,
  ) {}

  restore(input: unknown) {
    const state = stateSchema.parse(input);
    const receipt = state.receipt === null ? null : parseMatchReceiptV1(state.receipt);
    if (
      new Set(state.ready).size !== state.ready.length ||
      (state.started && state.ready.length !== seats.length) ||
      (!state.started && (state.tick > 0 || receipt)) ||
      (receipt &&
        (receipt.roomId !== this.roomId ||
          receipt.idempotencyKey !== this.idempotencyKey ||
          receipt.commandHash !== state.commandHash ||
          receipt.simulationVersion !== "contact-2" ||
          receipt.closureReason !== "completed" ||
          !this.engine.isFinished?.()))
    )
      throw new Error("invalid cooperative checkpoint");
    this.state = { ...state, receipt };
  }

  checkpoint(): CooperativeGameCheckpoint {
    return structuredClone(this.state);
  }

  lastSequence(seat: CooperativeSeatV2): number {
    return this.state.sequences[seat] ?? 0;
  }

  canAdvance(online: readonly CooperativeSeatV2[]) {
    return (
      !this.state.receipt &&
      (this.state.started ||
        (online.length === seats.length && this.state.ready.length === seats.length))
    );
  }

  snapshot(online: readonly CooperativeSeatV2[]) {
    return {
      type: "snapshot",
      version: 2,
      roomId: this.roomId,
      tick: this.state.tick,
      phase: this.state.receipt
        ? "finalized"
        : !this.state.started
          ? "waiting"
          : online.length === seats.length
            ? "live"
            : "reconnecting",
      ready: seats.filter((seat) => this.state.ready.includes(seat)),
      publicState: this.engine.publicState(),
      presentationEvents: this.engine.presentationEvents(),
    };
  }

  async receive(seat: CooperativeSeatV2, raw: string) {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return null;
    }
    const frame = commandFrame.safeParse(payload);
    if (!frame.success) return null;
    const { command } = frame.data;
    const rejected = { sequence: command.sequence, accepted: false };
    if (
      this.state.receipt ||
      command.roomId !== this.roomId ||
      command.sequence <= this.lastSequence(seat) ||
      !canExecuteCooperativeSeatCommand(seat, command.kind) ||
      (command.kind === "ack_snapshot" && command.payload.revision > this.state.tick)
    )
      return rejected;

    const hash = await appendCooperativeCommandHash(this.state.commandHash, seat, command);
    const team = cooperativeTeamForSeat(seat);
    if (command.kind === "set_tactics" && !this.engine.applyTactics(team, command.payload))
      return rejected;
    if (
      command.kind === "substitute" &&
      !this.engine.substitute(team, command.payload.playerOut, command.payload.playerIn)
    )
      return rejected;
    if (command.kind === "ready" && !this.state.ready.includes(seat)) this.state.ready.push(seat);
    this.state.commandHash = hash;
    this.state.sequences[seat] = command.sequence;
    return { sequence: command.sequence, accepted: true };
  }

  /** The owner serializes command handling, ticks and persistence. */
  async advance(online: readonly CooperativeSeatV2[], steps: number, now: number) {
    if (this.state.receipt) return this.state.receipt;
    if (!this.canAdvance(online)) return null;
    this.state.started = true;
    for (let step = 0; step < steps && this.engine.advanceFixedStep(); step += 1)
      this.state.tick += 1;
    if (!this.engine.isFinished?.()) return null;
    const unsigned: Omit<MatchReceiptV1, "signature"> = {
      version: 1,
      roomId: this.roomId,
      simulationVersion: "contact-2",
      commandHash: this.state.commandHash,
      result: this.engine.finalResult(),
      closureReason: "completed",
      idempotencyKey: this.idempotencyKey,
      issuedAt: now,
    };
    this.state.receipt = parseMatchReceiptV1({
      ...unsigned,
      signature: await this.signer.sign(unsigned),
    });
    return this.state.receipt;
  }
}
