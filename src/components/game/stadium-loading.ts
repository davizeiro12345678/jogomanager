let stadium: Promise<typeof import("./Stadium3D")> | undefined;
/** Shared by intent preloading and React.lazy; failures remain retryable. */
export function preloadStadium() {
  stadium ??= import("./Stadium3D").catch((error: unknown) => {
    stadium = undefined;
    throw error;
  });
  return stadium;
}
