import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { wireRibbonNavigation } from '../app/static/js/ribbonState.mjs';

const ribbonSource = readFileSync(new URL('../app/static/js/ribbon.js', import.meta.url), 'utf8');

function fakeElement(name = '') {
  const events = new Map();
  const classes = new Set();
  const attrs = new Map();
  return {
    dataset: {ribbontab: name},
    style: {display: 'block'},
    classList: {
      toggle(key, on) {if (on) classes.add(key); else classes.delete(key);},
      contains(key) {return classes.has(key);},
    },
    setAttribute(key, value) {attrs.set(key, value);},
    addEventListener(name, cb) {events.set(name, cb);},
    click() {events.get('click')?.();},
    getBoundingClientRect() {return {height: 90};},
  };
}

test('ribbon init executes without a ReferenceError and real tab clicks change commands', () => {
  const names = ['model', 'loads', 'design', 'analyze', 'view'];
  const tabs = names.map(fakeElement);
  const panels = names.map(fakeElement);
  const commands = [fakeElement('export'), fakeElement('import')];
  commands[0].dataset.tool = 'export';
  commands[1].dataset.tool = 'import';
  const viewport = {scrollLeft: 50};
  const ribbon = {
    style: {display: 'block'},
    querySelectorAll(selector) {
      if (selector === '.ribbon-tab') return tabs;
      if (selector === '.ribbon-panel') return panels;
      throw new Error('Unexpected ribbon selector ' + selector);
    },
    querySelector(selector) {
      if (selector === '.ribbon-panels') return viewport;
      throw new Error('Unexpected child selector ' + selector);
    },
    getBoundingClientRect() {return {height: 90};},
  };

  const ids = {
    ribbon,
    emptyStart333: fakeElement(),
    emptyStartBeam: fakeElement(),
    canvasEmptyDismiss: fakeElement(),
    canvasEmpty: fakeElement(),
    importJsonFile: fakeElement(),
  };
  const domApi = {
    byId(id) {return ids[id] || null;},
    $$(selector) {
      if (selector === '.ribbon-btn[data-tool]') return commands;
      throw new Error('Unexpected collection selector ' + selector);
    },
    $(selector) {throw new Error('Single-element selector used for ' + selector);},
  };

  // Import declarations are removed only for this isolated runtime test.
  // Inject only the exact names imported by ribbon.js from dom.js, so a
  // missing $$ import causes an actual ReferenceError during initRibbon().
  const domImports = ribbonSource.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/dom\.js['"];/);
  assert.ok(domImports, 'DOM utility import not found');
  const importedNames = domImports[1].split(',').map(s => s.trim());
  const environment = {
    window: {addEventListener() {}, dispatchEvent() {}},
    requestAnimationFrame() {},
    wireRibbonNavigation,
    dismissCanvasEmptyState() {},
    openPopup() {},
    switchLoadTab() {},
    switchSectionTab() {},
    loadHistory() {},
    drawSimpleBeam() {},
    drawThreeByThreeThreeStoryFrame() {},
    applyMemberGroupSections() {},
    exportModelJson() {},
  };
  for (const name of importedNames) {
    if (name in domApi) environment[name] = domApi[name];
  }
  const transformed = ribbonSource
    .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/\bexport\s+(?=function\b)/g, '');
  const context = vm.createContext(environment);
  vm.runInContext(transformed + '\ninitRibbon();', context);

  assert.equal(commands.every(button => button.click !== undefined), true);
  for (const selected of ['loads', 'design', 'analyze', 'view', 'model']) {
    tabs.find(tab => tab.dataset.ribbontab === selected).click();
    assert.deepEqual(
      panels.filter(panel => panel.classList.contains('active')).map(panel => panel.dataset.ribbontab),
      [selected],
    );
  }
});
