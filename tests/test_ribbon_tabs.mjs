import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {activateRibbonTab} from '../app/static/js/ribbonState.mjs';

const names = ['model', 'loads', 'design', 'analyze', 'view'];

function makeElement(name) {
  const classes = new Set();
  const attributes = new Map();
  return {
    dataset: {ribbontab: name},
    classList: {
      contains(className) { return classes.has(className); },
      toggle(className, enabled) {
        if (enabled) classes.add(className);
        else classes.delete(className);
      },
    },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
  };
}

function makeRibbon() {
  const tabs = names.map(makeElement);
  const panels = names.map(makeElement);
  return {
    tabs, panels,
    querySelectorAll(selector) {
      if (selector === '.ribbon-tab') return tabs;
      if (selector === '.ribbon-panel') return panels;
      throw new Error('Unknown test selector: ' + selector);
    },
  };
}

test('every ribbon tab activates only its corresponding command panel', () => {
  const ribbon = makeRibbon();
  const clickOrder = ['model', 'loads', 'design', 'analyze', 'view', 'model', 'analyze'];
  for (const name of clickOrder) {
    assert.equal(activateRibbonTab(name, ribbon), true);
    assert.deepEqual(
      ribbon.tabs.filter(tab => tab.classList.contains('active')).map(tab => tab.dataset.ribbontab),
      [name],
    );
    assert.deepEqual(
      ribbon.panels.filter(panel => panel.classList.contains('active')).map(panel => panel.dataset.ribbontab),
      [name],
    );
    for (const tab of ribbon.tabs) {
      const isCurrent = tab.dataset.ribbontab === name;
      assert.equal(tab.getAttribute('aria-selected'), String(isCurrent));
      assert.equal(tab.tabIndex, isCurrent ? 0 : -1);
    }
    for (const panel of ribbon.panels) {
      assert.equal(panel.getAttribute('aria-hidden'), String(panel.dataset.ribbontab !== name));
    }
  }
});

test('invalid tab names do not leave navigation in a mismatched state', () => {
  const ribbon = makeRibbon();
  activateRibbonTab('model', ribbon);
  assert.equal(activateRibbonTab('invalid', ribbon), false);
  assert.equal(ribbon.panels.find(p => p.classList.contains('active')).dataset.ribbontab, 'model');
});

test('all five tab panels exist in the HTML and are wired to shared activation', () => {
  const html = readFileSync(new URL('../app/static/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../app/static/js/ribbon.js', import.meta.url), 'utf8');
  for (const name of names) {
    assert.match(html, new RegExp('class="ribbon-tab[^"]*"[^>]*data-ribbontab="' + name + '"'));
    assert.match(html, new RegExp('class="ribbon-panel[^"]*"[^>]*data-ribbontab="' + name + '"'));
  }
  assert.match(js, /wireRibbonNavigation\(ribbon, measureRibbon\)/);
  assert.doesNotMatch(js, /\$\('\.ribbon-panel'\)/);
});
