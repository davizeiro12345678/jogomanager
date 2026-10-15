import { describe, expect, it, vi } from "vitest";
import { autoSeason } from "./autoplay";
import { advanceRound, initCareer, migrateCareer } from "./career";
import {
  developedPlayer,
  profileFor,
  setAttrDeltas,
  withDevelopmentBase,
  type AttrDelta,
} from "./attributes";
import {
  effectivePlayer,
  limitedDevelopmentDelta,
  trainingAgeFactor,
  withDevelopmentSeasonStart,
} from "./player-development";
import { matchAttributes } from "./match-readiness";
import { runDrill } from "./training-drills";
import type { Player } from "./types";
import { remapPlayerReferences } from "./player-roster-repair";

function fixture(age = 20, potential?: number) {
  const career = initCareer("bra", "fla", "Skills");
  const generated = {
    ...Object.values(career.players)[0]!,
    id: "skill-fixture",
    pos: "FW" as const,
    age,
    ovr: 70,
    pace: 70,
    shooting: 70,
    passing: 70,
    defending: 70,
    physical: 70,
    potential,
    developmentBase: undefined,
    developmentDelta: undefined,
    detailedAttributes: undefined,
  };
  const p = withDevelopmentBase(generated, 2);
  const state = withDevelopmentSeasonStart({
    ...career,
    developmentSeasonStart: undefined,
    players: { [p.id]: p },
    attrDeltas: {},
  });
  return { state, p };
}
const uniformChange = (p: Player, amount: number): AttrDelta =>
  Object.fromEntries(Object.keys(p.developmentBase!.profile.attrs).map((key) => [key, amount]));

describe("immutable development base and explicit career source", () => {
  it("keeps initial OVR/main skills unchanged and derives all effective skills from detailed deltas", () => {
    const { state, p } = fixture();
    const before = JSON.stringify(p.developmentBase);
    const source = { ...state, attrDeltas: { [p.id]: { finishing: 2, passing: 1 } } };
    const effective = effectivePlayer(p, source);
    expect(effective.shooting).toBeCloseTo(70 + 2 * 0.36, 6);
    expect(effective.passing).toBeCloseTo(70 + 0.28, 6);
    expect(effective.ovr).toBeCloseTo(70 + 0.72 * 0.45 + 0.28 * 0.1, 6);
    expect(JSON.stringify(p.developmentBase)).toBe(before);
    const projected = developedPlayer(p, source);
    expect(effectivePlayer(projected, source).ovr).toBe(effective.ovr);
    expect(effectivePlayer(projected).ovr).toBe(effective.ovr);
    expect(profileFor(projected).attrs.finishing).toBe(profileFor(p, source).attrs.finishing);
    expect(matchAttributes(projected, "fixture", "home")).toEqual(
      matchAttributes(p, "fixture", "home", source),
    );
  });
  it("isolates identical player IDs across open careers and round trips", () => {
    const { state, p } = fixture();
    const a = { ...state, attrDeltas: { [p.id]: { passing: 2.4 } } };
    const b = { ...state, attrDeltas: { [p.id]: { passing: -0.4 } } };
    const beforeA = profileFor(p, a).attrs;
    setAttrDeltas({ [p.id]: { passing: 90 } });
    expect(profileFor(p, b).attrs.passing).toBeCloseTo(
      p.developmentBase!.profile.attrs.passing - 0.4,
    );
    expect(profileFor(p, a).attrs).toEqual(beforeA);
    const restored = migrateCareer(JSON.parse(JSON.stringify(a)));
    expect(profileFor(restored.players[p.id]!, restored).attrs.passing).toBe(beforeA.passing);
    expect(restored.players[p.id]!.developmentBase).toEqual(p.developmentBase);
  });
  it("preserves identity after rename/birthday and generates new profile seeds independent of name", () => {
    const { p } = fixture();
    const renamed = { ...p, name: "New name", age: p.age + 10, clubId: "bot" };
    expect(profileFor(renamed)).toEqual(profileFor(p));
    const raw = { ...p, developmentBase: undefined, detailedAttributes: undefined };
    expect(
      withDevelopmentBase({ ...raw, name: "First" }, 2).developmentBase!.profile.attrs,
    ).toEqual(withDevelopmentBase({ ...raw, name: "Second" }, 2).developmentBase!.profile.attrs);
    const imported = { ...raw, rosterSource: "imported" as const };
    const frozen = withDevelopmentBase(imported, 2);
    expect(frozen.developmentBase!.profile.attrs).toEqual(profileFor(imported).attrs);
    expect(profileFor({ ...frozen, name: "Changed imported" }).attrs).toEqual(
      profileFor(frozen).attrs,
    );
  });
  it("keeps unversioned legacy main ratings and preexisting recorded deltas", () => {
    const { p } = fixture();
    const raw = {
      ...p,
      developmentBase: undefined,
      developmentDelta: undefined,
      detailedAttributes: undefined,
    };
    const frozen = withDevelopmentBase(raw, 1);
    const source = { attrDeltas: { [p.id]: { finishing: 7 } } };
    expect(effectivePlayer(frozen, source).ovr).toBe(raw.ovr);
    expect(effectivePlayer(frozen, source).shooting).toBe(raw.shooting);
    expect(profileFor(frozen, source).attrs.finishing).toBe(
      Math.min(99, Math.round(profileFor(raw).attrs.finishing + 7)),
    );
  });
  it("remaps the annual baseline with repaired IDs and retains a conservative merged allowance", () => {
    const { state, p } = fixture();
    const input = {
      ...state,
      developmentSeasonStart: { season: state.season, ratings: { old: 69, [p.id]: 70 } },
    };
    const remapped = remapPlayerReferences(input, new Map([["old", p.id]]));
    expect(remapped.developmentSeasonStart?.ratings).toEqual({ [p.id]: 69 });
  });
});

