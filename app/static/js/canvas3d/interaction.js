import { S } from '../state.js';
import { canvas3d, triggerRedraw } from './scene.js';
import { showProp } from './render.js';
import { updateStatus } from './ui.js';

let raycaster;
let mouse;
let showSupportModalCb;
let showLoadModalCb;
let showMemberLoadModalCb;
let showSlabModalCb;

export function initInteraction(modals) {
  showSupportModalCb = modals.showSupportModal;
  showLoadModalCb = modals.showLoadModal;
  showMemberLoadModalCb = modals.showMemberLoadModal;
  showSlabModalCb = modals.showSlabModal;

  raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.5;
  mouse = new THREE.Vector2();

  canvas3d.canvas.addEventListener('pointermove', onPointerMove);
  canvas3d.canvas.addEventListener('click', onClick);
}

function getMousePos(event) {
  const rect = canvas3d.canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function snap(val, spacing) {
  return Math.round(val / spacing) * spacing;
}

function getGridSpacing() {
  if (canvas3d.gridLinesX.length >= 2) {
    const diffs = [];
    for (let i = 1; i < canvas3d.gridLinesX.length; i++) {
      diffs.push(Math.abs(canvas3d.gridLinesX[i] - canvas3d.gridLinesX[i - 1]));
    }
    return diffs.length ? Math.min(...diffs) : 1.0;
  }
  return 1.0;
}

function onPointerMove(event) {
  getMousePos(event);
  raycaster.setFromCamera(mouse, canvas3d.camera);

  if (!canvas3d.groundPlane) {
    canvas3d.hoverMesh.visible = false;
    return;
  }

  if (S.tool === 'node' || S.tool === 'member') {
    const intersects = raycaster.intersectObject(canvas3d.groundPlane);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      const snapped = getSnappedPoint(point);
      canvas3d.hoverMesh.position.set(snapped.x, snapped.y, snapped.z);
      canvas3d.hoverMesh.visible = true;
    }
  } else {
    canvas3d.hoverMesh.visible = false;
  }
}

