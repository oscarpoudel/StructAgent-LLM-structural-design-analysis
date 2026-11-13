import { byId, $$ } from './dom.js';
import { createProject, deleteProject, getAllProjects, getProject, saveProject } from './projects.js';
import { S, resetModel } from './state.js';
import { normalizeProjectDetails, validateProjectDetails, parseGridSpacings, validateStoryLevels } from './projectMetadata.mjs';
import { canvas3d, draw, initCanvas, resizeCanvas } from './canvas3d/index.js';
import { triggerRedraw } from './canvas3d/scene.js';
import { initAnalysis } from './analysis.js';
import { resetCanvasEmptyState, updateCanvasEmptyState } from './canvas3d/emptyState.mjs';
import { initChat } from './chat.js';
import { initHistory } from './history.js';
import { initModals, showLoadModal, showMemberLoadModal, showSupportModal, showSlabModal } from './modals.js';
import { initExports } from './results.js';
import { initSections } from './sections.js';
import { initLoads } from './loads.js';
import { initRibbon, measureRibbon } from './ribbon.js';
import { initPopups } from './tabs.js';
import { initModelTree } from './modelTree.js';
import { initViewPresets } from './viewPresets.js';
import { initCommandPalette } from './commandPalette.js';
import { initTheme } from './theme.js';
import { initShortcuts } from './shortcuts.js';
import { initStatusbar } from './statusbar.js';
import { initCameraPosition, updateStatus } from './canvas3d/ui.js';

let currentProject = null;
let drawPageInitialized = false;
let autosaveTimer = null;
let lastSavedSnapshot = '';

initTheme();
initLandingPage();
initSetupPage();
initCommandPalette();

function initLandingPage() {
  byId('newProjectBtn').addEventListener('click', () => {
    currentProject = createProject({ name: '' });
    resetSetupForm();
    showSetupPage();
    byId('setupProjectName').focus();
  });

  loadProjectGrid();
}

async function loadProjectGrid() {
  const grid = byId('projectGrid');
  try {
    const projects = await getAllProjects();
    if (projects.length === 0) {
      grid.innerHTML = '<p class="placeholder">No projects yet. Create one to get started.</p>';
      return;
    }
    grid.innerHTML = '';
    projects.forEach(proj => {
      const card = document.createElement('article');
      card.className = 'project-card';
      const heading = document.createElement('h3');
      heading.textContent = proj.name || 'Untitled Project';
      card.appendChild(heading);

      const metadata = normalizeProjectDetails(proj).metadata;
      if (metadata.projectNumber) {
        const reference = document.createElement('p');
        reference.className = 'project-card-ref';
        reference.textContent = metadata.projectNumber;
        card.appendChild(reference);
      }
      const details = [metadata.client, metadata.location, metadata.codeBasis].filter(Boolean);
      if (details.length) {
        const info = document.createElement('div');
        info.className = 'project-card-meta';
        details.forEach(detail => {
          const span = document.createElement('span');
          span.textContent = detail;
          info.appendChild(span);
        });
        card.appendChild(info);
      }

      const stats = document.createElement('div');
      stats.className = 'project-card-stats';
      for (const label of [
        `${(proj.nodes || []).length} nodes`,
        `${(proj.members || []).length} members`,
        `${(proj.levels || []).length} levels`
      ]) {
        const span = document.createElement('span');
        span.textContent = label;
        stats.appendChild(span);
      }
      card.appendChild(stats);

      const more = document.createElement('details');
      more.className = 'project-card-details';
      const summary = document.createElement('summary');
      summary.textContent = 'Project information';
      more.appendChild(summary);
      const metadataFields = [
        ['Project number', metadata.projectNumber], ['Client', metadata.client],
        ['Engineer', metadata.engineer], ['Location', metadata.location],
        ['Structure type', metadata.structureType], ['Reference code', metadata.codeBasis],
        ['Description', metadata.description],
      ].filter(([, value]) => String(value || '').trim());
      if (!metadataFields.length) {
        const placeholder = document.createElement('p');
        placeholder.textContent = 'No additional information has been recorded. Open the project and select Project Info to add details.';
        more.appendChild(placeholder);
      }
      metadataFields.forEach(([label, value]) => {
        const field = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = label + ': ';
        field.append(strong, document.createTextNode(String(value)));
        more.appendChild(field);
      });
      card.appendChild(more);

      const date = document.createElement('div');
      date.className = 'project-card-date';
      date.textContent = 'Updated ' + new Date(proj.updatedAt || proj.createdAt || Date.now()).toLocaleDateString();
      card.appendChild(date);

      const actions = document.createElement('div');
      actions.className = 'project-card-actions';
      const open = document.createElement('button');
      open.className = 'btn-xs';
      open.type = 'button';
      open.textContent = 'Open Project';
      open.addEventListener('click', () => openProject(proj.id));
      const remove = document.createElement('button');
      remove.className = 'btn-xs danger';
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        if (confirm(`Delete "${proj.name}"? This cannot be undone.`)) {
          await deleteProject(proj.id);
          loadProjectGrid();
        }
      });
      actions.append(open, remove);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load projects:', err);
    grid.innerHTML = '<p class="placeholder">Error loading projects</p>';
  }
}

