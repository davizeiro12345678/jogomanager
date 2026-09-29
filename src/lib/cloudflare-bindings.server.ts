import { AsyncLocalStorage } from "node:async_hooks";

const requestBindings = new AsyncLocalStorage<unknown>();

/** Make Worker bindings available to TanStack server handlers for this request only. */
export function withCloudflareBindings<T>(bindings: unknown, run: () => Promise<T>): Promise<T> {
  return requestBindings.run(bindings, run);
}

export function getCloudflareBindings<T>(): T | undefined {
  return requestBindings.getStore() as T | undefined;
}

