import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { wireRibbonNavigation } from '../app/static/js/ribbonState.mjs';
import {
  updateCanvasEmptyState, dismissCanvasEmptyState, resetCanvasEmptyState
} from '../app/static/js/canvas3d/emptyState.mjs';

const names = ['model', 'loads', 'design', 'analyze', 'view'];

function makeNode(name) {
  const classes = new Set();
  const attrs = {};
  const events = {};
  return {
    dataset: { ribbontab: name },
    classList: {
      toggle(key, enabled) { if (enabled) classes.add(key); else classes.delete(key); },
      contains(key) { return classes.has(key); },
    },
    setAttribute(key, value) { attrs[key] = value; },
    getAttribute(key) { return attrs[key]; },
    addEventListener(name, callback) { events[name] = callback; },
    click() { if (!events.click) throw new Error('Missing click handler'); events.click(); },
  };
}

test('actual ribbon click handlers switch tabs and corresponding command panels', () => {
  const tabs = names.map(makeNode);
  const panels = names.map(makeNode);
  const viewport = {scrollLeft: 70};
  const ribbon = {
    querySelectorAll(selector) {
      if (selector === '.ribbon-tab') return tabs;
      if (selector === '.ribbon-panel') return panels;
      throw new Error('Invalid selector: ' + selector);
    },
    querySelector(selector) { return selector === '.ribbon-panels' ? viewport : null; },
  };
  let resizeCalls = 0;
  assert.equal(wireRibbonNavigation(ribbon, () => { resizeCalls++; }), true);
  for (const name of ['loads', 'design', 'analyze', 'view', 'model', 'loads']) {
    viewport.scrollLeft = 60;
    tabs.find(tab => tab.dataset.ribbontab === name).click();
    assert.deepEqual(tabs.filter(t => t.classList.contains('active')).map(t => t.dataset.ribbontab), [name]);
    assert.deepEqual(panels.filter(p => p.classList.contains('active')).map(p => p.dataset.ribbontab), [name]);
    assert.equal(viewport.scrollLeft, 0);
  }
  assert.equal(resizeCalls, 6);
});

test('ribbon module imports collection selector and does not use single-item forEach', () => {
  const code = readFileSync(new URL('../app/static/js/ribbon.js', import.meta.url), 'utf8');
  assert.match(code, /import\s*\{\s*byId\s*,\s*\$\$\s*\}\s*from\s*['"]\.\/dom\.js['"]/);
  assert.match(code, /\$\$\('\.ribbon-btn\[data-tool\]'\)\.forEach/);
  assert.doesNotMatch(code, /\$\('\.ribbon-tab'[^\n]*\.forEach/);
  assert.match(code, /wireRibbonNavigation\(ribbon, measureRibbon\)/);
});

test('quick-start prompt is dismissible and removed when a model has nodes', () => {
  const attrs = {};
  const classes = new Set();
  const overlay = {
    hidden: false,
    classList: {
      toggle(key, active) { if (active) classes.add(key); else classes.delete(key); },
      contains(key) { return classes.has(key); },
    },
    setAttribute(key, value) { attrs[key] = value; },
  };
  resetCanvasEmptyState();
  assert.equal(updateCanvasEmptyState(overlay, 0), true);
  assert.equal(overlay.hidden, false);
  assert.equal(updateCanvasEmptyState(overlay, 2), false);
  assert.equal(overlay.hidden, true);
  assert.equal(overlay.classList.contains('show'), false);
  assert.equal(updateCanvasEmptyState(overlay, 0), true);
  assert.equal(dismissCanvasEmptyState(overlay), false);
  assert.equal(updateCanvasEmptyState(overlay, 0), false);
  resetCanvasEmptyState();
  assert.equal(updateCanvasEmptyState(overlay, 0), true);
});

test('studio canvas uses compact, unobtrusive and dismissible quick-start card', () => {
  const css = readFileSync(new URL('../app/static/styles.css', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../app/static/index.html', import.meta.url), 'utf8');
  const render = readFileSync(new URL('../app/static/js/canvas3d/render.js', import.meta.url), 'utf8');
  assert.match(css, /\.canvas-wrap \.canvas-empty\s*\{\s*inset:auto/);
  assert.match(html, /id="canvasEmptyDismiss"/);
  assert.match(render, /updateCanvasEmptyState\(byId\('canvasEmpty'\), S\.nodes\.length\)/);
});
