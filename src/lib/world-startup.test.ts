import { beforeEach, expect, it, vi } from "vitest";

const setup = vi.hoisted(() => ({ custom: vi.fn(), club: vi.fn(), catalog: vi.fn() }));
vi.mock("./customData", () => ({ applyCustomToWorld: setup.custom, revertCustomWorld: vi.fn() }));
vi.mock("./db-catalog", () => ({ loadDbCatalog: setup.catalog }));
vi.mock("./myClub", () => ({
  applyMyClubToWorld: setup.club,
  readMyClub: vi.fn(),
  restoreWorld: vi.fn(),
}));
vi.mock("./world-scope", () => ({
  activeWorldId: () => "a",
  newWorldId: () => "b",
  setActiveWorld: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

it("does not apply custom club mutations twice when quick play is followed by a career route", async () => {
  const { initializeWorld } = await import("./world");
  initializeWorld();
  initializeWorld();
  expect(setup.custom).toHaveBeenCalledTimes(1);
  expect(setup.club).toHaveBeenCalledTimes(1);
});

it("can retry initialization after a failed custom-world application", async () => {
  setup.custom.mockImplementationOnce(() => {
    throw new Error("temporary");
  });
  const { initializeWorld } = await import("./world");
  expect(() => initializeWorld()).toThrow("temporary");
  initializeWorld();
  expect(setup.custom).toHaveBeenCalledTimes(2);
  expect(setup.club).toHaveBeenCalledTimes(1);
});
