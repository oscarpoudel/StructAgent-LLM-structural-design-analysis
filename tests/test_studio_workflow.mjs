import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { hasDescriptiveName, selectProjectVersion } from '../app/static/js/projectResolver.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('a named project takes precedence over a stale New Project placeholder', () => {
  const server = {id: 'p1', name: 'Steel Laboratory', updatedAt: 1000};
  const local = {id: 'p1', name: 'New Project', updatedAt: 5000};
  assert.strictEqual(selectProjectVersion(local, server), server);
  assert.equal(hasDescriptiveName(server), true);
  assert.equal(hasDescriptiveName(local), false);
});

test('a locally renamed project can replace the server placeholder', () => {
  const server = {id: 'p1', name: 'New Project', updatedAt: 5000};
  const local = {id: 'p1', name: 'Seismic Office Block', updatedAt: 1000};
  assert.strictEqual(selectProjectVersion(local, server), local);
});

test('newer records win when both contain real project names', () => {
  const server = {name: 'Building A', updatedAt: 5000};
  const local = {name: 'Building B', updatedAt: 6000};
  assert.strictEqual(selectProjectVersion(local, server), local);
  assert.strictEqual(selectProjectVersion({...local, updatedAt: 5000}, server), server);
});

test('ribbon controls remain accessible on two-row horizontal ribbon', () => {
  const css = read('app/static/styles.css');
  const js = read('app/static/js/ribbon.js');
  const html = read('app/static/index.html');
  assert.match(css, /\.ribbon-panel\.active\s*\{[^}]*flex-flow:\s*row nowrap/);
  assert.match(css, /\.ribbon-panels\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(js, /panels\.scrollLeft = 0;\s*measureRibbon\(\);/); // responsive tab change
  assert.match(html, /id="memberDiagramsBtn"/);
  assert.match(html, /id="forceComponentSelect"/);
  assert.match(html, /id="resultsPanelToggleBtn"/);
});

test('project information accessible by dashboard, header and model ribbon', () => {
  const html = read('app/static/index.html');
  const js = read('app/static/js/main.js');
  assert.match(html, /id="projectInfoBtn"/);
  assert.match(html, /id="projectName" class="project-name-action"/);
  assert.match(js, /className = 'project-card-details'/);
  assert.match(js, /byId\('projectName'\)\.addEventListener\('click'/);
  assert.match(js, /byId\('projectInfoBtn'\)\.addEventListener\('click'/);
  assert.match(js, /currentProject\.name = details\.details\.name;/);
});

test('force diagram modal offers axial, two local shear and bending components and torsion', () => {
  const html = read('app/static/index.html');
  const js = read('app/static/js/memberDiagrams.js');
  for (const component of ['N', 'Vy', 'Vz', 'My', 'Mz', 'T']) {
    assert.match(html, new RegExp('<option value="' + component + '"'));
    assert.match(js, new RegExp("\\['" + component + "'"));
  }
  assert.match(js, /member_force_diagrams/);
  assert.match(js, /diagramCsvBtn/);
});
