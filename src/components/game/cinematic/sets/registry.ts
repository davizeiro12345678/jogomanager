import type { ComponentType } from "react";
import type { CinematicSet } from "@/game/cinematic-blocking";
import type { CinematicSetProps } from "./types";

export type CinematicSetModule = { default: ComponentType<CinematicSetProps> };
export type CinematicSetLoader = () => Promise<CinematicSetModule>;

/** One import per set, shared by preloading and React.lazy; a failure is retryable. */
export function cacheCinematicSetLoader(load: CinematicSetLoader): CinematicSetLoader {
  let pending: Promise<CinematicSetModule> | undefined;
  return () =>
    (pending ??= Promise.resolve()
      .then(load)
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      }));
}

export const CINEMATIC_SET_LOADERS = {
  locker: cacheCinematicSetLoader(() =>
    import("./LockerRoom").then(({ LockerRoom }) => ({ default: LockerRoom })),
  ),
  tunnel: cacheCinematicSetLoader(() =>
    import("./Tunnel").then(({ Tunnel }) => ({ default: Tunnel })),
  ),
  press: cacheCinematicSetLoader(() =>
    import("./PressRoom").then(({ PressRoom }) => ({ default: PressRoom })),
  ),
  pitch: cacheCinematicSetLoader(() =>
    import("./PitchEntry").then(({ PitchEntry }) => ({ default: PitchEntry })),
  ),
  stands: cacheCinematicSetLoader(() =>
    import("./Stands").then(({ Stands }) => ({ default: Stands })),
  ),
  office: cacheCinematicSetLoader(() =>
    import("./Office").then(({ Office }) => ({ default: Office })),
  ),
  arrival: cacheCinematicSetLoader(() =>
    import("./BusArrival").then(({ BusArrival }) => ({ default: BusArrival })),
  ),
} satisfies Record<CinematicSet, CinematicSetLoader>;

export function resolveCinematicSetLoader(
  set: string,
  loaders: Readonly<Record<CinematicSet, CinematicSetLoader>> = CINEMATIC_SET_LOADERS,
): CinematicSetLoader | null {
  if (!Object.prototype.hasOwnProperty.call(loaders, set)) return null;
  return loaders[set as CinematicSet];
}

/** Start only the selected scene while the heavier stage chunk is in flight. */
export function preloadCinematicSet(set: string) {
  return resolveCinematicSetLoader(set)?.() ?? Promise.resolve(null);
}
