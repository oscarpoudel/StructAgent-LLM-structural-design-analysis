/** Keep ribbon tab buttons and command panels in exactly the same state.
 *
 * Passing the ribbon root makes the behavior testable without a browser and
 * prevents a single-element selector from leaving the Model panel stuck.
 */
export function activateRibbonTab(name, root) {
  if (!root || !name) return false;
  const tabs = Array.from(root.querySelectorAll('.ribbon-tab'));
  const panels = Array.from(root.querySelectorAll('.ribbon-panel'));
  const hasTab = tabs.some(tab => tab.dataset.ribbontab === name);
  const hasPanel = panels.some(panel => panel.dataset.ribbontab === name);
  if (!hasTab || !hasPanel) return false;

  for (const tab of tabs) {
    const selected = tab.dataset.ribbontab === name;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of panels) {
    const selected = panel.dataset.ribbontab === name;
    panel.classList.toggle('active', selected);
    panel.setAttribute('aria-hidden', String(!selected));
  }
  return true;
}

/** Wire actual user clicks, not only the active-class state transition. */
export function wireRibbonNavigation(root, onChange = () => {}) {
  if (!root) return false;
  if (!activateRibbonTab('model', root)) return false;
  const tabs = Array.from(root.querySelectorAll('.ribbon-tab'));
  const viewport = root.querySelector('.ribbon-panels');
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      if (!activateRibbonTab(tab.dataset.ribbontab, root)) return;
      if (viewport) viewport.scrollLeft = 0;
      onChange();
    });
  }
  return true;
}
