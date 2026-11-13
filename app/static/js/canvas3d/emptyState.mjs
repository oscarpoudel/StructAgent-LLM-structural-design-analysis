/** Show the quick-start card only when the current model contains no nodes.
 * The card can be dismissed without suppressing normal canvas interaction.
 */
let dismissed = false;

export function resetCanvasEmptyState() {
  dismissed = false;
}

export function dismissCanvasEmptyState(overlay) {
  dismissed = true;
  return updateCanvasEmptyState(overlay, 0);
}

export function updateCanvasEmptyState(overlay, nodeCount) {
  if (!overlay) return false;
  const visible = Number(nodeCount) === 0 && !dismissed;
  overlay.classList.toggle('show', visible);
  overlay.hidden = !visible;
  overlay.setAttribute('aria-hidden', String(!visible));
  return visible;
}
