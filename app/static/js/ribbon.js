import { byId, $ } from './dom.js';
import { activateRibbonTab } from './ribbonState.mjs';
import { openPopup } from './tabs.js';
import { switchLoadTab } from './loads.js';
import { switchSectionTab } from './sections.js';
import { loadHistory } from './history.js';
import {
  drawSimpleBeam,
  drawThreeByThreeThreeStoryFrame,
  applyMemberGroupSections,
  exportModelJson,
} from './analysis.js';

const LOAD_TOOLS = ['wind', 'seismic', 'spectrum', 'snow', 'pdelta', 'sensitivity', 'multihazard'];
const DESIGN_TOOLS = ['library', 'select', 'concrete', 'timber', 'foundation', 'fatigue', 'cost'];

export function initRibbon() {
  initRibbonTabs();
  initRibbonActions();
  initEmptyState();
  measureRibbon();
  window.addEventListener('resize', measureRibbon);
  const commandViewport = byId('ribbon')?.querySelector('.ribbon-panels');
  if (commandViewport) {
    commandViewport.addEventListener('wheel', event => {
      if (commandViewport.scrollWidth <= commandViewport.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      commandViewport.scrollLeft += event.deltaY;
    }, { passive: false });
  }
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(measureRibbon);
    observer.observe(byId('ribbon'));
  }
}

// Quick-start buttons shown on the empty canvas.
function initEmptyState() {
  const start333 = byId('emptyStart333');
  if (start333) start333.addEventListener('click', () => drawThreeByThreeThreeStoryFrame());
  const startBeam = byId('emptyStartBeam');
  if (startBeam) startBeam.addEventListener('click', () => drawSimpleBeam({}));
}

// Keep the draw page offset in sync with the ribbon's real height (which can
// vary with content and viewport width).
export function measureRibbon() {
  requestAnimationFrame(() => {
    const ribbon = byId('ribbon');
    if (!ribbon || ribbon.style.display === 'none') return;
    const h = Math.ceil(ribbon.getBoundingClientRect().height);
    if (h > 0) {
      const previous = parseInt(document.documentElement.style.getPropertyValue('--ribbon-actual') || '0', 10);
      if (previous !== h) {
        document.documentElement.style.setProperty('--ribbon-actual', `${h}px`);
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      }
    }
  });
}

function initRibbonTabs() {
  const ribbon = byId('ribbon');
  if (!ribbon) return;
  activateRibbonTab('model', ribbon);
  $('.ribbon-tab', ribbon).forEach((tab) => {
    tab.addEventListener('click', () => {
      if (!activateRibbonTab(tab.dataset.ribbontab, ribbon)) return;
      const panels = ribbon.querySelector('.ribbon-panels');
      if (panels) panels.scrollLeft = 0;
      measureRibbon();
    });
  });
}

function initRibbonActions() {
  $$('.ribbon-btn[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => runRibbonAction(btn.dataset.tool));
  });
}

function runRibbonAction(tool) {
  if (tool === 'history') {
    openPopup('modal-history');
    loadHistory();
    return;
  }
  if (LOAD_TOOLS.includes(tool)) {
    openPopup('modal-loads');
    switchLoadTab(tool);
    return;
  }
  if (DESIGN_TOOLS.includes(tool)) {
    openPopup('modal-sections');
    switchSectionTab(tool);
    return;
  }
  if (tool === 'draw333') {
    drawThreeByThreeThreeStoryFrame();
    return;
  }
  if (tool === 'drawbeam') {
    drawSimpleBeam({});
    return;
  }
  if (tool === 'applysections') {
    applyMemberGroupSections();
    return;
  }
  if (tool === 'export') {
    exportModelJson();
    return;
  }
  if (tool === 'import') {
    const file = byId('importJsonFile');
    if (file) file.click();
  }
}
