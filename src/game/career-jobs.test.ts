import { describe, expect, it } from "vitest";
import { initCareer } from "./career";
import {
  acceptOffer,
  isJobOfferEligible,
  isOfferInCurrentWindow,
  isTransferOfferEligible,
  rejectOffer,
  resign,
  takeJob,
} from "./career-jobs";
import type { JobOffer, TransferOffer } from "./types";

const career = () => initCareer("bra", "fla", "Teste");

function transferOffer(state: ReturnType<typeof career>, overrides: Partial<TransferOffer> = {}) {
  const player = Object.values(state.players).find((entry) => entry.clubId === state.clubId)!;
  return {
    id: "offer-player",
    playerId: player.id,
    clubId: "flu",
    amount: 12,
    wage: player.wage,
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
  it("uses one inclusive seasonal window and rejects future or stale rounds", () => {
    const state = career();
    const offer = transferOffer(state);

    expect(isOfferInCurrentWindow(state, offer)).toBe(true);
    expect(isOfferInCurrentWindow({ ...state, round: offer.expiresRound }, offer)).toBe(true);
    expect(isOfferInCurrentWindow({ ...state, round: offer.expiresRound + 1 }, offer)).toBe(false);
    expect(isOfferInCurrentWindow({ ...state, round: state.round - 1 }, offer)).toBe(false);
    expect(isOfferInCurrentWindow({ ...state, season: state.season + 1 }, offer)).toBe(false);
    expect(isOfferInCurrentWindow(state, { ...offer, round: state.round + 1 })).toBe(false);
  });

  it("accepts a transfer at expiry but not before its start or after it expires", () => {
    const state = career();
    const offer = transferOffer(state);
    const atExpiry = { ...state, round: offer.expiresRound, offers: [{ ...offer }] };
    const accepted = acceptOffer(atExpiry, offer.id);

    expect(accepted).not.toBe(atExpiry);
    expect(accepted.players[offer.playerId]).toBeUndefined();

    const future = { ...state, offers: [{ ...offer, round: state.round + 1 }] };
    expect(acceptOffer(future, offer.id)).toBe(future);

    const expired = { ...state, round: offer.expiresRound + 1, offers: [{ ...offer }] };
    expect(acceptOffer(expired, offer.id)).toBe(expired);
  });

  it("requires a current-club player, a real destination, a finite fee, and a full squad", () => {
    const state = career();
    const offer = transferOffer(state);

    expect(isTransferOfferEligible(state, offer)).toBe(true);
    expect(isTransferOfferEligible(state, { ...offer, playerId: "missing" })).toBe(false);
    expect(isTransferOfferEligible(state, { ...offer, clubId: state.clubId })).toBe(false);
    expect(isTransferOfferEligible(state, { ...offer, amount: Number.NaN })).toBe(false);

    const shortSquad = {
      ...state,
      players: Object.fromEntries(
        Object.values(state.players)
          .slice(0, 16)
          .map((player) => [player.id, player]),
      ),
    };
    expect(isTransferOfferEligible(shortSquad, offer)).toBe(false);
  });

  it("does not reject a future offer and removes an expired one without morale loss", () => {
    const state = career();
    const playerId = Object.keys(state.players)[0]!;
    const future = {
      ...state,
      players: { ...state.players, [playerId]: { ...state.players[playerId]!, ovr: 80 } },
      offers: [transferOffer(state, { round: state.round + 1 })],
    };
    expect(rejectOffer(future, "offer-player")).toBe(future);

    const expired = {
      ...state,
      players: { ...state.players, [playerId]: { ...state.players[playerId]!, ovr: 80 } },
      offers: [transferOffer(state, { expiresRound: state.round - 1 })],
    };
    const dismissed = rejectOffer(expired, "offer-player");
    expect(dismissed.players[playerId]!.morale).toBe(expired.players[playerId]!.morale);
    expect(dismissed.offers).toEqual([]);
  });

  it("uses the same window and target checks when taking a job", () => {
    const state = career();
    const job = jobOffer(state);
    const available = { ...state, jobOffers: [job] };
    const hired = takeJob(available, job.id);

    expect(isJobOfferEligible(state, job)).toBe(true);
    expect(hired).not.toBe(available);
    expect(hired.clubId).toBe(job.clubId);
    expect(hired.jobOffers).toEqual([]);

    const atExpiry = { ...state, round: job.expiresRound, jobOffers: [job] };
    expect(takeJob(atExpiry, job.id).clubId).toBe(job.clubId);

    const future = { ...state, jobOffers: [{ ...job, round: state.round + 1 }] };
    expect(takeJob(future, job.id)).toBe(future);

    const expired = { ...state, round: job.expiresRound + 1, jobOffers: [job] };
    expect(takeJob(expired, job.id)).toBe(expired);

    expect(isJobOfferEligible(state, { ...job, clubId: state.clubId })).toBe(false);
    expect(isJobOfferEligible(state, { ...job, budget: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("cleans former-club references when resigning and ignores invalid job offers", () => {
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
