let pending: Promise<typeof import("@/components/game/QuickLive")> | undefined;

/** Share intent and click preparation; world setup completes before live play. */
export function loadQuickLive() {
  if (pending) return pending;
  pending = Promise.all([
    import("@/components/game/QuickLive"),
    import("../lib/world").then((world) => world.default()),
    // The quick-match picker uses the light stylesheet; live play needs the full one.
    import("../lib/game-stylesheet-loader").then((sheet) => sheet.ensureGameStylesheet()),
  ]).then(
    ([page]) => {
      pending = undefined;
      return page;
    },
    (error: unknown) => {
      pending = undefined;
      throw error;
    },
  );
  return pending;
}
