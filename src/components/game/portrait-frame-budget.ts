/** Idle portrait animation has a 30Hz budget. Interaction, resize and texture
 * readiness can still request an immediate frame through R3F's own invalidation. */
export function schedulePortraitFrames(invalidate: () => void) {
  let active = true;
  const timer = setInterval(() => {
    if (active) invalidate();
  }, 1000 / 30);
  return () => {
    active = false;
    clearInterval(timer);
  };
}
