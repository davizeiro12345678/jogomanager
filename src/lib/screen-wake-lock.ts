export type ScreenLockState = "requesting" | "active" | "released" | "unavailable";

/** Own one visible screen lock. Simulation and rendering never depend on it. */
export function keepScreenAwake(
  doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">,
  wakeLock: Pick<WakeLock, "request">,
  onState: (state: ScreenLockState) => void,
) {
  let disposed = false;
  let pending = false;
  let lock: WakeLockSentinel | undefined;
  let generation = 0;
  const release = (sentinel: WakeLockSentinel) => void sentinel.release().catch(() => undefined);
  const acquire = async () => {
    if (disposed || pending || lock || doc.visibilityState !== "visible") return;
    pending = true;
    const requested = generation;
    onState("requesting");
    try {
      const sentinel = await wakeLock.request("screen");
      if (disposed || requested !== generation || doc.visibilityState !== "visible") {
        release(sentinel);
        return;
      }
      lock = sentinel;
      sentinel.addEventListener(
        "release",
        () => {
          if (lock !== sentinel) return;
          lock = undefined;
          if (!disposed) onState("released");
        },
        { once: true },
      );
      onState("active");
    } catch {
      if (!disposed && requested === generation) onState("unavailable");
    } finally {
      pending = false;
      // A hidden/visible round trip may finish before the old request settles.
      if (!disposed && requested !== generation) void acquire();
    }
  };
  const visibility = () => {
    if (doc.visibilityState === "visible") {
      void acquire();
      return;
    }
    generation++;
    const previous = lock;
    lock = undefined;
    if (previous) release(previous);
    onState("released");
  };
  doc.addEventListener("visibilitychange", visibility);
  void acquire();
  return () => {
    disposed = true;
    generation++;
    doc.removeEventListener("visibilitychange", visibility);
    const previous = lock;
    lock = undefined;
    if (previous) release(previous);
  };
}
