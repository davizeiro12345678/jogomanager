let pending: Promise<typeof import("@/components/game/QuickLive")> | undefined;

/** Share intent and click preparation; world setup completes before live play. */
export function loadQuickLive() {
  return (pending ??= Promise.all([
    import("@/components/game/QuickLive"),
    import("../lib/world").then((world) => world.initializeWorld()),
  ]).then(
    ([page]) => page,
    (error: unknown) => {
      pending = undefined;
      throw error;
    },
  ));
}
