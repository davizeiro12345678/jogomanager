import { describe, expect, it } from "vitest";
import { Route } from "./modo-carreira";

describe("legacy coach career route", () => {
  it("redirects /modo-carreira to the existing /carreira page", () => {
    let thrown: unknown;
    try {
      Route.options.beforeLoad?.({} as never);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      to: "/carreira",
      replace: true,
    });
  });
});
