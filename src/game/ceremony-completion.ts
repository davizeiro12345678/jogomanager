/**
 * Complete a visual pre-match ceremony even if WebGL stops rendering frames.
 * The deadline never alters simulation state: it only releases the visual gate.
 */
export function createCeremonyCompletion(onDone: () => void, timeoutMs: number) {
  let finished = false;
  const complete = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    onDone();
  };
  const timeout = setTimeout(complete, timeoutMs);
  return {
    complete,
    cancel() {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
    },
  };
}