function snapToGrid(val, positions) {
  if (!positions.length) return val;
  let best = positions[0];
  let bestDist = Math.abs(val - best);
  for (let i = 1; i < positions.length; i++) {
    const d = Math.abs(val - positions[i]);
    if (d < bestDist) { best = positions[i]; bestDist = d; }
  }
  return best;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function getSnappedPoint(point) {
  const xSpacing = getGridSpacing();
  const ySpacing = canvas3d.gridLinesY.length >= 2
    ? (() => { const d = []; for (let i = 1; i < canvas3d.gridLinesY.length; i++) d.push(Math.abs(canvas3d.gridLinesY[i] - canvas3d.gridLinesY[i - 1])); return d.length ? Math.min(...d) : 1.0; })()
    : 1.0;
  const mode = canvas3d.viewMode;

  if (mode === 'plan') {
    return { x: snap(point.x, xSpacing), y: snap(point.y, ySpacing), z: canvas3d.currentPlanZ };
  } else if (mode === 'elevation') {
    const isXAxis = canvas3d.elevType === 'xAxis';
    const gridIdx = canvas3d.selectedElevGrid;
    
    const levElev = canvas3d.levels.map(l => l.elevation);
    const zMin = levElev.length ? Math.min(...levElev) : 0;
    const zMax = levElev.length ? Math.max(...levElev) : 10;
    
    const xMin = Math.min(...canvas3d.gridLinesX);
    const xMax = Math.max(...canvas3d.gridLinesX);
    const yMin = Math.min(...canvas3d.gridLinesY);
    const yMax = Math.max(...canvas3d.gridLinesY);
    
    // Fix the cut axis coordinate to the selected grid line
    const cutLines = isXAxis ? canvas3d.gridLinesY : canvas3d.gridLinesX;
    const fixVal = cutLines[gridIdx] ?? 0;
    
    if (isXAxis) {
      // X-axis elevation (XZ plane): snap X grid, snap Z level, Y fixed to cut grid
      const snappedX = clamp(snapToGrid(point.x, canvas3d.gridLinesX), xMin, xMax);
      const snappedZ = clamp(snapToGrid(point.z, levElev), zMin, zMax);
      return { x: snappedX, y: fixVal, z: snappedZ };
    } else {
      // Y-axis elevation (YZ plane): snap Y grid, snap Z level, X fixed to cut grid
      const snappedY = clamp(snapToGrid(point.y, canvas3d.gridLinesY), yMin, yMax);
      const snappedZ = clamp(snapToGrid(point.z, levElev), zMin, zMax);
      return { x: fixVal, y: snappedY, z: snappedZ };
    }
  } else {
    return { x: snap(point.x, xSpacing), y: snap(point.y, ySpacing), z: canvas3d.currentPlanZ };
  }
}

function onClick(event) {
  if (event.button !== 0) return;
  getMousePos(event);
  raycaster.setFromCamera(mouse, canvas3d.camera);

  if (S.tool === 'select') {
    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    if (intersectsNodes.length > 0) {
      S.selected = { type: 'node', id: intersectsNodes[0].object.userData.id };
      showProp();
      triggerRedraw();
      return;
    }
    const intersectsMembers = raycaster.intersectObjects(canvas3d.membersGroup.children);
    if (intersectsMembers.length > 0) {
      S.selected = { type: 'member', id: intersectsMembers[0].object.userData.id };
      showProp();
      triggerRedraw();
      return;
    }
    const intersectsSlabs = raycaster.intersectObjects(canvas3d.slabsGroup.children);
    if (intersectsSlabs.length > 0) {
      S.selected = { type: 'slab', id: intersectsSlabs[0].object.userData.id };
      showProp();
      triggerRedraw();
      return;
    }
    S.selected = null;
    showProp();
    triggerRedraw();

  } else if (S.tool === 'node') {
    const intersects = raycaster.intersectObject(canvas3d.groundPlane);
    if (intersects.length > 0) {
      const pt = intersects[0].point;
      addNode(getSnappedPoint(pt));
    }
  } else if (S.tool === 'member') {
    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    let nodeId = null;

    if (intersectsNodes.length > 0) {
      nodeId = intersectsNodes[0].object.userData.id;
    } else {
      const intersects = raycaster.intersectObject(canvas3d.groundPlane);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        addNode(getSnappedPoint(pt));
        nodeId = S.nextNodeId - 1;
      }
    }

    if (nodeId !== null) {
      if (S.memberStart === null) {
        S.memberStart = nodeId;
        updateStatus();
      } else {
        if (nodeId !== S.memberStart) {
          addMemberDirect(S.memberStart, nodeId);
        }
        S.memberStart = null;
        updateStatus();
      }
    }
  } else if (S.tool === 'support') {
    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    if (intersectsNodes.length > 0) {
      const nodeId = intersectsNodes[0].object.userData.id;
      const node = S.nodes.find(n => n.id === nodeId);
      if (node && showSupportModalCb) showSupportModalCb(node);
    }
  } else if (S.tool === 'load') {
    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    if (intersectsNodes.length > 0) {
      const nodeId = intersectsNodes[0].object.userData.id;
      const node = S.nodes.find(n => n.id === nodeId);
      if (node && showLoadModalCb) showLoadModalCb(node);
    } else {
      const intersectsMembers = raycaster.intersectObjects(canvas3d.membersGroup.children);
      if (intersectsMembers.length > 0) {
        const memberId = intersectsMembers[0].object.userData.id;
        const member = S.members.find(m => m.id === memberId);
        if (member && showMemberLoadModalCb) showMemberLoadModalCb(member);
      }
    }
  } else if (S.tool === 'slab') {
    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    if (intersectsNodes.length > 0) {
      const nodeId = intersectsNodes[0].object.userData.id;
      // Avoid duplicate corners
      if (!S.slabCorners.includes(nodeId)) {
        S.slabCorners.push(nodeId);
        if (S.slabCorners.length >= 3 && showSlabModalCb) {
          const cornerNodes = S.slabCorners.map(id => S.nodes.find(n => n.id === id)).filter(Boolean);
          showSlabModalCb(cornerNodes);
        }
      }
    }
    updateStatus();
  } else if (S.tool === 'delete') {
    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    if (intersectsNodes.length > 0) {
      const nodeId = intersectsNodes[0].object.userData.id;
      S.members = S.members.filter(m => m.n1 !== nodeId && m.n2 !== nodeId);
      S.slabs = S.slabs.filter(s => !s.nodeIds.includes(nodeId));
      S.loads = S.loads.filter(l => l.nodeId !== nodeId);
      S.nodes = S.nodes.filter(n => n.id !== nodeId);
      S.selected = null;
      showProp();
      triggerRedraw();
      return;
    }
    const intersectsMembers = raycaster.intersectObjects(canvas3d.membersGroup.children);
    if (intersectsMembers.length > 0) {
      const memberId = intersectsMembers[0].object.userData.id;
      S.members = S.members.filter(m => m.id !== memberId);
      S.memberLoads = S.memberLoads.filter(l => l.memberId !== memberId);
      S.selected = null;
      showProp();
      triggerRedraw();
      return;
    }
    // Delete slab on click
    const intersectsSlabs = raycaster.intersectObjects(canvas3d.slabsGroup.children);
    if (intersectsSlabs.length > 0) {
      const slabId = intersectsSlabs[0].object.userData.id;
      S.slabs = S.slabs.filter(s => s.id !== slabId);
      S.selected = null;
      showProp();
      triggerRedraw();
    }
  }
}

function addNode(snapped) {
  const duplicate = S.nodes.find((n) =>
    Math.abs(n.x - snapped.x) < 0.01 && Math.abs(n.y - snapped.y) < 0.01 && Math.abs((n.z || 0) - (snapped.z || 0)) < 0.01
  );
  if (!duplicate) {
    S.nodes.push({ id: S.nextNodeId++, x: snapped.x, y: snapped.y, z: snapped.z || 0, support: 'free' });
    triggerRedraw();
  }
}

function addMemberDirect(n1, n2) {
  const duplicate = S.members.find(m => (m.n1 === n1 && m.n2 === n2) || (m.n1 === n2 && m.n2 === n1));
  if (!duplicate) {
    S.members.push({ id: S.nextMemberId++, n1, n2, A: 0.01, I: 1e-4, E: 200, J: 1e-4, Iy: 1e-4, Iz: 1e-4 });
    triggerRedraw();
  }
}
