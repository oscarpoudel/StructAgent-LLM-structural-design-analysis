import { byId, $$ } from '../dom.js';
import { S } from '../state.js';
import { canvas3d } from './scene.js';
import { draw } from './render.js';

export function initUI() {
  injectDynamicToolbar();
  initToolButtons();
  initGridAndLevels();
  initDisplayToggles();
  updateStatus();
}

function injectDynamicToolbar() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || byId('applyGridBtn')) return;
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

  const gridCountInp = byId('gridCount');
  const gridSpacingInp = byId('gridSpacing');
  const applyGridBtn = byId('applyGridBtn');

  const planBtn = byId('viewPlanBtn');
  const elevBtn = byId('viewElevBtn');
  const btn3D = byId('view3DBtn');

  const elevRotationBtns = byId('elevRotationBtns');
  const elevFrontBtn = byId('elevFrontBtn');
  const elevRightBtn = byId('elevRightBtn');
  const elevBackBtn = byId('elevBackBtn');
  const elevLeftBtn = byId('elevLeftBtn');

  levelSel.innerHTML = '<option value="0" disabled selected>Set levels first</option>';

  applyLevelsBtn.addEventListener('click', () => {
    const num = parseInt(numLevelsInp.value, 10);
    const h = parseFloat(levelHeightInp.value);
    canvas3d.levels = [];
    levelSel.innerHTML = '';
    for (let i = 0; i < num; i++) {
      const z = i * h;
      canvas3d.levels.push({ index: i, z });
      const opt = document.createElement('option');
      opt.value = z;
      opt.textContent = `Level ${i} (${z}m)`;
      levelSel.appendChild(opt);
    }
    levelSel.value = canvas3d.currentZ;
    rebuildGhostGrids();
  });

  levelSel.addEventListener('change', (e) => {
    const z = parseFloat(e.target.value);
    canvas3d.currentZ = z;
    if (canvas3d.viewMode === 'plan') {
      updatePlanCamera();
    }
    rebuildGhostGrids();
  });

  applyGridBtn.addEventListener('click', () => {
    const count = parseInt(gridCountInp.value, 10);
    const spacing = parseFloat(gridSpacingInp.value);
    const size = count * spacing;

    canvas3d.gridSpacing = spacing;
    canvas3d.gridCount = count;
    canvas3d.gridSizes.plan = size;
    canvas3d.gridSizes.elev = size;

    if (canvas3d.gridHelper) canvas3d.scene.remove(canvas3d.gridHelper);

    canvas3d.gridHelper = new THREE.GridHelper(size, count, 0x888888, 0x444444);
    canvas3d.scene.add(canvas3d.gridHelper);
    canvas3d.groundPlane.geometry.dispose();
    canvas3d.groundPlane.geometry = new THREE.PlaneGeometry(size, size);

    rebuildGhostGrids();
    positionDrawingPlane();
    draw();
  });

  // View mode buttons
  const viewBtns = [planBtn, elevBtn, btn3D];
  viewBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', () => setViewMode(btn.id));
  });

  // Elevation rotation buttons
  const rotBtns = [elevFrontBtn, elevRightBtn, elevBackBtn, elevLeftBtn];
  const rotMap = {
    elevFrontBtn: 0,
    elevRightBtn: 1,
    elevBackBtn: 2,
    elevLeftBtn: 3
  };
  rotBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
      rotBtns.forEach(b => b && b.classList.remove('active'));
      btn.classList.add('active');
      canvas3d.elevAngle = rotMap[btn.id];
      if (canvas3d.viewMode === 'elevation') {
        updateElevationCamera();
        positionDrawingPlane();
      }
    });
  });

  function setViewMode(btnId) {
    viewBtns.forEach(b => b && b.classList.remove('active'));
    const btn = byId(btnId);
    if (btn) btn.classList.add('active');

    if (btnId === 'viewPlanBtn') {
      canvas3d.viewMode = 'plan';
      canvas3d.controls.enableRotate = false;
      updatePlanCamera();
    } else if (btnId === 'viewElevBtn') {
      canvas3d.viewMode = 'elevation';
      canvas3d.controls.enableRotate = false;
      updateElevationCamera();
    } else {
      canvas3d.viewMode = '3d';
      canvas3d.controls.enableRotate = true;
      update3DCamera();
    }
    positionDrawingPlane();
    rebuildGhostGrids();
    canvas3d.controls.update();
    updateElevBtnsVisibility();
  }

  function updatePlanCamera() {
    canvas3d.camera.up.set(0, 1, 0);
    canvas3d.camera.position.set(0, 0, canvas3d.currentZ + 40);
    canvas3d.camera.lookAt(0, 0, canvas3d.currentZ);
    canvas3d.controls.target.set(0, 0, canvas3d.currentZ);
  }

  function updateElevationCamera() {
    const dist = 40;
    const angle = canvas3d.elevAngle;
    const midZ = canvas3d.levels.length > 1
      ? (canvas3d.levels[0].z + canvas3d.levels[canvas3d.levels.length - 1].z) / 2
      : canvas3d.currentZ;

    if (angle === 0) {
      // Front: looking from -Y toward +Y
      canvas3d.camera.up.set(0, 0, 1);
      canvas3d.camera.position.set(0, -dist, midZ);
      canvas3d.camera.lookAt(0, 0, midZ);
      canvas3d.controls.target.set(0, 0, midZ);
    } else if (angle === 1) {
      // Right: looking from +X toward -X
      canvas3d.camera.up.set(0, 0, 1);
      canvas3d.camera.position.set(dist, 0, midZ);
      canvas3d.camera.lookAt(0, 0, midZ);
      canvas3d.controls.target.set(0, 0, midZ);
    } else if (angle === 2) {
      // Back: looking from +Y toward -Y
      canvas3d.camera.up.set(0, 0, 1);
      canvas3d.camera.position.set(0, dist, midZ);
      canvas3d.camera.lookAt(0, 0, midZ);
      canvas3d.controls.target.set(0, 0, midZ);
    } else {
      // Left: looking from -X toward +X
      canvas3d.camera.up.set(0, 0, 1);
      canvas3d.camera.position.set(-dist, 0, midZ);
      canvas3d.camera.lookAt(0, 0, midZ);
      canvas3d.controls.target.set(0, 0, midZ);
    }
  }

  function update3DCamera() {
    canvas3d.camera.up.set(0, 0, 1);
    canvas3d.camera.position.set(-20, -20, 15);
    canvas3d.camera.lookAt(0, 0, canvas3d.currentZ);
    canvas3d.controls.target.set(0, 0, canvas3d.currentZ);
  }

  function positionDrawingPlane() {
    const mode = canvas3d.viewMode;
    if (!canvas3d.gridHelper || !canvas3d.groundPlane) return;

    if (mode === 'plan') {
      canvas3d.gridHelper.rotation.set(0, 0, 0);
      canvas3d.gridHelper.position.set(0, 0, canvas3d.currentZ);
      canvas3d.gridHelper.visible = true;
      canvas3d.groundPlane.rotation.set(0, 0, 0);
      canvas3d.groundPlane.position.set(0, 0, canvas3d.currentZ);
    } else if (mode === 'elevation') {
      canvas3d.gridHelper.rotation.set(Math.PI / 2, 0, 0);
      canvas3d.gridHelper.position.set(0, 0, canvas3d.currentZ);
      canvas3d.gridHelper.visible = true;
      canvas3d.groundPlane.rotation.set(-Math.PI / 2, 0, 0);
      canvas3d.groundPlane.position.set(0, 0, canvas3d.currentZ);
    } else {
      canvas3d.gridHelper.rotation.set(Math.PI / 2, 0, 0);
      canvas3d.gridHelper.position.set(0, 0, canvas3d.currentZ);
      canvas3d.gridHelper.visible = true;
      canvas3d.groundPlane.rotation.set(-Math.PI / 2, 0, 0);
      canvas3d.groundPlane.position.set(0, 0, canvas3d.currentZ);
    }
  }

  function rebuildGhostGrids() {
    // Clear existing ghost grids
    while (canvas3d.ghostGridsGroup.children.length > 0) {
      const c = canvas3d.ghostGridsGroup.children[0];
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
      canvas3d.ghostGridsGroup.remove(c);
    }
    while (canvas3d.ghostElevGridsGroup.children.length > 0) {
      const c = canvas3d.ghostElevGridsGroup.children[0];
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
      canvas3d.ghostElevGridsGroup.remove(c);
    }

    if (!canvas3d.gridHelper || canvas3d.viewMode !== '3d') return;

    const size = canvas3d.gridSizes.plan || (canvas3d.gridCount * canvas3d.gridSpacing);
    const count = canvas3d.gridCount;
    const ghostMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.25 });

    // Ghost plan grids at each level (except current)
    canvas3d.levels.forEach((level) => {
      if (Math.abs(level.z - canvas3d.currentZ) < 0.01) return;
      const grid = new THREE.GridHelper(size, count, 0x888888, 0x555555);
      grid.material = ghostMat.clone();
      grid.rotation.set(0, 0, 0);
      grid.position.set(0, 0, level.z);
      canvas3d.ghostGridsGroup.add(grid);
    });

    // Ghost elevation grids at each Y face (back, left, right)
    const elevSize = canvas3d.gridSizes.elev || size;
    canvas3d.levels.forEach((level) => {
      if (Math.abs(level.z - canvas3d.currentZ) < 0.01) return;
      const elevGrid = new THREE.GridHelper(elevSize, count, 0x888888, 0x555555);
      elevGrid.material = ghostMat.clone();
      elevGrid.rotation.set(Math.PI / 2, 0, 0);
      elevGrid.position.set(0, 0, level.z);
      canvas3d.ghostElevGridsGroup.add(elevGrid);
    });
  }

  function updateElevBtnsVisibility() {
    if (elevRotationBtns) {
      elevRotationBtns.style.display = canvas3d.viewMode === 'elevation' ? 'flex' : 'none';
    }
  }

  updateElevBtnsVisibility();
  setTimeout(() => {
    positionDrawingPlane();
    rebuildGhostGrids();
  }, 100);
}

