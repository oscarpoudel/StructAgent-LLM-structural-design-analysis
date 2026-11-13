import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeProjectDetails, validateProjectDetails, parseGridSpacings,
  validateStoryLevels, PROJECT_TYPES, DESIGN_BASES
} from '../app/static/js/projectMetadata.mjs';

test('new project requires a real name, without silently saving placeholder', () => {
  assert.equal(validateProjectDetails({name: '  '}).valid, false);
  assert.equal(validateProjectDetails({name: 'A'}).valid, false);
  assert.equal(validateProjectDetails({name: 'Three-story steel frame'}).valid, true);
});

test('normalizes project metadata and retains code basis as descriptive property', () => {
  const value = normalizeProjectDetails({
    name: '  Campus  Lab  ',
    metadata: {client: '  Civil    Eng  ', projectNumber: 'CE-43',
      structureType: 'industrial', codeBasis: 'NBC Nepal', location: 'Kathmandu'}
  });
  assert.equal(value.name, 'Campus Lab');
  assert.equal(value.metadata.client, 'Civil Eng');
  assert.equal(value.metadata.projectNumber, 'CE-43');
  assert.equal(value.metadata.codeBasis, 'NBC Nepal');
  assert.equal(value.metadata.structureType, 'industrial');
  assert.equal(value.metadata.location, 'Kathmandu');
  assert.equal(PROJECT_TYPES.includes(value.metadata.structureType), true);
  assert.equal(DESIGN_BASES.includes(value.metadata.codeBasis), true);
});

test('malformed metadata does not inject arbitrary project fields', () => {
  const result = normalizeProjectDetails({
    name: 'Campus',
    metadata: {codeBasis: 'Unknown', structureType: '<script>alert(1)</script>', x: 'bad'}
  });
  assert.equal(result.metadata.codeBasis, 'ASCE 7-22');
  assert.equal(result.metadata.structureType, 'building');
  assert.equal('x' in result.metadata, false);
});

test('grid parsing rejects non-finite, zero, negative and empty spacings', () => {
  for (const spacing of ['0,3', '-2,4', 'NaN,4', 'Infinity,3', '3,,5', '  ']) {
    assert.equal(parseGridSpacings(spacing).valid, false, spacing);
  }
  assert.deepEqual(parseGridSpacings('6, 6, 8').positions, [0, 6, 12, 20]);
});

test('story levels must have names and strictly increasing finite elevations', () => {
  assert.equal(validateStoryLevels([{name: 'Ground', elevation: 0}, {name: 'Roof', elevation: 3.5}]).valid, true);
  assert.equal(validateStoryLevels([{name: 'Ground', elevation: 0}, {name: 'Roof', elevation: 0}]).valid, false);
  assert.equal(validateStoryLevels([{name: 'Ground', elevation: 0}, {name: 'Ground', elevation: 3}]).valid, false);
  assert.equal(validateStoryLevels([{name: '', elevation: 0}, {name: 'Roof', elevation: 3}]).valid, false);
  assert.equal(validateStoryLevels([{name: 'Ground', elevation: 0}, {name: 'Roof', elevation: NaN}]).valid, false);
});
