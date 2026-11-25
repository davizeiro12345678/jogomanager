/** Recover pending optional shader work on the same Canvas without letting an
 * asynchronous invalidation from an older context cancel its replacement. */
export function observeWarmupContext(
  canvas: EventTarget,
  suspend: () => void,
  invalidate: () => Promise<unknown>,
  resume: () => void,
): () => void {
  let active = true;
  let lost = false;
  let generation = 0;
  let pending: Promise<unknown> = Promise.resolve();
  const onLost = () => {
    lost = true;
    generation++;
    suspend();
    pending = pending.then(invalidate).catch(() => undefined);
  };
  const onRestored = () => {
    if (!lost) return;
    const restoredGeneration = generation;
    void pending.then(() => {
      if (!active || !lost || restoredGeneration !== generation) return;
      lost = false;
      resume();
    });
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return () => {
    active = false;
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
  };
}