function initDisplayToggles() {
  ['showGrid', 'showLabels', 'showDeformed', 'showForces'].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener('change', draw);
  });
  const deformScale = byId('deformScale');
  if (deformScale) deformScale.addEventListener('input', draw);
}

export function updateStatus() {
  const el = byId('canvasStatus');
  if (!el) return;
  const viewLabel = canvas3d.viewMode === 'plan'
    ? `Plan (XY) Z=${canvas3d.currentZ}m`
    : canvas3d.viewMode === 'elevation'
      ? `Elevation (XZ) ${['Front', 'Right', 'Back', 'Left'][canvas3d.elevAngle]}`
      : '3D Perspective';
  const messages = {
    select: `Click to select. Drag to orbit. [${viewLabel}]`,
    node: canvas3d.viewMode === 'elevation'
      ? `Click grid to place node at elevation (X, Z=height). [${viewLabel}]`
      : `Click grid to place node at Z=${canvas3d.currentZ}m. [${viewLabel}]`,
    member: S.memberStart
      ? `Click second node to finish member (from ${S.memberStart}).`
      : 'Click first node to start a member.',
    support: 'Click a node to set its support type.',
    load: 'Click a node or member to apply a load.',
    delete: 'Click a node or member to delete it.',
  };
  el.textContent = messages[S.tool] || 'Ready';
}
