const KEY = "pfm-consent-v1";
/** Explicit browser preferences only; never enumerate arbitrary application/provider data. */
const PUBLIC_GAME_PREFERENCES = new Set([
  KEY,
  "jogomanager.lang",
  "pfm3d.lang",
  "manager3d.visual.v3",
  "manager3d.accessibility.v1",
  "manager3d.career-density",
  "manager3d.recent-navigation.v1",
  "manager3d.ceremony",
  "manager3d.prematchIntro",
  "manager3d.officialLook",
]);

export function canAccessCareerMirror(key: string, owner: string | null = null): boolean {
  if (PUBLIC_GAME_PREFERENCES.has(key)) return true;
  if (
    key === "manager3d.career.v1" ||
    key === "pfm.player-career.v1" ||
    /^manager3d\.athlete\.v1\.[1-3]$/.test(key)
  )
    return owner === null;
  if (key.startsWith("manager3d.career.v1:user:")) {
    return owner !== null && key === `manager3d.career.v1:user:${encodeURIComponent(owner)}`;
  }
  const scope = owner ? `user:${encodeURIComponent(owner)}` : "guest";
  const slotPrefixes = [
    "manager3d.athlete.v2",
    "manager3d.athlete.envelope.v1",
    "manager3d.athlete.backup.v1",
    "manager3d.athlete.conflict-backup.v1",
  ];
  if (slotPrefixes.some((prefix) => [1, 2, 3].some((slot) => key === `${prefix}.${scope}.${slot}`)))
    return true;
  return [
    "manager3d.athlete.index.v1",
    "manager3d.athlete.outbox.v1",
    "manager3d.athlete.cloud-revisions.v1",
  ].some((prefix) => key === `${prefix}.${scope}`);
}

export async function exportLocalData(
  owner: string | null = null,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || k.startsWith("sb-") || !canAccessCareerMirror(k, owner)) continue; // sessão de login não é exportada
    const v = window.localStorage.getItem(k);
    try {
      out[k] = v ? JSON.parse(v) : v;
    } catch {
      out[k] = v;
    }
  }
  const { exportLocalCareerData } = await import("@/lib/offline/store");
  const { exportReplayArchive } = await import("@/game/replay-storage");
  out["offlineCareer"] = await exportLocalCareerData(owner);
  // The replay store admits global historical archives for guests only.
  out["localReplayArchive"] = await exportReplayArchive(owner);
  return out;
}

export async function clearLocalData(owner: string | null = null): Promise<boolean> {
  let indexedDbDataCleared: boolean;
  try {
    const [{ clearLocalCareerData }, { clearReplayArchive }, { clearVoiceCache }] =
      await Promise.all([
        import("@/lib/offline/store"),
        import("@/game/replay-storage"),
        import("@/game/audio-cache"),
      ]);
    const results = await Promise.all([
      clearLocalCareerData(owner),
      clearReplayArchive(owner),
      ...(owner === null ? [clearVoiceCache()] : []),
    ]);
    indexedDbDataCleared = results.every(Boolean);
  } catch {
    indexedDbDataCleared = false;
  }
  const keys: string[] = [];
  let localStorageCleared = true;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && !k.startsWith("sb-") && canAccessCareerMirror(k, owner)) keys.push(k);
  }
  try {
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    localStorageCleared = false;
  }
  return indexedDbDataCleared && localStorageCleared;
}
