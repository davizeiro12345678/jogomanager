import type { ComponentType } from "react";
import type { CinematicSet } from "@/game/cinematic-blocking";
import type { CinematicSetProps } from "./types";

export type CinematicSetModule = { default: ComponentType<CinematicSetProps> };
export type CinematicSetLoader = () => Promise<CinematicSetModule>;

export const CINEMATIC_SET_LOADERS = {
  locker: () => import("./LockerRoom").then(({ LockerRoom }) => ({ default: LockerRoom })),
  tunnel: () => import("./Tunnel").then(({ Tunnel }) => ({ default: Tunnel })),
  press: () => import("./PressRoom").then(({ PressRoom }) => ({ default: PressRoom })),
  pitch: () => import("./PitchEntry").then(({ PitchEntry }) => ({ default: PitchEntry })),
  stands: () => import("./Stands").then(({ Stands }) => ({ default: Stands })),
  office: () => import("./Office").then(({ Office }) => ({ default: Office })),
  arrival: () => import("./BusArrival").then(({ BusArrival }) => ({ default: BusArrival })),
} satisfies Record<CinematicSet, CinematicSetLoader>;

const pendingSets = new Map<CinematicSet, Promise<CinematicSetModule>>();
/** Start the selected set alongside the stage, avoiding a second chunk waterfall. */
export function preloadCinematicSet(set: CinematicSet): Promise<CinematicSetModule> {
  let pending = pendingSets.get(set);
  if (!pending) {
    pending = CINEMATIC_SET_LOADERS[set]().catch((error: unknown) => {
      pendingSets.delete(set);
      throw error;
    });
    pendingSets.set(set, pending);
  }
  return pending;
}

export function resolveCinematicSetLoader(
  set: string,
  loaders: Readonly<Record<CinematicSet, CinematicSetLoader>> = CINEMATIC_SET_LOADERS,
): CinematicSetLoader | null {
  if (!Object.prototype.hasOwnProperty.call(loaders, set)) return null;
  return loaders === CINEMATIC_SET_LOADERS
    ? () => preloadCinematicSet(set as CinematicSet)
    : loaders[set as CinematicSet];
}
