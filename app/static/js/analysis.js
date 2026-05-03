import { analyzeStructure } from './api.js';
import { byId } from './dom.js';
import { draw, fitModelToCanvas } from './canvas3d/index.js';
import { showProp } from './canvas3d/render.js';
import { renderResults } from './results.js';
import { resetModel, S } from './state.js';

export function initAnalysis() {
  byId('runBtn').addEventListener('click', runAnalysis);
  byId('clearBtn').addEventListener('click', () => clearCurrentModel({ confirmFirst: true }));
  byId('saveBtn').addEventListener('click', () => saveNamedModel());
  byId('loadBtn').addEventListener('click', loadCurrentModel);
  byId('manageModelsBtn').addEventListener('click', showModelManager);
  byId('exportJsonBtn').addEventListener('click', exportModelJson);
  byId('importJsonBtn').addEventListener('click', () => byId('importJsonFile').click());
  byId('importJsonFile').addEventListener('change', importModelJson);
  window.StructAgentDebug = {
    getState: () => JSON.parse(JSON.stringify(S)),
    drawSimpleBeam,
    clearCurrentModel,
    buildCurrentAnalysisPayload,
  };
}

async function runAnalysis() {
  if (S.nodes.length < 2 || S.members.length < 1) {
    alert('Draw at least 2 nodes and 1 member.');
    return;
  }

  const button = byId('runBtn');
  button.textContent = 'Analyzing...';
  button.disabled = true;

  try {
    const data = await analyzeStructure(buildCurrentAnalysisPayload());
    if (data.status === 'ok') {
      S.results = data.results;
      byId('showDeformed').checked = true;
      byId('showForces').checked = true;
      renderResults(data);
      draw();
    } else {
      alert(`Analysis error: ${data.message || JSON.stringify(data.errors || data)}`);
    }
  } catch (error) {
    alert(`Network error: ${error.message}`);
  }

  button.textContent = '\u25B6 Analyze';
  button.disabled = false;
}

export function buildCurrentAnalysisPayload() {
  const analysisType = byId('analysisType').value;
  return { analysis_type: analysisType, model: buildModel(analysisType) };
}

function buildModel(analysisType) {
  if (analysisType === 'truss') {
    return {
      nodes: S.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, support: node.support === 'roller' ? 'roller_x' : node.support })),
      members: S.members.map((member) => ({ id: member.id, start_node: member.n1, end_node: member.n2, area_m2: member.A, elastic_modulus_gpa: member.E })),
      loads: S.loads.map((load) => ({ node_id: load.nodeId, fx_kn: load.fx, fy_kn: load.fy })),
    };
  }

  if (analysisType === '3d_frame') {
    // For 3D structures, we still use the 2D canvas but add z-coordinates
    return {
      nodes: S.nodes.map((node) => ({ 
        id: node.id, 
        x: node.x, 
        y: node.y, 
        z: 0, // Default to 0 for 2D canvas
        support: node.support === 'roller' ? { ux: false, uy: false, uz: false, rx: false, ry: false, rz: true } : 
                node.support === 'free' ? null : { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true }
      })),
      members: S.members.map((member) => ({ 
        id: member.id, 
        start_node: member.n1, 
        end_node: member.n2, 
        area_m2: member.A, 
        iy_m4: member.I, // Use I as iy_m4 since we don't have Iz in 2D
        iz_m4: member.I, // Use I as iz_m4
        j_m4: member.I * 0.1, // Approximate torsional constant
        elastic_modulus_gpa: member.E,
        shear_modulus_gpa: member.E / (2 * (1 + 0.3)) // Assuming Poisson's ratio = 0.3
      })),
      nodal_loads: S.loads.map((load) => ({ 
        node_id: load.nodeId, 
        fx_kn: load.fx, 
        fy_kn: load.fy, 
        fz_kn: 0, // No z-load in 2D
        mx_kn_m: 0, // No moment in 2D
        my_kn_m: 0, // No moment in 2D
        mz_kn_m: load.moment || 0 
      })),
      member_loads: S.memberLoads.map((memberLoad) => ({ 
        member_id: memberLoad.memberId, 
        wy_kn_per_m: memberLoad.udl,
        wz_kn_per_m: 0 // No lateral load in 2D
      })),
    };
  }

  return {
    nodes: S.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, support: node.support === 'roller' ? 'roller' : node.support })),
    members: S.members.map((member) => ({ id: member.id, start_node: member.n1, end_node: member.n2, area_m2: member.A, inertia_m4: member.I, elastic_modulus_gpa: member.E })),
    nodal_loads: S.loads.map((load) => ({ node_id: load.nodeId, fx_kn: load.fx, fy_kn: load.fy, moment_kn_m: load.moment || 0 })),
    member_loads: S.memberLoads.map((memberLoad) => ({ member_id: memberLoad.memberId, udl_kn_per_m: memberLoad.udl })),
  };
}

