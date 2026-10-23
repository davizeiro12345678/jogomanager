import { expect, it } from "vitest";
import { TextureRevisions } from "./texture-revisions";

it("keeps stadium snapshots stable while athlete and other maps stream", () => {
  const revisions = new TextureRevisions<string>();
  const concrete = ["concreteAlbedo", "concreteNormal", "concreteRough"];
  const seats = ["seatAlbedo", "seatNormal"];
  for (const name of ["hair", "skin", "boots", "grass", "ball"]) revisions.touch(name);
  expect(revisions.snapshot(concrete)).toBe(0);
  expect(revisions.snapshot(seats)).toBe(0);
  revisions.touch("concreteNormal");
  expect(revisions.snapshot(concrete)).toBe(1);
  expect(revisions.snapshot(seats)).toBe(0);
  revisions.touch("seatAlbedo");
  expect(revisions.snapshot(concrete)).toBe(1);
  expect(revisions.snapshot(seats)).toBe(1);
});

it("invalidates every scoped consumer on decoder fallback/reset, including an empty scope", () => {
  const revisions = new TextureRevisions<string>();
  revisions.touch("grass");
  const before = revisions.snapshot(["grass"]);
  revisions.touch();
  expect(revisions.snapshot(["grass"])).toBe(before + 1);
  expect(revisions.snapshot(["seats"])).toBe(1);
  expect(revisions.snapshot([])).toBe(1);
  expect(revisions.snapshot(["grass"])).toBe(before + 1);
});
