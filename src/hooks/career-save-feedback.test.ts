import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { CareerState } from "@/game/types";
import {
  beginCareerSave,
  careerFeedbackSync,
  failCareerSave,
  hasUnpersistedCareer,
  preserveCareerMemory,
  publishVerifiedRestore,
  retainCareerRestoreSources,
  verifyCareerSave,
  type CareerQueryData,
} from "./career-save-feedback";
const state = (round: number) =>
  ({
    version: 3,
    clubId: "fla",
    leagueId: "bra1",
    managerName: "Recovery",
    season: 1,
    round,
  }) as CareerState;
const key = ["career", "alice"] as const;
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, structuralSharing: preserveCareerMemory } },
  });
const data = (qc: QueryClient) => qc.getQueryData<CareerQueryData>(key)!;
describe("shared career save feedback", () => {
  it("retains unsaved memory B and distinct durable A before restoring C, and keeps B on a failed backup gate", async () => {
    const qc = client();
    qc.setQueryData(key, { career: state(1), sync: "local" });
    const failedSave = beginCareerSave(qc, key, state(2));
    failCareerSave(qc, key, failedSave);
    const memory = data(qc).career;
    const replacement = beginCareerSave(qc, key, state(3), false);
    const recovery: CareerState[] = [];
    await expect(
      retainCareerRestoreSources(memory, state(1), state(3), async () => {
        throw new Error("Backup não confirmado");
      }),
    ).rejects.toThrow("Backup não confirmado");
    expect(data(qc).career?.round).toBe(2);
    expect(careerFeedbackSync(data(qc))).toBe("unsaved");
    await retainCareerRestoreSources(memory, state(1), state(3), async (original) => {
      recovery.push(structuredClone(original));
    });
    expect(recovery.map((copy) => copy.round)).toEqual([2, 1]);
    expect(data(qc).career?.round).toBe(2);
    expect(careerFeedbackSync(data(qc))).toBe("unsaved");
    verifyCareerSave(qc, key, replacement, "local");
    expect(publishVerifiedRestore(qc, key, replacement, "local")).toBe(true);
    expect(data(qc).career?.round).toBe(3);
    expect(recovery.map((copy) => copy.round)).toEqual([2, 1]);
    qc.clear();
  });
  it("keeps unsaved B through a failed restore C and replaces it only after C is verified", () => {
    const qc = client();
    qc.setQueryData(key, { career: state(1), sync: "local" });
    const pending = beginCareerSave(qc, key, state(2));
    failCareerSave(qc, key, pending);
    const failedRestore = beginCareerSave(qc, key, state(3), false);
    failCareerSave(qc, key, failedRestore);
    expect(data(qc).career?.round).toBe(2);
    expect(careerFeedbackSync(data(qc))).toBe("unsaved");
    const successfulRestore = beginCareerSave(qc, key, state(3), false);
    expect(careerFeedbackSync(data(qc))).toBe("unsaved");
    verifyCareerSave(qc, key, successfulRestore, "local");
    expect(careerFeedbackSync(data(qc))).toBe("unsaved");
    expect(publishVerifiedRestore(qc, key, successfulRestore, "local")).toBe(true);
    expect(data(qc).career?.round).toBe(3);
    expect(careerFeedbackSync(data(qc))).toBe("local");
    qc.clear();
  });
  it("rejects a pre-write refetch after the newer state has already been verified", async () => {
    const qc = client();
    qc.setQueryData(key, { career: state(1), sync: "local" });
    let release!: (value: CareerQueryData) => void;
    const fetch = qc.fetchQuery({
      queryKey: key,
      queryFn: () =>
        new Promise<CareerQueryData>((resolve) => {
          release = resolve;
        }),
    });
    const newer = beginCareerSave(qc, key, state(3));
    verifyCareerSave(qc, key, newer, "local");
    release({ career: state(1), sync: "local" });
    await fetch;
    expect(data(qc).career?.round).toBe(3);
    expect(careerFeedbackSync(data(qc))).toBe("local");
    qc.clear();
  });
  it("retains failed B and exposes the same explicit failure to every query reader", async () => {
    const qc = client();
    qc.setQueryData(key, { career: state(1), sync: "synced" });
    const one = new QueryObserver<CareerQueryData>(qc, { queryKey: key, enabled: false });
    const two = new QueryObserver<CareerQueryData>(qc, { queryKey: key, enabled: false });
    const unsubscribeOne = one.subscribe(() => {});
    const unsubscribeTwo = two.subscribe(() => {});
    const ticket = beginCareerSave(qc, key, state(2));
    const mutation = new MutationObserver(qc, {
      mutationFn: async () => {
        throw new Error("quota /private/database/path");
      },
      onError: () => {
        failCareerSave(qc, key, ticket);
      },
    });
    await expect(mutation.mutate()).rejects.toThrow("quota");
    for (const reader of [one, two]) {
      expect(reader.getCurrentResult().data?.career?.round).toBe(2);
      expect(careerFeedbackSync(reader.getCurrentResult().data)).toBe("unsaved");
    }
    expect(JSON.stringify(data(qc))).not.toContain("private/database");
    unsubscribeOne();
    unsubscribeTwo();
    qc.clear();
  });
  it("preserves failed B against an already-running refetch and a newly mounted reader", async () => {
    const qc = client();
    qc.setQueryData(key, { career: state(1), sync: "local" });
    let release!: (value: CareerQueryData) => void;
    const oldFetch = qc.fetchQuery({
      queryKey: key,
      queryFn: () =>
        new Promise<CareerQueryData>((resolve) => {
          release = resolve;
        }),
    });
    const ticket = beginCareerSave(qc, key, state(2));
    failCareerSave(qc, key, ticket);
    release({ career: state(1), sync: "local" });
    await oldFetch;
    expect(data(qc).career?.round).toBe(2);
    const reader = new QueryObserver<CareerQueryData>(qc, {
      queryKey: key,
      enabled: !hasUnpersistedCareer(data(qc)),
      queryFn: async () => ({ career: state(1), sync: "local" }),
    });
    const unsubscribe = reader.subscribe(() => {});
    expect(reader.getCurrentResult().data?.career?.round).toBe(2);
    expect(careerFeedbackSync(reader.getCurrentResult().data)).toBe("unsaved");
    unsubscribe();
    qc.clear();
  });
  it("does not let stale B completion change C failure or C success", () => {
    const qc = client();
    qc.setQueryData(key, { career: state(1), sync: "local" });
    const older = beginCareerSave(qc, key, state(2));
    const latest = beginCareerSave(qc, key, state(3));
    failCareerSave(qc, key, latest);
    verifyCareerSave(qc, key, older, "synced");
    failCareerSave(qc, key, older);
    expect(data(qc).career?.round).toBe(3);
    expect(careerFeedbackSync(data(qc))).toBe("unsaved");
    verifyCareerSave(qc, key, latest, "local");
    failCareerSave(qc, key, older);
    expect(careerFeedbackSync(data(qc))).toBe("local");
    expect(data(qc).career?.round).toBe(3);
    qc.clear();
  });
  it("retains the recovery error during retry until the latest matching state is verified", () => {
    const qc = client();
    qc.setQueryData(key, { career: state(1), sync: "local" });
    const first = beginCareerSave(qc, key, state(2));
    failCareerSave(qc, key, first);
    const retry = beginCareerSave(qc, key, state(2));
    expect(careerFeedbackSync(data(qc))).toBe("unsaved");
    verifyCareerSave(qc, key, first, "local");
    expect(careerFeedbackSync(data(qc))).toBe("unsaved");
    verifyCareerSave(qc, key, retry, "local");
    expect(careerFeedbackSync(data(qc))).toBe("local");
    qc.clear();
  });
  it("keeps foreign-account feedback separate", () => {
    const qc = client();
    const bob = ["career", "bob"] as const;
    qc.setQueryData(key, { career: state(1), sync: "local" });
    qc.setQueryData(bob, { career: state(8), sync: "synced" });
    const ticket = beginCareerSave(qc, key, state(2));
    failCareerSave(qc, key, ticket);
    expect(qc.getQueryData(bob)).toEqual({ career: state(8), sync: "synced" });
    qc.clear();
  });
  it("does not mark verified A unsaved when restoring an unpublished B fails", () => {
    const qc = client();
    qc.setQueryData(key, { career: state(1), sync: "synced" });
    const restore = beginCareerSave(qc, key, state(2), false);
    failCareerSave(qc, key, restore);
    expect(data(qc)).toEqual({ career: state(1), sync: "synced" });
    verifyCareerSave(qc, key, restore, "local");
    expect(publishVerifiedRestore(qc, key, restore, "local")).toBe(true);
    expect(data(qc).career?.round).toBe(2);
    expect(careerFeedbackSync(data(qc))).toBe("local");
    qc.clear();
  });
});
