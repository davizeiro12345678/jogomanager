import { expect, it } from "vitest";

import { shouldRetryNoNavStart } from "../../.github/scripts/trace-mobile-startup-retry.mjs";

it("retries the first Lighthouse NO_NAVSTART runtime error", () => {
  expect(shouldRetryNoNavStart(1, "NO_NAVSTART", 0)).toBe(true);
  expect(shouldRetryNoNavStart(0, "NO_NAVSTART", 0)).toBe(true);
});

it.each([
  [0, "NO_NAVSTART", 1],
  [1, "FAILED_DOCUMENT_REQUEST", 0],
  [1, "NO_NAVSTART", 1],
  [1, undefined, 0],
])(
  "does not retry unrelated or repeated failures (%s, %s, %s)",
  (exitCode, runtimeError, attempt) => {
    expect(shouldRetryNoNavStart(exitCode, runtimeError, attempt)).toBe(false);
  },
);