export function clearCurrentModel({ confirmFirst = false } = {}) {
  if (confirmFirst && !confirm('Clear the entire model?')) return false;
  resetModel();
  byId('showDeformed').checked = false;
  byId('showForces').checked = false;
  byId('rpContent').innerHTML = '<p class="placeholder">Draw a structure and run analysis.</p>';
  showProp();
  draw();
  
  // Reset analysis type to default
  byId('analysisType').value = 'frame';
  
  return true;
}

export function drawSimpleBeam(args = {}) {
  const span = Number(args.span_m) > 0 ? Number(args.span_m) : 2;
  const pointLoads = Array.isArray(args.point_loads) ? args.point_loads : [];
  const internalLoadPositions = [...new Set(pointLoads
    .map((load) => Number(load.position_m))
    .filter((position) => position > 0 && position < span)
    .map((position) => Number(position.toFixed(6))))].sort((a, b) => a - b);

  resetModel();
  const stations = [0, ...internalLoadPositions, span];
  stations.forEach((x, index) => {
    S.nodes.push({
      id: index + 1,
      x,
      y: 1,
      support: index === 0 ? 'pin' : index === stations.length - 1 ? 'roller' : 'free',
    });
  });

  for (let index = 0; index < S.nodes.length - 1; index += 1) {
    S.members.push({ id: index + 1, n1: S.nodes[index].id, n2: S.nodes[index + 1].id, A: 0.01, I: 1e-4, E: 200 });
  }

  pointLoads.forEach((load) => {
    const magnitude = Math.abs(Number(load.magnitude_kn) || 0);
    const position = Number(load.position_m);
    if (!magnitude || !Number.isFinite(position)) return;
    const node = S.nodes.find((item) => Math.abs(item.x - position) < 1e-6);
    if (node) S.loads.push({ nodeId: node.id, fx: 0, fy: -magnitude, moment: 0 });
  });

  const udl = Number(args.udl_kn_per_m) || 0;
  if (udl) {
    S.memberLoads = S.members.map((member) => ({ memberId: member.id, udl }));
  }

  S.nextNodeId = S.nodes.length + 1;
  S.nextMemberId = S.members.length + 1;
  // Set to 3D mode if that's what was selected
  const selectedType = byId('analysisType').value;
  if (selectedType === '3d_frame') {
    byId('analysisType').value = '3d_frame';
  } else {
    byId('analysisType').value = 'frame';
  }
  byId('showDeformed').checked = false;
  byId('showForces').checked = false;
  byId('rpContent').innerHTML = `
    <div class="rp-metrics">
      <div class="rp-metric"><span>Tool</span><strong>draw_simple_beam</strong></div>
      <div class="rp-metric"><span>Nodes</span><strong>${S.nodes.length}</strong></div>
      <div class="rp-metric"><span>Members</span><strong>${S.members.length}</strong></div>
      <div class="rp-metric"><span>Loads</span><strong>${S.loads.length + S.memberLoads.length}</strong></div>
    </div>
    <p class="placeholder">Beam drawn. Run analysis to see results.</p>`;
  showProp();
  fitModelToCanvas();
  console.info('[StructAgent] draw_simple_beam executed', {
    args,
    nodes: S.nodes,
    members: S.members,
    loads: S.loads,
    memberLoads: S.memberLoads,
    zoom: S.zoom,
    pan: S.pan,
  });
}

/**
 * Show model management modal
 */
export function showModelManager() {
  // Create modal if it doesn't exist
  let modal = byId('modelManagerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modelManagerModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h3>Model Manager</h3>
        <div class="modal-opts" id="modelList">
          <!-- Models will be listed here -->
        </div>
        <div class="modal-foot">
          <button class="btn-xs" onclick="byId('modelManagerModal').classList.add('hidden')">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Populate model list
  populateModelList();
  
  // Show modal
  modal.classList.remove('hidden');
}

/**
 * Populate the model list in the manager
 */
function populateModelList() {
  const modelList = byId('modelList');
  if (!modelList) return;
  
  // Get all saved models
  const models = getAllSavedModels();
  
  if (models.length === 0) {
    modelList.innerHTML = '<p class="placeholder">No saved models found.</p>';
    return;
  }
  
  modelList.innerHTML = '';
  
  models.forEach((model, index) => {
    const modelItem = document.createElement('div');
    modelItem.className = 'modal-opt';
    modelItem.innerHTML = `
      <div>
        <div><strong>${model.name || `Model ${index + 1}`}</strong></div>
        <div style="font-size:0.75rem;color:var(--text3);">${new Date(model.timestamp).toLocaleString()}</div>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="btn-xs" onclick="loadNamedModel('${model.key}')">Load</button>
        <button class="btn-xs" onclick="deleteNamedModel('${model.key}')">Delete</button>
      </div>
    `;
    modelList.appendChild(modelItem);
  });
}

/**
 * Get all saved models from localStorage
 */
function getAllSavedModels() {
  const models = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('structAgentModel_')) {
      try {
        const modelData = JSON.parse(localStorage.getItem(key));
        models.push({
          key: key,
          name: modelData.name || key.replace('structAgentModel_', ''),
          timestamp: modelData.timestamp,
          analysisType: modelData.analysisType
        });
      } catch (e) {
        console.warn('Could not parse model data for key:', key);
      }
    }
  }
  // Sort by timestamp (newest first)
  return models.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Save current model with a name
 */
