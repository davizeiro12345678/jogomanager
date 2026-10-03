import { describe, expect, it } from "vitest";
import { initCareer, migrateCareer } from "./career";
import { repairCareer } from "./career-repair";
import { signRealPlayer, toTarget } from "./realMarket";
import { applyImportedSquad } from "./squad-import";
import { buildSquad } from "./squad";
import type { RealPlayer } from "../lib/realSquads";
import { normalizeRealPlayers } from "../lib/real-player-records";

const record = (id = "provider-row-42"): RealPlayer => ({
  id, data_source: "thesportsdb", name: "Atleta de Teste", position: "MF", age: 24,
  shirt_number: 8, nationality: "Brasil", overall: 75, photo_url: null,
});
const career = () => initCareer("bra", "flu", "Integridade");
const target = (id = "provider-row-42") => toTarget({
  id, name: "Atleta de Teste", position: "MF", age: 24, shirt_number: 8,
  nationality: "Brasil", overall: 75, photo_url: null, club_id: "pal",
});

describe("player identity across squads, transfers and old saves", () => {
  it("does not charge or add a second copy of a player already imported in the squad", () => {
    const s = career();
    const imported = applyImportedSquad("flu", buildSquad("flu"), [record()])[0]!;
    const owned = { ...s, players: { ...s.players, [imported.id]: imported } };
    const next = signRealPlayer(owned, target(), { fee: 10, wage: 50 });
    expect(next).toBe(owned);
    expect(next.finances).toEqual(owned.finances);
  });

  it("records provenance on a newly signed player and blocks a second purchase", () => {
    const s = career();
    const signed = signRealPlayer(s, target(), { fee: 1, wage: 50 });
    expect(signed.players["real-provider-row-42"]?.sourcePlayerId).toBe("provider-row-42");
    expect(signRealPlayer(signed, target(), { fee: 1, wage: 50 })).toBe(signed);
  });

  it("repairs a legacy import/transfer copy and remaps the saved player references", () => {
    const s = career();
    const old = s.players[s.lineup[5]!]!;
    const first = { ...old, rosterSource: "imported" as const, sourcePlayerId: "42", apps: 20, goals: 4 };
    const copy = { ...first, id: "real-42", apps: 0, goals: 0, injuryWeeks: 3, suspended: true };
    const broken = { ...s, players: { ...s.players, [first.id]: first, [copy.id]: copy },
      lineup: [...s.lineup.slice(0, 10), copy.id], bench: [...s.bench, copy.id],
      offers: [{ id: "offer", playerId: copy.id, clubId: "pal", amount: 4, wage: 30, season: 1, round: 1, expiresRound: 4 }],
      promises: [{ pid: copy.id, starts: 1, target: 3, untilRound: 4 }],
      attrDeltas: { [copy.id]: { passing: 2 } },
      matchLog: [{ season: 1, round: 1, comp: "Liga", opponentId: "pal", home: true, gf: 1, ga: 0,
        players: [{ pid: copy.id, goals: 1, assists: 0, minutes: 90, rating: 7 }] }],
    };
    const repaired = repairCareer(broken);
    expect(repaired.state.players[copy.id]).toBeUndefined();
    expect(repaired.state.players[first.id]?.apps).toBe(20);
    expect(repaired.state.players[first.id]?.goals).toBe(4);
    expect(repaired.state.players[first.id]?.injuryWeeks).toBe(3);
    expect(repaired.state.players[first.id]?.suspended).toBe(true);
    expect(repaired.state.lineup).not.toContain(copy.id);
    expect(repaired.state.bench).not.toContain(copy.id);
    expect(new Set(repaired.state.lineup).size).toBe(repaired.state.lineup.length);
    expect(repaired.state.offers[0]?.playerId).toBe(first.id);
    expect(repaired.state.promises?.[0]?.pid).toBe(first.id);
    expect(repaired.state.matchLog?.[0]?.players[0]?.pid).toBe(first.id);
    expect(repaired.state.attrDeltas?.[first.id]?.["passing"]).toBe(2);
    expect(repaired.state.finances).toEqual(s.finances);
    expect(repaired.state.fixtures).toEqual(s.fixtures);
    expect(repairCareer(repaired.state).fixes).toEqual([]);
    expect(broken.players[copy.id]).toBe(copy);
  });

  it("preserves different athletes with equal names, ages or positions", () => {
    const squad = applyImportedSquad("flu", buildSquad("flu"), [record("A"), record("B")]);
    expect(squad.filter(p => p.name === "Atleta de Teste")).toHaveLength(2);
    const s = career();
    const custom = Object.fromEntries(squad.slice(0, 2).map(p => [p.id, { ...p, rosterSource: "custom" as const }]));
    expect(Object.keys(repairCareer({ ...s, players: custom, lineup: [], bench: [] }).state.players)).toHaveLength(2);
  });

  it("deduplicates verified source rows without counting them toward reserve depth", () => {
    const squad = applyImportedSquad("flu", buildSquad("flu"), [record(), record()]);
    expect(squad.filter(p => p.sourcePlayerId === "provider-row-42")).toHaveLength(1);
    expect(squad.length).toBe(26);
    expect(new Set(squad.map(p => p.number)).size).toBe(26);
  });

  it("does not crash or cache malformed remote squad rows as players", () => {
    const records = [null, { ...record(), name: 42 }, { ...record(), id: " 42 " }, { ...record(), id: "42" }];
    const squad = applyImportedSquad("flu", [], records as unknown as RealPlayer[]);
    expect(squad.filter(p => p.rosterSource === "imported")).toHaveLength(1);
    expect(squad.every(p => Number.isFinite(p.age))).toBe(true);
  });

  it("repairs repeated shirt numbers without changing a valid custom athlete", () => {
    const s = career();
    const ids = Object.keys(s.players).slice(0, 2);
    const first = s.players[ids[0]!]!;
    const second = { ...s.players[ids[1]!]!, number: first.number, rosterSource: "custom" as const };
    const next = migrateCareer({ ...s, players: { ...s.players, [second.id]: second } });
    expect(new Set(Object.values(next.players).map(p => p.number)).size).toBe(Object.keys(next.players).length);
    expect(next.players[second.id]?.name).toBe(second.name);
    expect(next.players[second.id]?.ovr).toBe(second.ovr);
  });

  it("merges equal full-name and birth-date registrations and preserves aliases through the cache", () => {
    const records = [{ ...record("old"), birth_date: "2001-01-02", source_id: "provider-old" },
      { ...record("new"), birth_date: "2001-01-02", source_id: "provider-new", photo_url: "https://example.test/photo.png" }];
    const normalized = normalizeRealPlayers(records, "flu");
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.photo_url).toBe("https://example.test/photo.png");
    const cached = normalizeRealPlayers(JSON.parse(JSON.stringify(normalized)), "flu");
    expect(cached[0]?.identity_aliases).toContain("record:new");
    const s = career();
    const roster = applyImportedSquad("flu", buildSquad("flu"), cached);
    const owned = { ...s, players: Object.fromEntries(roster.map(p => [p.id, p])) };
    expect(signRealPlayer(owned, target("new"), { fee: 1, wage: 50 })).toBe(owned);
  });

  it("preserves equal names with different or absent dates of birth", () => {
    const rows = [{ ...record("A"), birth_date: "2001-01-02" },
      { ...record("B"), birth_date: "2002-01-02" }, record("C")];
    expect(normalizeRealPlayers(rows, "flu")).toHaveLength(3);
  });

  it("retains every source identity when a bridging row joins previously separate records", () => {
    const rows = [record("A"), record("B"),
      { ...record("C"), identity_aliases: ["record:A", "record:B"] }];
    const normalized = normalizeRealPlayers(rows, "flu");
    expect(normalized).toHaveLength(1);
    const cached = normalizeRealPlayers(JSON.parse(JSON.stringify(normalized)), "flu");
    expect(cached[0]?.identity_aliases).toEqual(expect.arrayContaining(["record:A", "record:B", "record:C"]));
    const s = career();
    const roster = applyImportedSquad("flu", buildSquad("flu"), cached);
    const owned = { ...s, players: Object.fromEntries(roster.map(p => [p.id, p])) };
    expect(signRealPlayer(owned, target("B"), { fee: 1, wage: 50 })).toBe(owned);
  });

  it("ignores malformed identity metadata in an untrusted personal save", () => {
    const s = career();
    const p = s.players[s.lineup[0]!]!;
    const broken = { ...s, players: { ...s.players, [p.id]: { ...p, sourceIdentityAliases: 42 as unknown as string[] } } };
    expect(() => repairCareer(broken)).not.toThrow();
    expect(() => signRealPlayer(broken, { ...target(), identity_aliases: 42 as unknown as string[] }, { fee: 1, wage: 50 })).not.toThrow();
  });

  it("keeps ID-less player identities stable when the source order changes", () => {
    const a = { ...record(), id: undefined, name: "Atleta Um" } as unknown as RealPlayer;
    const b = { ...record(), id: undefined, name: "Atleta Dois" } as unknown as RealPlayer;
    const first = applyImportedSquad("flu", buildSquad("flu"), [a, b]);
    const second = applyImportedSquad("flu", buildSquad("flu"), [b, a]);
    expect(first.find(p => p.name === a.name)?.id).toBe(second.find(p => p.name === a.name)?.id);
    expect(first.find(p => p.name === b.name)?.id).toBe(second.find(p => p.name === b.name)?.id);
  });

  it("recovers a copy stored under a different dictionary key with the same declared ID", () => {
    const s = career();
    const p = s.players[s.lineup[2]!]!;
    const result = repairCareer({ ...s, players: { ...s.players, "duplicate-save-key": { ...p } }, bench: [...s.bench, "duplicate-save-key"] });
    expect(Object.values(result.state.players).filter(player => player.name === p.name)).toHaveLength(1);
    expect(result.state.bench).not.toContain("duplicate-save-key");
    expect(repairCareer(result.state).fixes).toEqual([]);
  });

  it("rejects invalid financial input instead of creating a duplicate or corrupting the budget", () => {
    const s = career();
    expect(signRealPlayer(s, target(), { fee: -5, wage: 50 })).toBe(s);
    expect(signRealPlayer(s, target(), { fee: Number.NaN, wage: 50 })).toBe(s);
  });
});