async function openProject(id) {
  try {
    const proj = await getProject(id);
    if (!proj) return;
    currentProject = proj;
    loadProjectIntoState(proj);
    lastSavedSnapshot = JSON.stringify(proj);
    showDrawPage();
  } catch (err) {
    console.error('Failed to open project:', err);
  }
}

function loadProjectIntoState(proj) {
  resetModel();
  S.project = proj;
  S.nodes = proj.nodes || [];
  S.members = proj.members || [];
  S.slabs = proj.slabs || [];
  S.loads = proj.loads || [];
  S.memberLoads = proj.memberLoads || [];
  S.loadCombinations = proj.loadCombinations || S.loadCombinations;
  S.activeLoadCombination = proj.activeLoadCombination || S.activeLoadCombination;
  S.rigidDiaphragms = proj.rigidDiaphragms !== undefined ? proj.rigidDiaphragms : S.rigidDiaphragms;
  S.nextNodeId = proj.nextNodeId || 1;
  S.nextMemberId = proj.nextMemberId || 1;
  S.nextSlabId = proj.nextSlabId || 1;

  canvas3d.gridLinesX = proj.gridLinesX || [];
  canvas3d.gridLinesY = proj.gridLinesY || [];
  canvas3d.levels = proj.levels || [];

  if (proj.analysisType) byId('analysisType').value = proj.analysisType;
  const comboSelect = byId('loadComboSelect');
  if (comboSelect) comboSelect.value = S.activeLoadCombination;
  const diaphragmToggle = byId('rigidDiaphragmToggle');
  if (diaphragmToggle) diaphragmToggle.checked = S.rigidDiaphragms !== false;
  byId('projectName').textContent = proj.name;
}

function showLandingPage() {
  document.body.classList.remove('workspace-active');
  byId('landingPage').classList.remove('hidden');
  byId('landingPage').classList.add('active');
  byId('setupPage').classList.add('hidden');
  byId('setupPage').classList.remove('active');
  byId('tab-draw').classList.add('hidden');
  byId('tab-draw').classList.remove('active');
  byId('ribbon').style.display = 'none';
  byId('projectBadge').style.display = 'none';
}

function showSetupPage() {
  document.body.classList.remove('workspace-active');
  byId('landingPage').classList.add('hidden');
  byId('landingPage').classList.remove('active');
  byId('setupPage').classList.remove('hidden');
  byId('setupPage').classList.add('active');
  byId('setupPage').scrollTop = 0;
  byId('tab-draw').classList.add('hidden');
  byId('tab-draw').classList.remove('active');
  byId('ribbon').style.display = 'none';
  byId('projectBadge').style.display = 'none';
}

function showDrawPage() {
  document.body.classList.add('workspace-active');
  byId('landingPage').classList.add('hidden');
  byId('landingPage').classList.remove('active');
  byId('setupPage').classList.add('hidden');
  byId('setupPage').classList.remove('active');
  byId('tab-draw').classList.remove('hidden');
  byId('tab-draw').classList.add('active');
  byId('ribbon').style.display = 'block';
  byId('projectBadge').style.display = 'flex';

  byId('projectName').textContent = currentProject.name || 'Untitled Project';
  byId('projectName').title = 'Project Information: ' + (currentProject.name || 'Untitled Project');
  resetCanvasEmptyState();
  updateCanvasEmptyState(byId('canvasEmpty'), S.nodes.length);
  updatePlanLevelSelect();

  if (!drawPageInitialized) {
    initModals(draw);
    initCanvas({ showSupportModal, showLoadModal, showMemberLoadModal, showSlabModal });
    initRibbon();
    initPopups({ onDrawTab: resizeCanvas });
    initModelTree();
    initViewPresets();
    initAnalysis();
    initExports();
    initChat();
    initSections();
    initLoads();
    initHistory();
    initShortcuts();
    initStatusbar();
    initProjectAutosave();
    drawPageInitialized = true;
    }

  // Wait for the browser to lay out the tab (it was display:none, now visible)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      measureRibbon();
      resizeCanvas();
      initCameraPosition();
    });
  });
}

