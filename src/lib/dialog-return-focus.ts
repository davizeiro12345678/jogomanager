/** Called only after a modal focus trap closes. If neither target is available,
 * leave native cleanup and the route's own heading-focus lifecycle in charge. */
export function restoreDialogFocus(
  trigger: HTMLElement | null,
  heading: HTMLElement | null,
): boolean {
  for (const target of [trigger, heading]) {
    if (
      !target?.isConnected ||
      target.matches(":disabled, [aria-disabled='true']") ||
      target.getClientRects().length === 0
    ) {
      continue;
    }
    if (target === heading && !target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus({ preventScroll: target === trigger });
    if (target.ownerDocument.activeElement === target) return true;
  }
  return false;
}
