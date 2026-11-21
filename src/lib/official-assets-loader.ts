/** Optional catalogue I/O; importing crest readers must not initialize IndexedDB. */
import { get, set } from "idb-keyval";
import type { OfficialAssets } from "./football.functions";
import { reportSilent } from "./silent-errors";

const CACHE_KEY = "manager3d.official.v3";
const TTL = 1000 * 60 * 60 * 24;

function stringRecord(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function reportCacheError(error: unknown, phase: "read" | "write") {
  reportSilent("assets.cache", error, {
    classification: phase === "write" ? "ignorable" : "degradation",
    feature: "official-assets",
    phase,
    dedupeKey: `official-assets-${phase}`,
  });
}

async function readCache(): Promise<OfficialAssets | null> {
  let parsed: { at: number; data: OfficialAssets } | null | undefined;
  try {
    parsed = await get(CACHE_KEY);
  } catch {
    // An existing offline catalogue remains usable if IndexedDB is denied.
  }
  try {
    if (parsed == null && typeof localStorage !== "undefined")
      parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    const age = parsed ? Date.now() - parsed.at : NaN;
    return parsed &&
      Number.isFinite(parsed.at) &&
      age >= 0 &&
      age <= TTL &&
      parsed.data &&
      stringRecord(parsed.data.crests) &&
      stringRecord(parsed.data.kits)
      ? parsed.data
      : null;
  } catch (error) {
    reportCacheError(error, "read");
    return null;
  }
}

export async function readOrFetchOfficialAssets(): Promise<OfficialAssets> {
  const cached = await readCache();
  if (cached) return cached;

  // These URLs are public. Never send a career/auth cookie with this projection.
  const response = await fetch("/api/public/football-assets", { credentials: "omit" });
  if (!response.ok) throw new Error("Catálogo de escudos indisponível.");
  const data: Partial<OfficialAssets> | null = await response.json();
  if (!data || !stringRecord(data.crests) || !stringRecord(data.kits))
    throw new Error("Catálogo de escudos inválido.");
  const assets: OfficialAssets = { crests: data.crests, kits: data.kits };
  if (Object.keys(assets.crests).length || Object.keys(assets.kits).length) {
    // Publishing images never waits on persistence or performs a synchronous
    // JSON/localStorage write of the full catalogue.
    void set(CACHE_KEY, { at: Date.now(), data: assets }).catch((error) => {
      reportCacheError(error, "write");
    });
  }
  return assets;
}