function updatePlanLevelSelect() {
  const sel = byId('planLevelSelect');
  if (!sel) return;
  sel.innerHTML = '';
  canvas3d.levels.forEach(level => {
    const opt = document.createElement('option');
    opt.value = level.elevation;
    opt.textContent = `${level.name} (${level.elevation}m)`;
    sel.appendChild(opt);
  });
  sel.value = canvas3d.currentPlanZ;
  sel.onchange = (e) => {
    canvas3d.currentPlanZ = parseFloat(e.target.value);
    triggerRedraw();
  };
}

function initSetupPage() {
  byId('applyGridXBtn').addEventListener('click', () => applyGridAxis('x'));
  byId('applyGridYBtn').addEventListener('click', () => applyGridAxis('y'));

  byId('addLevelBtn').addEventListener('click', addLevelRow);
  byId('setupBackBtn').addEventListener('click', () => {
    currentProject = null;
    showLandingPage();
    loadProjectGrid();
  });
  byId('setupDoneBtn').addEventListener('click', finishSetup);

  byId('levelsBody').addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove')) {
      const row = e.target.closest('tr');
      if (document.querySelectorAll('#levelsBody tr').length > 1) {
        row.remove();
        updateStoryHeights();
      }
    }
  });

  byId('levelsBody').addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') {
      updateStoryHeights();
    }
  });

  document.querySelectorAll('.grid-quick .btn-xs').forEach(btn => {
    btn.addEventListener('click', () => {
      const axis = btn.dataset.axis;
      const spacings = btn.dataset.grid;
      byId(axis === 'x' ? 'gridXSpacings' : 'gridYSpacings').value = spacings;
      applyGridAxis(axis);
    });
  });

  document.querySelectorAll('.levels-quick .btn-xs').forEach(btn => {
    btn.addEventListener('click', () => {
      const count = parseInt(btn.dataset.levels, 10);
      populateLevels(count);
    });
  });

  byId('projectMenuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = byId('projectMenu');
    menu.classList.toggle('hidden');
    const rect = e.target.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
  });

  document.addEventListener('click', () => {
    byId('projectMenu').classList.add('hidden');
  });

  byId('saveProjectBtn').addEventListener('click', async () => {
    if (!currentProject) return;
    await persistCurrentProject({ force: true });
    byId('canvasStatus').textContent = 'Project saved!';
    setTimeout(updateStatus, 2000);
  });

  byId('editProjectDetailsBtn').addEventListener('click', () => {
    if (currentProject) openProjectDetailsEditor();
  });
  byId('projectInfoBtn').addEventListener('click', () => {
    if (currentProject) openProjectDetailsEditor();
  });
  byId('projectName').addEventListener('click', () => {
    if (currentProject) openProjectDetailsEditor();
  });
  byId('backToProjectsBtn').addEventListener('click', async () => {
    try {
      await persistCurrentProject({force:true});
      showLandingPage();
      loadProjectGrid();
    } catch (error) {
      alert('Project could not be saved: ' + error.message);
    }
  });

  byId('projectEditClose').addEventListener('click', closeProjectDetailsEditor);
  byId('projectEditCancel').addEventListener('click', closeProjectDetailsEditor);
  byId('projectDetailsModal').addEventListener('click', event => {
    if (event.target === byId('projectDetailsModal')) closeProjectDetailsEditor();
  });
  byId('projectEditForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentProject) return;
    const validation = validateProjectDetails(readProjectDetails('edit'));
    if (!validation.valid) {
      byId('projectEditError').textContent = validation.message;
      byId('edit' + validation.field).focus();
      return;
    }
    currentProject.name = validation.details.name;
    currentProject.metadata = validation.details.metadata;
    try {
      await persistCurrentProject({ force: true });
      byId('projectName').textContent = currentProject.name;
      byId('projectName').title = 'Project Information: ' + currentProject.name;
      closeProjectDetailsEditor();
    } catch (error) {
      byId('projectEditError').textContent = 'Could not save project information: ' + error.message;
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !byId('projectDetailsModal').classList.contains('hidden')) {
      closeProjectDetailsEditor();
    }
  });

  byId('deleteProjectBtn').addEventListener('click', async () => {
    if (!currentProject) return;
    if (confirm(`Delete "${currentProject.name}"? This cannot be undone.`)) {
      await deleteProject(currentProject.id);
      currentProject = null;
      showLandingPage();
      loadProjectGrid();
    }
  });
}

