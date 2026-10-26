import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { careerQueryEnabled, careerQueryPolicy } from "./career-query-policy";

describe("career recovery query lifecycle", () => {
  it("does not restart a rejected read when a nested reader resolves its account", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ["career", null];
    let reads = 0;
    const options = {
      queryKey: key,
      queryFn: async () => {
        reads++;
        throw new Error("Este save usa uma versão incompatível.");
      },
      ...careerQueryPolicy,
    };
    const screen = new QueryObserver(client, options);
    const stopScreen = screen.subscribe(() => undefined);
    await screen.refetch();
    const shell = new QueryObserver(client, { ...options, enabled: false });
    const stopShell = shell.subscribe(() => undefined);
    shell.setOptions({
      ...options,
      enabled: careerQueryEnabled(true, client.getQueryState(key)?.status),
    });
    await Promise.resolve();
    expect(reads).toBe(1);
    expect(shell.getCurrentResult().isLoading).toBe(false);
    expect(shell.getCurrentResult().isError).toBe(true);
    stopShell();
    stopScreen();
    client.clear();
  });
  it("keeps a rejected save in recovery when nested screens mount another reader", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    let reads = 0;
    const options = {
      queryKey: ["career", null],
      queryFn: async () => {
        reads++;
        throw new Error("Este save usa uma versão incompatível.");
      },
      ...careerQueryPolicy,
    };
    const screen = new QueryObserver(client, options);
    const stopScreen = screen.subscribe(() => undefined);
    await screen.refetch();
    expect(screen.getCurrentResult().isError).toBe(true);
    const recoveryShell = new QueryObserver(client, options);
    const stopShell = recoveryShell.subscribe(() => undefined);
    await Promise.resolve();
    expect(reads).toBe(1);
    expect(recoveryShell.getCurrentResult().isError).toBe(true);
    expect(recoveryShell.getCurrentResult().isLoading).toBe(false);
    stopShell();
    stopScreen();
    client.clear();
  });

  it("allows an explicit refetch after the underlying save is repaired", async () => {
    const client = new QueryClient();
    let repaired = false;
    const observer = new QueryObserver(client, {
      queryKey: ["career", null],
      queryFn: async () => {
        if (!repaired) throw new Error("Versão incompatível");
        return { career: { version: 3 }, sync: "local" };
      },
      ...careerQueryPolicy,
    });
    const stop = observer.subscribe(() => undefined);
    await observer.refetch();
    expect(observer.getCurrentResult().isError).toBe(true);
    repaired = true;
    await observer.refetch();
    expect(observer.getCurrentResult().data).toEqual({ career: { version: 3 }, sync: "local" });
    stop();
    client.clear();
  });
});
