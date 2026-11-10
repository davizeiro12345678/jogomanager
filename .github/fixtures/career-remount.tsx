import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCareer } from "@/hooks/useCareer";
import {
  readCareerEpoch,
  readOutbox,
  loadLocalCareer,
  saveLocalCareer,
  setLocalCareerGeneration,
} from "@/lib/offline/store";
import type { CareerState } from "@/game/types";

type CareerView = ReturnType<typeof useCareer>;
declare global {
  interface Window {
    careerRemountFixture: {
      base: CareerState;
      deferred: Promise<void>;
      release: () => void;
      deferFirstWrite: boolean;
      localWrites: number;
      cloudLoads: number;
      cloudSaves: number;
      report: Record<string, unknown> | null;
    };
  }
}

const fixture = window.careerRemountFixture;
const owner = "career-remount-fixture";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
});
let first: CareerView | null = null;
let second: CareerView | null = null;
let firstUnmounted = false;
export function FirstScreen() {
  first = useCareer();
  useEffect(
    () => () => {
      firstUnmounted = true;
    },
    [],
  );
  return null;
}
export function SecondScreen() {
  second = useCareer();
  return null;
}
const waitUntil = async (read: () => boolean) => {
  const deadline = performance.now() + 10_000;
  while (!read()) {
    if (performance.now() > deadline) throw new Error("Career remount fixture timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run() {
  await setLocalCareerGeneration(3, owner);
  await saveLocalCareer(fixture.base, "fixture", owner, { generation: 3 });
  fixture.localWrites = 0;
  const key = ["career", owner, 0];
  client.setQueryData(key, {
    career: fixture.base,
    generation: 3,
    epoch: readCareerEpoch(owner),
    tombstone: null,
    status: "ready",
    sync: "synced",
  });
  const root = createRoot(document.getElementById("root")!);
  const screen = (component: typeof FirstScreen) =>
    createElement(QueryClientProvider, { client }, createElement(component));
  flushSync(() => root.render(screen(FirstScreen)));
  await waitUntil(() => first !== null && !first.isLoading);
  const stale = fixture.base;
  const finished = {
    ...stale,
    round: 2,
    results: [{ round: 1, home: stale.clubId, away: "flu", hg: 2, ag: 1 }],
  };
  fixture.deferFirstWrite = true;
  flushSync(() => {
    first!.update(finished);
    root.render(screen(SecondScreen));
  });
  await waitUntil(() => firstUnmounted && fixture.localWrites === 1 && second !== null);
  check(
    second!.isLoading,
    "The remounted screen exposed a ready cached career during local persistence",
  );
  check(second!.career === null, "The remounted screen exposed the old cached career");
  check(fixture.cloudLoads === 0, "Fixture did not retain a fresh cache; queryFn unexpectedly ran");
  const staleCallback = second!.update;
  second!.update({ ...stale, ticketPrice: 77 });
  await new Promise((resolve) => setTimeout(resolve, 25));
  check(
    fixture.localWrites === 1,
    "A second hook accepted a mutation from the stale cached career",
  );
  fixture.release();
  await waitUntil(
    () => fixture.cloudSaves === 1 && second?.career?.round === 2 && !second.isLoading,
  );
  const afterFirst = await readOutbox(owner);
  check(
    afterFirst?.state.results.length === 1,
    "Failed cloud upload lost the completed match outbox",
  );
  staleCallback({ ...stale, ticketPrice: 88 });
  await new Promise((resolve) => setTimeout(resolve, 25));
  check(fixture.localWrites === 1, "A stale callback was accepted after the local barrier settled");
  second!.update({ ...second!.career!, ticketPrice: 77 });
  await waitUntil(
    () => fixture.cloudSaves === 2 && second?.career?.ticketPrice === 77 && !second.isLoading,
  );
  const persisted = await loadLocalCareer(owner);
  const queued = await readOutbox(owner);
  check(
    persisted?.round === 2 && persisted.results.length === 1 && persisted.ticketPrice === 77,
    "The accepted follow-up edit erased the completed match",
  );
  check(
    queued?.state.round === 2 &&
      queued.state.results.length === 1 &&
      queued.state.ticketPrice === 77,
    "The follow-up outbox erased the completed match",
  );
  root.unmount();
  client.clear();
  fixture.report = {
    passed: true,
    realReactRoots: 1,
    actualScreenInstances: 2,
    realQueryClient: true,
    freshCacheSkippedQueryFn: fixture.cloudLoads === 0,
    deferredFirstIndexedDbWrite: true,
    failedCloudSaves: fixture.cloudSaves,
    acceptedLocalWrites: fixture.localWrites,
    staleMutationRejectedBeforeDurability: true,
    staleCallbackRejectedAfterDurability: true,
    retainedRound: persisted.round,
    retainedResults: persisted.results.length,
    finalTicketPrice: persisted.ticketPrice,
  };
}

run().catch((error: unknown) => {
  fixture.report = { passed: false, error: error instanceof Error ? error.stack : String(error) };
});
