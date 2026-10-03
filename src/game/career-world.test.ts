import { describe, expect, it, vi } from "vitest";
import { initCareer, advanceRound, migrateCareer, takeJob } from "./career";
import {
  applyInterviewDecision,
  identityLabels,
  recordPlayerConversation,
  recordWorldMatch,
  recordWorldTransition,
  rememberWorldEvent,
  supporterAttendance,
  supporterClimate,
  withCareerWorld,
  worldFor,
  supporterOccupancy,
  matchdaySupporters,
  recordLegacyInterview,
} from "./career-world";
import { buildCareerInterview, interviewContexts } from "./career-interviews";
import { gateIncome } from "./events";
import { coachWeek, coachWeekAsync } from "./season-mode";
import type { CareerState, ManagerProfile, MatchLogEntry } from "./types";

const career = (name = "Davi", personality: ManagerProfile["personality"] = "motivador") =>
  initCareer("bra", "fla", name, {
    name,
    country: "bra",
    age: 38,
    favClub: "fla",
    look: { skin: 2, hair: 2, hairColor: "#231813", beard: 1, outfit: 1 },
    personality,
    reputation: 4,
    approval: 70,
    attrs: { attack: 80, defense: 45, market: 50, squad: 70, media: 65 },
  });
const key = (state: CareerState) => `interview:${state.clubId}:${state.season}:${state.round}`;
const match = (state: CareerState, gf = 2, ga = 0, opponentId = "flu"): MatchLogEntry => ({
  season: state.season,
  round: state.round,
  comp: "Liga",
  opponentId,
  home: true,
  gf,
  ga,
  players: state.lineup.map((pid) => ({ pid, goals: 0, assists: 0, minutes: 90, rating: 7 })),
});

