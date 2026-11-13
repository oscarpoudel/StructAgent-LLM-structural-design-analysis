/** Project metadata and geometry validation shared by the browser and CI tests. */
export const PROJECT_TYPES = Object.freeze([
  'building', 'industrial', 'bridge', 'other'
]);
export const DESIGN_BASES = Object.freeze([
  'ASCE 7-22', 'ASCE 7-16', 'Eurocodes', 'NBC Nepal', 'Other / project-specific'
]);

const FIELDS = Object.freeze({
  projectNumber: 80, client: 120, engineer: 120, location: 160, description: 1200
});

const cleanText = (value, limit) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, limit);

export function normalizeProjectDetails(raw = {}) {
  const meta = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  const name = cleanText(raw.name, 120);
  const metadata = {};
  for (const [key, limit] of Object.entries(FIELDS)) metadata[key] = cleanText(meta[key], limit);
  metadata.structureType = PROJECT_TYPES.includes(meta.structureType) ? meta.structureType : 'building';
  metadata.codeBasis = DESIGN_BASES.includes(meta.codeBasis) ? meta.codeBasis : 'ASCE 7-22';
  return { name, metadata };
}

export function validateProjectDetails(raw) {
  const details = normalizeProjectDetails(raw);
  if (details.name.length < 2) {
    return { valid: false, message: 'Enter a project name with at least two characters.', field: 'ProjectName', details };
  }
  if (details.name.length > 120) {
    return { valid: false, message: 'Project name must have no more than 120 characters.', field: 'ProjectName', details };
  }
  return { valid: true, message: '', field: '', details };
}

export function parseGridSpacings(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: false, message: 'Enter at least one grid spacing.', positions: [] };
  const tokens = text.split(',').map(token => token.trim());
  if (tokens.length > 40 || tokens.some(token => !token)) {
    return { valid: false, message: 'Provide 1 to 40 comma-separated grid spacings.', positions: [] };
  }
  const positions = [0];
  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isFinite(value) || value <= 0 || value > 1000) {
      return { valid: false, message: 'Grid spacings must be positive finite values up to 1000 m.', positions: [] };
    }
    positions.push(positions[positions.length - 1] + value);
  }
  return { valid: true, message: '', positions };
}

export function validateStoryLevels(levels) {
  if (!Array.isArray(levels) || levels.length < 2 || levels.length > 50) {
    return { valid: false, message: 'Provide a base level and 1 to 49 upper levels.' };
  }
  const names = new Set();
  let previous = -Infinity;
  for (const [index, level] of levels.entries()) {
    const name = String(level.name ?? '').trim();
    const elevation = level.elevation;
    if (!name || name.length > 80) {
      return { valid: false, message: `Provide a level name (up to 80 characters) for row ${index + 1}.` };
    }
    const key = name.toLowerCase();
    if (names.has(key)) return { valid: false, message: `Duplicate level name: ${name}.` };
    names.add(key);
    if (typeof elevation !== 'number' || !Number.isFinite(elevation)) {
      return { valid: false, message: `Enter a finite elevation for level ${name}.` };
    }
    if (elevation <= previous) {
      return { valid: false, message: 'Story elevations must increase strictly from bottom to top.' };
    }
    previous = elevation;
  }
  return { valid: true, message: '' };
}
