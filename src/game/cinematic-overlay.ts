/** A cutscene temporarily owns the visual focus. Other previews keep their
 * own pause preference and resume only when the last dialog closes. */
const listeners = new Set<() => void>();
let overlays = 0;

export const cinematicOverlayActive = () => overlays > 0;
export function subscribeCinematicOverlay(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function beginCinematicOverlay() {
  const wasActive = cinematicOverlayActive();
  overlays++;
  if (!wasActive) [...listeners].forEach((listener) => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    overlays--;
    if (!cinematicOverlayActive()) [...listeners].forEach((listener) => listener());
  };
}
