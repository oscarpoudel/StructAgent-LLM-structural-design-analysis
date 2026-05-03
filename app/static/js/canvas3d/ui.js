import { byId, $$ } from '../dom.js';
import { S } from '../state.js';
import { canvas3d } from './scene.js';
import { draw } from './render.js';

export function initUI() {
  // Add tools UI elements if missing (for Levels/Grid)
  injectDynamicToolbar();

  initToolButtons();
  initGridAndLevels();
  initDisplayToggles();
  updateStatus();
}

function injectDynamicToolbar() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || byId('applyGridBtn')) return;
  // Make sure we have the dynamic inputs
  // We'll replace the old HTML structure here if needed, but assuming HTML is updated
}

function initToolButtons() {
  $$('.tool-btn').forEach((button) => {
    button.addEventListener('click', () => {
      $$('.tool-btn').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      S.tool = button.dataset.tool;
      S.memberStart = null;
      canvas3d.canvas.style.cursor = S.tool === 'select' ? 'default' : 'crosshair';
      updateStatus();
    });
  });
}

function initGridAndLevels() {
  const numLevelsInp = byId('numLevels');
  const levelHeightInp = byId('levelHeight');
  const applyLevelsBtn = byId('applyLevelsBtn');
  const levelSel = byId('levelSelect');
  const viewBtn = byId('viewToggleBtn');
  
  const gridCountInp = byId('gridCount');
  const gridSpacingInp = byId('gridSpacing');
  const applyGridBtn = byId('applyGridBtn');

  // Clear initially
  levelSel.innerHTML = '<option value="0" disabled selected>Set levels first</option>';

  applyLevelsBtn.addEventListener('click', () => {
    const num = parseInt(numLevelsInp.value, 10);
    const h = parseFloat(levelHeightInp.value);
    levelSel.innerHTML = '';
    for(let i=0; i<num; i++) {
      const z = i * h;
      const opt = document.createElement('option');
      opt.value = z;
      opt.textContent = `Level ${i} (${z}m)`;
      levelSel.appendChild(opt);
    }
    levelSel.dispatchEvent(new Event('change'));
  });

  levelSel.addEventListener('change', (e) => {
    const z = parseFloat(e.target.value);
    canvas3d.currentZ = z;
    canvas3d.groundPlane.position.z = z;
    if (canvas3d.gridHelper) canvas3d.gridHelper.position.z = z;
    
    if (canvas3d.is2D) {
      canvas3d.camera.position.set(0, 0, z + 20);
      canvas3d.controls.target.set(0, 0, z);
      canvas3d.camera.up.set(0, 1, 0); 
      canvas3d.controls.update();
    }
  });

  applyGridBtn.addEventListener('click', () => {
    const count = parseInt(gridCountInp.value, 10);
    const spacing = parseFloat(gridSpacingInp.value);
    const size = count * spacing;
    
    canvas3d.gridSpacing = spacing;
    canvas3d.gridCount = count;

    if (canvas3d.gridHelper) canvas3d.scene.remove(canvas3d.gridHelper);
    
    canvas3d.gridHelper = new THREE.GridHelper(size, count, 0x888888, 0x444444);
    canvas3d.gridHelper.rotation.x = Math.PI / 2;
    canvas3d.gridHelper.position.z = canvas3d.currentZ;
    canvas3d.scene.add(canvas3d.gridHelper);
    
    canvas3d.groundPlane.geometry.dispose();
    canvas3d.groundPlane.geometry = new THREE.PlaneGeometry(size, size);
    
    draw();
  });

  viewBtn.addEventListener('click', () => {
    canvas3d.is2D = !canvas3d.is2D;
    viewBtn.textContent = canvas3d.is2D ? '2D View' : '3D View';
    const z = canvas3d.currentZ;
    
    if (canvas3d.is2D) {
      canvas3d.camera.position.set(0, 0, z + 50);
      canvas3d.controls.target.set(0, 0, z);
      canvas3d.controls.enableRotate = false;
      canvas3d.camera.up.set(0, 1, 0); 
    } else {
      canvas3d.camera.position.set(0, -20, z + 20);
      canvas3d.controls.target.set(0, 0, z);
      canvas3d.controls.enableRotate = true;
      canvas3d.camera.up.set(0, 0, 1);
    }
    canvas3d.controls.update();
  });
}

function initDisplayToggles() {
  ['showGrid', 'showLabels', 'showDeformed', 'showForces'].forEach((id) => {
    const el = byId(id);
    if(el) el.addEventListener('change', draw);
  });
  const deformScale = byId('deformScale');
  if (deformScale) deformScale.addEventListener('input', draw);
}

export function updateStatus() {
  const el = byId('canvasStatus');
  if(!el) return;
  const messages = {
    select: 'Click a node or member to select. Drag to orbit.',
    node: `Click on grid intersections to place a node at Z=${canvas3d.currentZ}m.`,
    member: S.memberStart ? `Click a second node to finish member (from node ${S.memberStart}).` : 'Click first node to start a member.',
    support: 'Click a node to set its support type.',
    load: 'Click a node or member to apply a load.',
    delete: 'Click a node or member to delete it.',
  };
  el.textContent = messages[S.tool] || 'Ready';
}
