import { describe, expect, it, vi } from "vitest";

import {
  careerLocalWriteRevision,
  careerLocalWriteSnapshot,
  hasCareerLocalWrites,
  retainCareerSave,
  subscribeCareerLocalWrites,
  waitForCareerLocalWrites,
} from "./career-save-lifecycle";

function acceptedSave(owner: string | null = "account-a") {
  let epoch = 4;
  let observe!: (owner: string | null) => void;
  const unsubscribe = vi.fn();
  const save = retainCareerSave({
    owner,
    epoch,
    readEpoch: () => epoch,
    observeOwner: (next) => {
      observe = next;
      return unsubscribe;
    },
  });
  return {
    save,
    observe: (next: string | null) => observe(next),
    reset: () => {
      epoch += 1;
    },
    unsubscribe,
  };
}

describe("accepted career saves across navigation", () => {
  it("synchronously shares pending state and settled revisions across mounted consumers", () => {
    const revision = careerLocalWriteRevision("account-a", 4);
    const states: string[] = [];
    const unsubscribe = subscribeCareerLocalWrites("account-a", 4, () => {
      states.push(careerLocalWriteSnapshot("account-a", 4));
    });
    const otherOwner = vi.fn();
    const unsubscribeOther = subscribeCareerLocalWrites("account-b", 4, otherOwner);
    const { save } = acceptedSave();
    expect(hasCareerLocalWrites("account-a", 4)).toBe(true);
    expect(careerLocalWriteRevision("account-a", 4)).toBe(revision + 1);
    save.localSettled();
    expect(hasCareerLocalWrites("account-a", 4)).toBe(false);
    expect(careerLocalWriteRevision("account-a", 4)).toBe(revision + 1);
    expect(states).toEqual([`${revision + 1}:1`, `${revision + 1}:0`]);
    expect(otherOwner).not.toHaveBeenCalled();
    unsubscribe();
    unsubscribeOther();
    save.release();
  });
  it("lets an accepted save finish and keeps the next route waiting only for local durability", async () => {
    const { save, observe, unsubscribe } = acceptedSave();
    let hydrated = false;
    const nextRoute = waitForCareerLocalWrites("account-a", 4).then(() => {
      hydrated = true;
    });
    await Promise.resolve();
    expect(hydrated).toBe(false);
    // No route-mounted state is part of this scope. A token refresh retains
    // the same owner while the old page's UI subscription can be gone.
    observe("account-a");
    expect(save.isCurrent()).toBe(true);
    save.localSettled();
    await nextRoute;
    expect(hydrated).toBe(true);
    expect(save.isCurrent()).toBe(true);
    save.release();
    save.release();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(save.isCurrent()).toBe(false);
  });

  it("permanently revokes a save on A-B-A even when its page is already unmounted", () => {
    const { save, observe } = acceptedSave();
    observe("account-b");
    observe("account-a");
    expect(save.isCurrent()).toBe(false);
    save.release();
  });

  it("revokes accepted guest work after sign-in and account work after sign-out", () => {
    const guest = acceptedSave(null);
    guest.observe("account-a");
    expect(guest.save.isCurrent()).toBe(false);
    guest.save.release();
    const account = acceptedSave();
    account.observe(null);
    expect(account.save.isCurrent()).toBe(false);
    account.save.release();
  });

  it("keeps career reset epochs and account compartments separate", async () => {
    const { save, reset } = acceptedSave();
    await expect(waitForCareerLocalWrites("account-b", 4)).resolves.toBeUndefined();
    await expect(waitForCareerLocalWrites("account-a", 5)).resolves.toBeUndefined();
    reset();
    expect(save.isCurrent()).toBe(false);
    save.release();
    await expect(waitForCareerLocalWrites("account-a", 4)).resolves.toBeUndefined();
  });

  it("waits for every accepted local write and unblocks on failure/release", async () => {
    const first = acceptedSave();
    const second = acceptedSave();
    let hydrated = false;
    const nextRoute = waitForCareerLocalWrites("account-a", 4).then(() => {
      hydrated = true;
    });
    first.save.localSettled();
    await Promise.resolve();
    expect(hydrated).toBe(false);
    second.save.release();
    await nextRoute;
    expect(hydrated).toBe(true);
    first.save.release();
  });

  it("does not leave a hydration wait behind if auth observation cannot be established", async () => {
    expect(() =>
      retainCareerSave({
        owner: "account-a",
        epoch: 4,
        readEpoch: () => 4,
        observeOwner: () => {
          throw new Error("auth unavailable");
        },
      }),
    ).toThrow("auth unavailable");
    await expect(waitForCareerLocalWrites("account-a", 4)).resolves.toBeUndefined();
  });
});
