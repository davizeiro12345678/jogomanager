/** Keep simulation suspended while the tab is hidden, independently of cinematic state. */
export function shouldPauseMatch(
  manuallyPaused: boolean,
  introActive: boolean,
  ceremonyActive: boolean,
  halfHeld: boolean,
  documentHidden: boolean,
  overlayActive = false,
): boolean {
  return manuallyPaused || introActive || ceremonyActive || halfHeld || documentHidden || overlayActive;
}