describe("persistent football world", () => {
  it("scales editor abilities and shares interview limits with the older conference", () => {
    const base = career();
    const editor = {
      ...base,
      manager: { ...base.manager!, attrs: { ...base.manager!.attrs, attack: 8, defense: 4 } },
    };
    const legacy = {
      ...editor,
      manager: { ...editor.manager, attrs: { ...editor.manager.attrs, attack: 80, defense: 40 } },
    };
    delete editor.world;
    delete legacy.world;
    expect(worldFor(editor).identity.attacking).toBe(worldFor(legacy).identity.attacking);
    const press = recordLegacyInterview(base, "provoke", "Declaração provocadora");
    expect(press.pressRound).toBe(base.round);
    expect(press.world!.identity.assertiveness).toBeGreaterThan(base.world!.identity.assertiveness);
    expect(press.world!.memories[0]!.title).toBe("Declaração provocadora");
    expect(
      applyInterviewDecision(press, { type: "routine", response: "protect", eventKey: key(press) }),
    ).toBe(press);
    expect(recordLegacyInterview(press, "protect", "Resposta repetida")).toBe(press);
  });
  it("uses the same bounded crowd occupancy for the match and ticket income", () => {
    const state = career();
    const upset = {
      ...state,
      fanApproval: 24,
      world: {
        ...state.world!,
        fans: { trust: 20, heat: 90, patience: 20, lastReaction: "Protestos após a derrota." },
      },
    };
    const mood = matchdaySupporters(upset, true);
    expect(mood.climate).toBe("protesto");
    expect(mood.side).toBe("home");
    expect(mood.occupancy).toBe(supporterOccupancy(upset));
    expect(mood.occupancy).toBeLessThan(matchdaySupporters(state, true).occupancy);
    expect(gateIncome(upset)).toBeCloseTo(
      Math.round(((upset.capacity * mood.occupancy * upset.ticketPrice) / 1_000_000) * 100) / 100,
    );
    expect(matchdaySupporters(upset, false).side).toBe("away");
    expect(matchdaySupporters(upset, false).occupancy).toBe(0.86);
  });
  it("keeps worker-backed coach weeks identical to the deterministic sequential contract", async () => {
    // Achievement dates represent real time rather than simulation state.
    // Freeze only Date so both executions share the same save timestamp.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    try {
      const state = career();
      expect(await coachWeekAsync(state, "treino-tatico")).toEqual(
        coachWeek(state, "treino-tatico"),
      );
      expect(state.round).toBe(1);
      expect(state.world!.memories).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("creates deterministic but distinct managers and round-trips their memories", () => {
    const first = career(),
      second = career("Treinador", "durao");
    expect(worldFor(first)).toEqual(worldFor(career()));
    expect(identityLabels(first).grupo).toBe("protetor");
    expect(identityLabels(second).grupo).toBe("disciplinador");
    expect(worldFor(first).identity).not.toEqual(worldFor(second).identity);
    const next = recordWorldMatch(first, match(first));
    const loaded = migrateCareer(JSON.parse(JSON.stringify(next)));
    expect(loaded.world).toEqual(next.world);
  });
  it("normalizes damaged social save fields and keeps the local economy finite", () => {
    const state = career();
    state.world = {
      ...state.world!,
      identity: { ...state.world!.identity, reputation: Infinity, protection: -100 },
      fans: { trust: NaN, heat: 900, patience: -20, lastReaction: "x".repeat(2000) },
    };
    const normalized = withCareerWorld(state);
    expect(normalized.world!.identity.reputation).toBeGreaterThan(0);
    expect(normalized.world!.identity.protection).toBe(0);
    expect(normalized.world!.fans.heat).toBe(100);
    expect(normalized.world!.fans.lastReaction.length).toBeLessThanOrEqual(360);
    expect(Number.isFinite(gateIncome(normalized))).toBe(true);
  });
  it("applies each interview once and makes provocation costly after a defeat", () => {
    const state = career();
    const provoke = applyInterviewDecision(state, {
      type: "defeat",
      response: "provoke",
      eventKey: key(state),
    });
    const protect = applyInterviewDecision(state, {
      type: "defeat",
      response: "protect",
      eventKey: key(state),
    });
    expect(provoke.pressure).toBeGreaterThan(state.pressure);
    expect(provoke.fanApproval).toBeLessThan(state.fanApproval);
    expect(protect.world!.relationships[state.lineup[0]!]!.trust).toBeGreaterThan(
      state.world!.relationships[state.lineup[0]!]!.trust,
    );
    expect(
      applyInterviewDecision(provoke, {
        type: "defeat",
        response: "protect",
        eventKey: key(state),
      }),
    ).toBe(provoke);
    expect(
      applyInterviewDecision(state, { type: "routine", response: "protect", eventKey: "expired" }),
    ).toBe(state);
  });
  it("updates match memories in the sequential career engine and avoids duplicate UI events", () => {
    const before = career();
    const next = advanceRound(before, { hg: 2, ag: 0 });
    const result = next.world!.memories.find((memory) => memory.kind === "result")!;
    expect(result.round).toBe(before.round);
    const reconciled = recordWorldTransition(before, next);
    expect(reconciled.world!.memories).toEqual(next.world!.memories);
    expect(reconciled.fanApproval).toBe(next.fanApproval);
  });
  it("makes a derby loss hurt more and public anger reduce attendance and receipts", () => {
    const state = career();
    const derby = recordWorldMatch(state, match(state, 0, 3, "flu"));
    const normal = recordWorldMatch(state, match(state, 0, 3, "pal"));
    expect(derby.pressure).toBeGreaterThan(normal.pressure);
    expect(derby.world!.fans.heat).toBeGreaterThan(normal.world!.fans.heat);
    const protest = {
      ...state,
      fanApproval: 35,
      world: { ...state.world!, fans: { ...state.world!.fans, trust: 25, heat: 90 } },
    };
    expect(supporterClimate(protest)).toBe("protesto");
    expect(supporterAttendance(protest)).toBeLessThan(supporterAttendance(state));
    expect(gateIncome(protest)).toBeLessThan(gateIncome(state));
    expect(gateIncome(state)).toBeLessThanOrEqual(
      (state.capacity * state.ticketPrice) / 1_000_000 + 0.01,
    );
  });
  it("remembers idol departures, renewals, title celebrations and broken promises", () => {
    const state = career(),
      star = Object.values(state.players).sort((a, b) => b.ovr - a.ovr)[0]!;
    const departed = { ...state, players: { ...state.players } };
    delete departed.players[star.id];
    const sold = recordWorldTransition(state, departed);
    expect(sold.world!.fans.heat).toBeGreaterThan(state.world!.fans.heat);
    expect(sold.world!.memories[0]!.weight).toBeGreaterThanOrEqual(80);
    const renewed = recordWorldTransition(state, {
      ...state,
      players: {
        ...state.players,
        [star.id]: { ...star, contractYears: (star.contractYears ?? 0) + 2 },
      },
    });
    expect(renewed.world!.relationships[star.id]!.trust).toBeGreaterThan(
      state.world!.relationships[star.id]!.trust,
    );
    const titled = recordWorldTransition(state, {
      ...state,
      trophies: [{ name: "Copa nacional", season: 1 }],
    });
    expect(titled.world!.identity.reputation).toBeGreaterThan(state.world!.identity.reputation);
    const promised = {
      ...state,
      promises: [{ pid: star.id, starts: 0, target: 3, untilRound: 4 }],
    };
    const broken = recordWorldTransition(promised, {
      ...promised,
      promises: [],
      brokenPromises: [star.id],
    });
    expect(broken.world!.relationships[star.id]!.trust).toBeLessThan(
      state.world!.relationships[star.id]!.trust - 10,
    );
  });
  it("allows one personal conversation per player per round and retains consequential memories", () => {
    const state = career(),
      pid = state.lineup[0]!;
    let next = recordPlayerConversation(state, state, pid, "elogiar", true);
    expect(recordPlayerConversation(next, next, pid, "multar", false)).toBe(next);
    next = rememberWorldEvent(next, {
      id: "historic-title",
      kind: "title",
      title: "Primeira taça",
      detail: "Uma conquista do clube.",
      sentiment: 20,
      weight: 100,
    });
    for (let i = 0; i < 100; i++)
      next = rememberWorldEvent(next, {
        id: `weekly-${i}`,
        kind: "result",
        title: "Uma rodada",
        detail: "O trabalho continua.",
        sentiment: 1,
        weight: 20,
      });
    expect(next.world!.memories.length).toBeLessThanOrEqual(80);
    expect(next.world!.memories.some((memory) => memory.id === "historic-title")).toBe(true);
  });
  it("offers interviews only for real contexts and includes choices with unique save keys", () => {
    const state = career();
    expect(interviewContexts(state).find((item) => item.type === "title")!.available).toBe(false);
    expect(buildCareerInterview(state, "title")).toBeNull();
    const press = buildCareerInterview(state, "routine")!;
    expect(press.lines.at(-1)!.choices).toHaveLength(6);
    expect(
      press.lines
        .at(-1)!
        .choices!.every((choice) => choice.effect?.careerDecision?.eventKey === key(state)),
    ).toBe(true);
    const loss = { ...state, round: 2, matchLog: [match(state, 0, 2)] };
    expect(buildCareerInterview(loss, "defeat")!.lines[1]!.text).toContain("2 a 0");
  });

  it("registra o primeiro jogo depois de assumir um clube contra um adversário já enfrentado", () => {
    const original = career();
    const oldMatch = match(original, 1, 0, "pal");
    const withOffer = {
      ...original,
      matchLog: [oldMatch],
      jobOffers: [
        {
          id: "job-flu",
          clubId: "flu",
          leagueId: original.leagueId,
          season: original.season,
          round: original.round,
          expiresRound: original.round + 10,
          budget: 20,
          objective: 10,
        },
      ],
    };
    const newClub = takeJob(withOffer, "job-flu");
    const newMatch = { ...match(newClub, 2, 1, "pal"), clubId: newClub.clubId };
    const after = {
      ...newClub,
      round: newClub.round + 1,
      matchLog: [newMatch, ...(newClub.matchLog ?? [])],
    };

    const recorded = recordWorldTransition(newClub, after);
    expect(recorded.world!.applied).toContain(
      `match:${newClub.clubId}:${newClub.season}:${newMatch.round}:${newMatch.comp}:${newMatch.opponentId}`,
    );
  });
});