export function saveNamedModel(name = null) {
  try {
    const modelName = name || prompt('Enter a name for this model:');
    if (!modelName) return;
    
    const modelData = {
      nodes: S.nodes,
      members: S.members,
      loads: S.loads,
      memberLoads: S.memberLoads,
      analysisType: byId('analysisType').value,
      name: modelName,
      timestamp: new Date().toISOString()
    };
    
    const key = `structAgentModel_${modelName.replace(/\s+/g, '_')}`;
    const serializedData = JSON.stringify(modelData);
    localStorage.setItem(key, serializedData);
    
    // Show success notification
    const saveBtn = byId('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.textContent = originalText;
    }, 2000);
    
    console.info('[StructAgent] Named model saved successfully:', modelName);
    
    // Refresh model list if manager is open
    const modal = byId('modelManagerModal');
    if (modal && !modal.classList.contains('hidden')) {
      populateModelList();
    }
  } catch (error) {
    console.error('[StructAgent] Error saving named model:', error);
    alert('Failed to save model: ' + error.message);
  }
}

/**
 * Load a named model
 */
export function loadNamedModel(key) {
  try {
    const serializedData = localStorage.getItem(key);
    if (!serializedData) {
      alert('Model not found.');
      return;
    }
    
    const modelData = JSON.parse(serializedData);
    
    // Confirm before loading
    if (!confirm(`Load model "${modelData.name}"? This will replace your current work.`)) {
      return;
    }
    
    // Clear current model
    clearCurrentModel({ confirmFirst: false });
    
    // Restore model data
    S.nodes = modelData.nodes || [];
    S.members = modelData.members || [];
    S.loads = modelData.loads || [];
    S.memberLoads = modelData.memberLoads || [];
    
    // Set analysis type
    if (modelData.analysisType) {
      byId('analysisType').value = modelData.analysisType;
    }
    
    // Redraw and update UI
    fitModelToCanvas();
    showProp();
    draw();
    
    // Close modal if open
    const modal = byId('modelManagerModal');
    if (modal) {
      modal.classList.add('hidden');
    }
    
    // Show success notification
    const loadBtn = byId('loadBtn');
    const originalText = loadBtn.textContent;
    loadBtn.textContent = 'Loaded!';
    setTimeout(() => {
      loadBtn.textContent = originalText;
    }, 2000);
    
    console.info('[StructAgent] Named model loaded successfully:', modelData.name);
  } catch (error) {
    console.error('[StructAgent] Error loading named model:', error);
    alert('Failed to load model: ' + error.message);
  }
}

/**
 * Delete a named model
 */
export function deleteNamedModel(key) {
  if (!confirm('Are you sure you want to delete this model?')) {
    return;
  }
  
  try {
    localStorage.removeItem(key);
    
    // Refresh model list
    const modal = byId('modelManagerModal');
    if (modal && !modal.classList.contains('hidden')) {
      populateModelList();
    }
    
    console.info('[StructAgent] Model deleted successfully:', key);
  } catch (error) {
    console.error('[StructAgent] Error deleting model:', error);
    alert('Failed to delete model: ' + error.message);
  }
}

/**
 * Save current model to localStorage (legacy function, now redirects to named save)
 */
export function saveCurrentModel() {
  // For backward compatibility, we'll save with a prompt for name
  saveNamedModel();
}

export function exportModelJson() {
  const modelData = {
    nodes: S.nodes,
    members: S.members,
    loads: S.loads,
    memberLoads: S.memberLoads,
    analysisType: byId('analysisType').value
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(modelData, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', 'struct_model.json');
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function importModelJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const modelData = JSON.parse(event.target.result);
      S.nodes = modelData.nodes || [];
      S.members = modelData.members || [];
      S.loads = modelData.loads || [];
      S.memberLoads = modelData.memberLoads || [];
      if (modelData.analysisType) byId('analysisType').value = modelData.analysisType;
      fitModelToCanvas();
      showProp();
      draw();
    } catch (err) {
      alert('Invalid JSON file');
    }
    e.target.value = ''; // reset
  };
  reader.readAsText(file);
}

