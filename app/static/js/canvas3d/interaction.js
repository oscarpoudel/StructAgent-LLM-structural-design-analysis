import { S } from '../state.js';
import { canvas3d } from './scene.js';
import { draw, showProp } from './render.js';
import { updateStatus } from './ui.js';

let raycaster;
let mouse;
let showSupportModalCb;
let showLoadModalCb;
let showMemberLoadModalCb;

export function initInteraction(modals) {
  showSupportModalCb = modals.showSupportModal;
  showLoadModalCb = modals.showLoadModal;
  showMemberLoadModalCb = modals.showMemberLoadModal;

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

function snap(val) {
  // Snap to intersections based on user defined spacing
  const spacing = canvas3d.gridSpacing || 1.0;
  return Math.round(val / spacing) * spacing;
}

function onPointerMove(event) {
  getMousePos(event);
  raycaster.setFromCamera(mouse, canvas3d.camera);

  // If grid doesn't exist, we can't draw
  if (!canvas3d.gridHelper) {
    canvas3d.hoverMesh.visible = false;
    return;
  }

  if (S.tool === 'node' || S.tool === 'member') {
    const intersects = raycaster.intersectObject(canvas3d.groundPlane);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      canvas3d.hoverMesh.position.set(snap(point.x), snap(point.y), canvas3d.currentZ);
      canvas3d.hoverMesh.visible = true;
    }
  } else {
    canvas3d.hoverMesh.visible = false;
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
      draw();
      return;
    }
    const intersectsMembers = raycaster.intersectObjects(canvas3d.membersGroup.children);
    if (intersectsMembers.length > 0) {
      S.selected = { type: 'member', id: intersectsMembers[0].object.userData.id };
      showProp();
      draw();
      return;
    }
    S.selected = null;
    showProp();
    draw();

  } else if (S.tool === 'node') {
    if (!canvas3d.gridHelper) {
      alert("Set Grid Configuration first before drawing nodes.");
      return;
    }
    const intersects = raycaster.intersectObject(canvas3d.groundPlane);
    if (intersects.length > 0) {
      const pt = intersects[0].point;
      addNode({ x: snap(pt.x), y: snap(pt.y), z: canvas3d.currentZ });
    }
  } else if (S.tool === 'member') {
    if (!canvas3d.gridHelper) {
      alert("Set Grid Configuration first before drawing members.");
      return;
    }
    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    let nodeId = null;
    
    if (intersectsNodes.length > 0) {
      nodeId = intersectsNodes[0].object.userData.id;
    } else {
      const intersects = raycaster.intersectObject(canvas3d.groundPlane);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        addNode({ x: snap(pt.x), y: snap(pt.y), z: canvas3d.currentZ });
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
  } else if (S.tool === 'delete') {
    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    if (intersectsNodes.length > 0) {
      const nodeId = intersectsNodes[0].object.userData.id;
      S.members = S.members.filter(m => m.n1 !== nodeId && m.n2 !== nodeId);
      S.loads = S.loads.filter(l => l.nodeId !== nodeId);
      S.nodes = S.nodes.filter(n => n.id !== nodeId);
      S.selected = null;
      showProp();
      draw();
      return;
    }
    const intersectsMembers = raycaster.intersectObjects(canvas3d.membersGroup.children);
    if (intersectsMembers.length > 0) {
      const memberId = intersectsMembers[0].object.userData.id;
      S.members = S.members.filter(m => m.id !== memberId);
      S.memberLoads = S.memberLoads.filter(l => l.memberId !== memberId);
      S.selected = null;
      showProp();
      draw();
    }
  }
}

function addNode(snapped) {
  const duplicate = S.nodes.find((n) => Math.abs(n.x - snapped.x) < 0.01 && Math.abs(n.y - snapped.y) < 0.01 && Math.abs((n.z||0) - (snapped.z||0)) < 0.01);
  if (!duplicate) {
    S.nodes.push({ id: S.nextNodeId++, x: snapped.x, y: snapped.y, z: snapped.z || 0, support: 'free' });
    draw();
  }
}

function addMemberDirect(n1, n2) {
  const duplicate = S.members.find(m => (m.n1 === n1 && m.n2 === n2) || (m.n1 === n2 && m.n2 === n1));
  if (!duplicate) {
    S.members.push({ id: S.nextMemberId++, n1: n1, n2: n2, A: 0.01, I: 1e-4, E: 200, J: 1e-4, Iy: 1e-4, Iz: 1e-4 });
    draw();
  }
}