function snapshotCurrentProject() {
  if (!currentProject) return null;
  return {
    ...currentProject,
    nodes: [...S.nodes],
    members: [...S.members],
    slabs: [...S.slabs],
    loads: [...S.loads],
    memberLoads: [...S.memberLoads],
    loadCombinations: [...S.loadCombinations],
    activeLoadCombination: S.activeLoadCombination,
    rigidDiaphragms: S.rigidDiaphragms,
    nextNodeId: S.nextNodeId,
    nextMemberId: S.nextMemberId,
    nextSlabId: S.nextSlabId,
    levels: [...canvas3d.levels],
    gridLinesX: [...canvas3d.gridLinesX],
    gridLinesY: [...canvas3d.gridLinesY],
    analysisType: byId('analysisType').value,
  };
}

async function persistCurrentProject({ force = false } = {}) {
  const snapshot = snapshotCurrentProject();
  if (!snapshot) return;
  const serialized = JSON.stringify(snapshot);
  if (!force && serialized === lastSavedSnapshot) return;
  currentProject = snapshot;
  S.project = currentProject;
  await saveProject(currentProject);
  lastSavedSnapshot = JSON.stringify(currentProject);
}

function initProjectAutosave() {
  if (autosaveTimer) return;
  autosaveTimer = window.setInterval(() => {
    persistCurrentProject().catch(error => console.warn('[StructAgent] Project autosave failed:', error));
  }, 2000);
  window.addEventListener('beforeunload', () => {
    persistCurrentProject({ force: true }).catch(() => {});
  });
}

function applyGridAxis(axis) {
  const inputId = axis === 'x' ? 'gridXSpacings' : 'gridYSpacings';
  const previewId = axis === 'x' ? 'gridXPreview' : 'gridYPreview';
  const input = byId(inputId);
  const parsed = parseGridSpacings(input.value);
  input.setAttribute('aria-invalid', String(!parsed.valid));
  const preview = byId(previewId);
  if (!parsed.valid) {
    preview.textContent = parsed.message;
    return false;
  }
  if (axis === 'x') canvas3d.gridLinesX = parsed.positions;
  else canvas3d.gridLinesY = parsed.positions;

  const labels = axis === 'x'
    ? parsed.positions.map((_, i) => String(i + 1))
    : parsed.positions.map((_, i) => `${i + 1}'`);
  preview.replaceChildren();
  labels.forEach((label, index) => {
    const span = document.createElement('span');
    span.className = 'grid-label';
    span.textContent = `${label}: ${parsed.positions[index].toFixed(1)} m`;
    preview.appendChild(span);
  });
  return true;
}