describe("future development limits", () => {
  it.each([
    [20, 3],
    [23, 3],
    [24, 1.5],
    [28, 1.5],
    [29, 0.5],
    [35, 0.5],
  ])("limits annual gains at age %i to %f", (age, cap) => {
    const { state, p } = fixture(age, 99);
    const delta = limitedDevelopmentDelta(p, state, uniformChange(p, 20));
    expect(effectivePlayer(p, { attrDeltas: { [p.id]: delta } }).ovr).toBeCloseTo(70 + cap, 5);
    const repeated = limitedDevelopmentDelta(
      p,
      { ...state, attrDeltas: { [p.id]: delta } },
      uniformChange(p, 20),
    );
    expect(effectivePlayer(p, { attrDeltas: { [p.id]: repeated } }).ovr).toBeCloseTo(70 + cap, 5);
  });
  it("caps decline at two points and leaves historical gains above a new potential untouched", () => {
    const { state, p } = fixture(33, 70);
    const historical = uniformChange(p, 8);
    const previous = effectivePlayer(p, { attrDeltas: { [p.id]: historical } }).ovr;
    const retained = limitedDevelopmentDelta(
      p,
      { ...state, attrDeltas: { [p.id]: historical } },
      uniformChange(p, 20),
    );
    expect(effectivePlayer(p, { attrDeltas: { [p.id]: retained } }).ovr).toBeCloseTo(previous, 5);
    expect(retained).toEqual(historical);
    const decline = limitedDevelopmentDelta(p, state, uniformChange(p, -20));
    expect(effectivePlayer(p, { attrDeltas: { [p.id]: decline } }).ovr).toBeCloseTo(68, 5);
  });
  it("uses immutable base+6 when potential is absent across multiple seasons", () => {
    const { p, state: initial } = fixture(20);
    let state = initial;
    for (let season = 1; season <= 4; season++) {
      state = withDevelopmentSeasonStart({ ...state, season });
      const delta = limitedDevelopmentDelta(p, state, uniformChange(p, 20));
      state = { ...state, attrDeltas: { [p.id]: delta } };
    }
    expect(effectivePlayer(p, state).ovr).toBeCloseTo(76, 5);
  });
  it("keeps age response continuous and registers a midseason signing's baseline once", () => {
    for (const age of [18, 21, 26, 31, 35, 38])
      expect(
        Math.abs(trainingAgeFactor(age - 0.0001) - trainingAgeFactor(age + 0.0001)),
      ).toBeLessThan(0.0001);
    const { state, p } = fixture();
    const newPlayer = { ...p, id: "new-signing" };
    const added = withDevelopmentSeasonStart({
      ...state,
      players: { ...state.players, [newPlayer.id]: newPlayer },
    });
    expect(added.developmentSeasonStart?.ratings[newPlayer.id]).toBe(70);
    expect(withDevelopmentSeasonStart(added)).toBe(added);
  });
  it("drills only evolve detailed deltas under v2 and consume one session per round", () => {
    let state = initCareer("bra", "fla", "Drills");
    const baseline = Object.fromEntries(
      Object.values(state.players).map((p) => [p.id, JSON.stringify(p.developmentBase)]),
    );
    for (let round = 1; round <= 25; round++) state = runDrill({ ...state, round }, "posse");
    for (const p of Object.values(state.players)) {
      expect(JSON.stringify(p.developmentBase)).toBe(baseline[p.id]);
      expect(p.ovr).toBe(effectivePlayer(p, state).ovr);
      expect(profileFor(p, state).attrs).toEqual(p.detailedAttributes);
    }
    expect(runDrill(state, "linha")).toBe(state);
  });
});

describe("caller evaluation clock", () => {
  it("uses the provided instant for boost decisions and achievement timestamps", () => {
    const state = { ...initCareer("bra", "fla", "Clock"), boostUntil: "2031-01-01T00:00:00.000Z" };
    const evaluatedAt = Date.parse("2030-01-01T00:00:00.000Z");
    const spy = vi.spyOn(Date, "now");
    try {
      spy.mockReturnValue(Date.parse("2040-01-01"));
      const first = autoSeason(state, 2, evaluatedAt);
      spy.mockReturnValue(Date.parse("2020-01-01"));
      expect(autoSeason(state, 2, evaluatedAt)).toEqual(first);
      const match = state.fixtures.find(
        (f) => f.round === state.round && (f.home === state.clubId || f.away === state.clubId),
      )!;
      const home = match.home === state.clubId;
      const won = advanceRound(
        state,
        { hg: home ? 5 : 0, ag: home ? 0 : 5 },
        [],
        "Liga",
        evaluatedAt,
      );
      expect(won.achievementsUnlockedAt?.["primeira-vitoria"]).toBe("2030-01-01T00:00:00.000Z");
      expect(() => advanceRound(state, { hg: 1, ag: 0 }, [], "Liga", Number.NaN)).toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
