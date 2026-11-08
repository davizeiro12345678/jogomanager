import { describe, expect, it } from "vitest";
import { acceptOffer, rejectOffer, resign, takeJob } from "./career-jobs";
import { initCareer } from "./career";
import type { JobOffer, TransferOffer } from "./types";

const career = () => initCareer("bra", "fla", "Teste");

function transferOffer(state: ReturnType<typeof career>, overrides: Partial<TransferOffer> = {}) {
  const playerId = Object.keys(state.players)[0]!;
  return {
    id: "offer-player",
    playerId,
    clubId: "flu",
    amount: 12,
    wage: 20,
    season: state.season,
    round: state.round,
    expiresRound: state.round + 3,
    ...overrides,
  } satisfies TransferOffer;
}

function jobOffer(state: ReturnType<typeof career>, overrides: Partial<JobOffer> = {}) {
  return {
    id: "job-flu",
    clubId: "flu",
    leagueId: state.leagueId,
    season: state.season,
    round: state.round,
    expiresRound: state.round + 4,
    budget: 20,
    objective: 10,
    ...overrides,
  } satisfies JobOffer;
}

describe("career job transitions", () => {
  it("does not sell a player before the transfer offer window starts", () => {
    const state = career();
    const next = { ...state, offers: [transferOffer(state, { round: state.round + 1 })] };

    expect(acceptOffer(next, "offer-player")).toBe(next);
  });

  it("does not reject a future offer or apply its morale consequence", () => {
    const state = career();
    const playerId = Object.keys(state.players)[0]!;
    const next = {
      ...state,
      players: { ...state.players, [playerId]: { ...state.players[playerId]!, ovr: 80 } },
      offers: [transferOffer(state, { round: state.round + 1 })],
    };

    expect(rejectOffer(next, "offer-player")).toBe(next);
  });

  it("dismisses an expired offer without applying the morale consequence", () => {
    const state = career();
    const playerId = Object.keys(state.players)[0]!;
    const next = {
      ...state,
      players: { ...state.players, [playerId]: { ...state.players[playerId]!, ovr: 80 } },
      offers: [transferOffer(state, { expiresRound: state.round - 1 })],
    };

    const dismissed = rejectOffer(next, "offer-player");
    expect(dismissed.players[playerId]!.morale).toBe(next.players[playerId]!.morale);
    expect(dismissed.offers).toEqual([]);
  });

  it("does not take a job before its offer window starts", () => {
    const state = career();
    const next = { ...state, jobOffers: [jobOffer(state, { round: state.round + 1 })] };

    expect(takeJob(next, "job-flu")).toBe(next);
  });

  it("cleans the former club references when resigning and ignores invalid job offers", () => {
    const state = career();
    const next = {
      ...state,
      offers: [transferOffer(state)],
      jobOffers: [
        jobOffer(state, { id: "expired", expiresRound: state.round - 1 }),
        jobOffer(state, { id: "future", round: state.round + 1 }),
      ],
    };

    const resigned = resign(next);
    expect(resigned.sacked).toBe(true);
    expect(resigned.offers).toEqual([]);
    expect(resigned.jobOffers).toHaveLength(1);
    expect(resigned.jobOffers[0]).toMatchObject({ season: state.season, round: state.round });
    expect(resigned.jobOffers[0]!.expiresRound).toBeGreaterThanOrEqual(state.round);
  });

  it("clears transfer and job references after accepting a valid club change", () => {
    const state = career();
    const next = {
      ...state,
      offers: [transferOffer(state)],
      jobOffers: [jobOffer(state)],
    };

    const hired = takeJob(next, "job-flu");
    expect(hired.clubId).toBe("flu");
    expect(hired.offers).toEqual([]);
    expect(hired.jobOffers).toEqual([]);
    expect(hired.sacked).toBe(false);
    expect(hired.managerHistory.at(-1)).toMatchObject({
      clubId: "flu",
      to: null,
      note: "Contratado",
    });
  });
});