function addLevelRow() {
  const tbody = byId('levelsBody');
  const rows = tbody.querySelectorAll('tr');
  const idx = rows.length;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="Level ${idx}" class="input-sm"/></td>
    <td><input type="number" value="0" step="0.1" class="input-sm"/></td>
    <td>—</td>
    <td><button class="btn-remove">✕</button></td>
  `;
  tbody.appendChild(tr);
  tr.querySelector('.btn-remove').addEventListener('click', () => {
    if (tbody.querySelectorAll('tr').length > 1) {
      tr.remove();
      updateStoryHeights();
    }
  });
  tr.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', updateStoryHeights);
  });
}

function populateLevels(count) {
  const tbody = byId('levelsBody');
  tbody.innerHTML = '';
  const defaultHeight = 3.5;

  const ground = document.createElement('tr');
  ground.innerHTML = `
    <td><input type="text" value="Ground" class="input-sm"/></td>
    <td><input type="number" value="0" step="0.1" class="input-sm"/></td>
    <td>—</td>
    <td><button class="btn-remove">✕</button></td>
  `;
  tbody.appendChild(ground);

  for (let i = 1; i <= count; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="Level ${i}" class="input-sm"/></td>
      <td><input type="number" value="${(i * defaultHeight).toFixed(1)}" step="0.1" class="input-sm"/></td>
      <td>${defaultHeight.toFixed(1)}</td>
      <td><button class="btn-remove">✕</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      if (tbody.querySelectorAll('tr').length > 1) {
        row.remove();
        updateStoryHeights();
      }
    });
  });

  tbody.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', updateStoryHeights);
  });

  updateStoryHeights();
}

function updateStoryHeights() {
  const rows = byId('levelsBody').querySelectorAll('tr');
  rows.forEach((row, i) => {
    const inputs = row.querySelectorAll('input[type="number"]');
    const heightCell = row.querySelectorAll('td')[2];
    if (i === 0) {
      heightCell.textContent = '—';
    } else {
      const prevInputs = rows[i - 1].querySelectorAll('input[type="number"]');
      const prevElev = parseFloat(prevInputs[0].value) || 0;
      const currElev = parseFloat(inputs[0].value) || 0;
      heightCell.textContent = (currElev - prevElev).toFixed(1);
    }
  });
}

function readProjectDetails(prefix) {
  return {
    name: byId(prefix + 'ProjectName').value,
    metadata: {
      projectNumber: byId(prefix + 'ProjectNumber').value,
      client: byId(prefix + 'ProjectClient').value,
      engineer: byId(prefix + 'ProjectEngineer').value,
      location: byId(prefix + 'ProjectLocation').value,
      structureType: byId(prefix + 'ProjectStructureType').value,
      codeBasis: byId(prefix + 'ProjectCodeBasis').value,
      description: byId(prefix + 'ProjectDescription').value,
    },
  };
}

function fillProjectDetails(prefix, project) {
  const data = normalizeProjectDetails(project);
  byId(prefix + 'ProjectName').value = data.name;
  for (const [field, value] of Object.entries(data.metadata)) {
    const domName = field === 'projectNumber'
      ? 'ProjectNumber'
      : 'Project' + field.charAt(0).toUpperCase() + field.slice(1);
    const element = byId(prefix + domName);
    if (element) element.value = value;
  }
}

function resetSetupForm() {
  fillProjectDetails('setup', {name: '', metadata: {}});
  byId('setupError').textContent = '';
  byId('gridXSpacings').value = '6, 6, 6';
  byId('gridYSpacings').value = '7, 7';
  applyGridAxis('x');
  applyGridAxis('y');
  populateLevels(2);
}

function openProjectDetailsEditor() {
  byId('projectEditError').textContent = '';
  fillProjectDetails('edit', currentProject);
  byId('projectDetailsModal').classList.remove('hidden');
  byId('editProjectName').focus();
}

function closeProjectDetailsEditor() {
  byId('projectDetailsModal').classList.add('hidden');
}

function showSetupError(message, element) {
  byId('setupError').textContent = message;
  if (element) element.focus();
}

async function finishSetup() {
  if (!currentProject) return;
  byId('setupError').textContent = '';
  const details = validateProjectDetails(readProjectDetails('setup'));
  if (!details.valid) {
    showSetupError(details.message, byId('setup' + details.field));
    return;
  }

  const x = parseGridSpacings(byId('gridXSpacings').value);
  const y = parseGridSpacings(byId('gridYSpacings').value);
  if (!x.valid || !y.valid) {
    showSetupError('Invalid grid spacing: ' + (!x.valid ? x.message : y.message),
      byId(!x.valid ? 'gridXSpacings' : 'gridYSpacings'));
    return;
  }

  const levels = [...byId('levelsBody').querySelectorAll('tr')].map(row => {
    const name = row.querySelector('input[type="text"]').value.trim();
    const raw = row.querySelector('input[type="number"]').value.trim();
    return {name, elevation: raw === '' ? NaN : Number(raw)};
  });
  const checked = validateStoryLevels(levels);
  if (!checked.valid) {
    showSetupError(checked.message, byId('levelsTable'));
    byId('levelsTable').scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }

  const button = byId('setupDoneBtn');
  button.disabled = true;
  button.textContent = 'Creating Project...';
  currentProject.name = details.details.name;
  currentProject.metadata = details.details.metadata;
  currentProject.levels = levels;
  currentProject.gridLinesX = x.positions;
  currentProject.gridLinesY = y.positions;
  canvas3d.levels = levels;
  canvas3d.gridLinesX = x.positions;
  canvas3d.gridLinesY = y.positions;
  try {
    await saveProject(currentProject);
    lastSavedSnapshot = JSON.stringify(currentProject);
    loadProjectIntoState(currentProject);
    showDrawPage();
  } catch (error) {
    showSetupError('Could not create the project: ' + error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Create Project & Start Drawing';
  }
}
