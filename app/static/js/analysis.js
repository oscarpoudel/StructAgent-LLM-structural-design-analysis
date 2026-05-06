import { analyzeStructure } from './api.js';
import { byId } from './dom.js';
import { draw, fitModelToCanvas } from './canvas3d/index.js';
import { showProp } from './canvas3d/render.js';
import { renderResults } from './results.js';
import { resetModel, S } from './state.js';

export function initAnalysis() {
  byId('runBtn').addEventListener('click', runAnalysis);
  byId('clearBtn').addEventListener('click', () => clearCurrentModel({ confirmFirst: true }));
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
  const statusEl = byId('canvasStatus');
  button.textContent = 'Analyzing...';
  button.disabled = true;
  if (statusEl) statusEl.textContent = 'Running analysis...';

  const payload = buildCurrentAnalysisPayload();
  console.log('[StructAgent] Analysis payload:', JSON.stringify(payload, null, 2));

  try {
    const data = await analyzeStructure(payload);
    console.log('[StructAgent] Analysis response:', data);

    if (data.status === 'ok') {
      S.results = data.results;
      byId('showDeformed').checked = true;
      byId('showForces').checked = true;
      renderResults(data);
      draw();
      if (statusEl) statusEl.textContent = `Analysis complete: ${data.analysis_type} (${data.results.solver || 'unknown'})`;
    } else {
      const errMsg = data.message || JSON.stringify(data.errors || data);
      console.error('[StructAgent] Analysis failed:', errMsg);
      alert(`Analysis error: ${errMsg}`);
      if (statusEl) statusEl.textContent = 'Analysis failed — check console for details';
    }
  } catch (error) {
    console.error('[StructAgent] Network error during analysis:', error);
    alert(`Network error: ${error.message}. Is the server running?`);
    if (statusEl) statusEl.textContent = 'Network error — is server running?';
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
    return {
      nodes: S.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        z: node.z || 0,
        support: node.support === 'roller'
          ? { ux: false, uy: false, uz: false, rx: false, ry: false, rz: true }
          : node.support === 'free'
            ? null
            : { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true }
      })),
      members: S.members.map((member) => ({
        id: member.id,
        start_node: member.n1,
        end_node: member.n2,
        area_m2: member.A,
        iy_m4: member.Iy || member.I || 1e-4,
        iz_m4: member.Iz || member.I || 1e-4,
        j_m4: (member.I || 1e-4) * 0.1,
        elastic_modulus_gpa: member.E,
        shear_modulus_gpa: member.E / (2 * (1 + 0.3))
      })),
      nodal_loads: S.loads.map((load) => ({
        node_id: load.nodeId,
        fx_kn: load.fx,
        fy_kn: load.fy,
        fz_kn: load.fz || 0,
        mx_kn_m: 0,
        my_kn_m: 0,
        mz_kn_m: load.moment || 0
      })),
      member_loads: S.memberLoads.map((memberLoad) => ({
        member_id: memberLoad.memberId,
        wy_kn_per_m: memberLoad.udl,
        wz_kn_per_m: 0
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

export function exportModelJson() {
  const modelData = {
    version: 1,
    nodes: S.nodes,
    members: S.members,
    loads: S.loads,
    memberLoads: S.memberLoads,
    analysisType: byId('analysisType').value,
    levels: {
      numLevels: byId('numLevels')?.value || 4,
      levelHeight: byId('levelHeight')?.value || 3.0
    }
  };
  try {
    const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `struct_model_${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    console.info('[StructAgent] Model exported successfully');
  } catch (err) {
    console.error('[StructAgent] Export failed:', err);
    alert('Export failed: ' + err.message);
  }
}

export function importModelJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const modelData = JSON.parse(event.target.result);
      if (!modelData.nodes || !Array.isArray(modelData.nodes)) {
        throw new Error('Invalid model format: missing nodes array');
      }
      clearCurrentModel({ confirmFirst: false });
      S.nodes = modelData.nodes || [];
      S.members = modelData.members || [];
      S.loads = modelData.loads || [];
      S.memberLoads = modelData.memberLoads || [];
      if (modelData.analysisType) byId('analysisType').value = modelData.analysisType;
      if (modelData.levels) {
        const numEl = byId('numLevels');
        const hEl = byId('levelHeight');
        if (numEl) numEl.value = modelData.levels.numLevels;
        if (hEl) hEl.value = modelData.levels.levelHeight;
      }
      S.nextNodeId = S.nodes.length ? Math.max(...S.nodes.map(n => n.id)) + 1 : 1;
      S.nextMemberId = S.members.length ? Math.max(...S.members.map(m => m.id)) + 1 : 1;
      fitModelToCanvas();
      showProp();
      draw();
      console.info('[StructAgent] Model imported successfully');
    } catch (err) {
      console.error('[StructAgent] Import failed:', err);
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}
