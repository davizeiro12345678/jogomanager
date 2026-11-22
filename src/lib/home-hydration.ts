/**
 * Keep the server-rendered public home responsive while the LCP hero image
 * paints. Hydrate on interaction or after the hero has settled and the browser
 * has been given two frames plus an idle opportunity. All other routes hydrate
 * without this gate.
 */
export type StartHook = (callback: () => void) => () => void;

export interface HomeHydrationHooks {
  onHeroSettled: StartHook;
  onFirstInteraction: StartHook;
  afterTwoFrames: StartHook;
  onIdle: StartHook;
  onDeadline: (callback: () => void, delayMs: number) => () => void;
}

export function shouldDeferHomeHydration(
  isPublicShell: boolean,
  pathname: string,
  hidden: boolean,
): boolean {
  return isPublicShell && pathname === "/" && !hidden;
}

export function deferHomeHydration(run: () => void, hooks: HomeHydrationHooks): void {
  let started = false;
  const disposers: Array<() => void> = [];

  const start = () => {
    if (started) return;
    started = true;
    for (const dispose of disposers) dispose();
    run();
  };

  const afterHero = () => {
    if (started) return;
    disposers.push(
      hooks.afterTwoFrames(() => {
        if (started) return;
        disposers.push(hooks.onIdle(start));
      }),
    );
  };

  disposers.push(hooks.onFirstInteraction(start));
  disposers.push(hooks.onHeroSettled(afterHero));
  // Remain interactive even if the responsive image never finishes loading.
  disposers.push(hooks.onDeadline(start, 3500));
}

/** Preserve the first mobile-menu tap while React is still hydrating the SSR shell. */
export function createDeferredClickReplay(replay: () => void) {
  let hydrated = false;
  let pending = false;
  return {
    queue(): boolean {
      if (hydrated) return false;
      pending = true;
      return true;
    },
    markHydrated(): void {
      if (hydrated) return;
      hydrated = true;
      if (pending) {
        pending = false;
        replay();
      }
    },
  };
}
