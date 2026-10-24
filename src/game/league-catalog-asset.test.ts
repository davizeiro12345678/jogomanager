import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import {
  isLeagueCatalogModule,
  leagueCatalogAsset,
  sharedLeagueCatalog,
} from "../../scripts/league-catalog-asset";
import * as source from "./data/leagues";
import type { Plugin } from "vite";

describe("shared built-in league asset", () => {
  it("keeps browser and worker ownership while retaining normal server source modules", () => {
    const apply = leagueCatalogAsset().applyToEnvironment;
    type Environment = Parameters<NonNullable<Plugin["applyToEnvironment"]>>[0];
    for (const name of ["client", "worker"])
      expect(apply?.({ name, config: { consumer: "client" } } as Environment)).toBe(true);
    expect(apply?.({ name: "ssr", config: { consumer: "server" } } as Environment)).toBe(false);
    expect(isLeagueCatalogModule("@/game/data/leagues")).toBe(true);
    expect(
      isLeagueCatalogModule(
        "./data/leagues",
        fileURLToPath(new URL("./career.ts", import.meta.url)),
      ),
    ).toBe(true);
    expect(
      isLeagueCatalogModule(
        "./data/leagues-api",
        fileURLToPath(new URL("./career.ts", import.meta.url)),
      ),
    ).toBe(false);
    expect(isLeagueCatalogModule("/another-project/src/game/data/leagues.ts")).toBe(false);
  });

  it("preserves every league, legacy identity, club and lookup after compilation", async () => {
    const compiled = await sharedLeagueCatalog();
    const asset = (await import(
      /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`
    )) as typeof source;
    expect(Object.keys(asset).sort()).toEqual(Object.keys(source).sort());
    for (const key of [
      "LEAGUES",
      "CLUBS",
      "LEGACY_LEAGUES",
      "BUNDLED_LEAGUES",
      "SHIPPED_LEAGUES",
    ] as const)
      expect(asset[key], key).toEqual(source[key]);
    for (const league of source.LEAGUES) expect(asset.getLeague(league.id)).toEqual(league);
    expect(asset.getLeague("missing-catalog-id")).toEqual(source.getLeague("missing-catalog-id"));
    expect(asset.SHIPPED_LEAGUES).toBe(asset.BUNDLED_LEAGUES);
    expect(Object.isFrozen(asset.BUNDLED_LEAGUES)).toBe(true);
    const league = asset.LEAGUES[0]!;
    const originalName = source.LEAGUES[0]!.name;
    league.name = "Local custom catalog";
    expect(asset.getLeague(league.id).name).toBe("Local custom catalog");
    expect(source.LEAGUES[0]!.name).toBe(originalName);
    expect(asset.BUNDLED_LEAGUES[0]!.name).toBe(originalName);
    expect(asset.CLUBS[league.clubs[0]!.id]).toBe(league.clubs[0]);
  });
});
