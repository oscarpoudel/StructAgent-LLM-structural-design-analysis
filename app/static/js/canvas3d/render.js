import { byId } from '../dom.js';
import { S } from '../state.js';
import { canvas3d } from './scene.js';

export function draw() {
  if (!canvas3d.scene) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  canvas3d.scene.background = new THREE.Color(isDark ? '#0f1419' : '#f8fafb');
  
  if (canvas3d.gridHelper) {
    const showGrid = byId('showGrid');
    canvas3d.gridHelper.visible = showGrid ? showGrid.checked : true;
  }

  // Clear existing
  clearGroup(canvas3d.nodesGroup);
  clearGroup(canvas3d.membersGroup);
  clearGroup(canvas3d.loadsGroup);
  clearGroup(canvas3d.supportsGroup);

  drawMembers3D(isDark);
  drawNodes3D(isDark);
  drawSupports3D(isDark);
  drawLoads3D(isDark);
}

function clearGroup(group) {
  while (group.children.length > 0) { 
    const child = group.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
    group.remove(child); 
  }
}

function drawMembers3D(isDark) {
  S.members.forEach((member) => {
    const n1 = S.nodes.find((n) => n.id === member.n1);
    const n2 = S.nodes.find((n) => n.id === member.n2);
    if (!n1 || !n2) return;

    const v1 = new THREE.Vector3(n1.x, n1.y, n1.z || 0);
    const v2 = new THREE.Vector3(n2.x, n2.y, n2.z || 0);
    const distance = v1.distanceTo(v2);
    
    const geo = new THREE.CylinderGeometry(0.15, 0.15, distance, 8);
    geo.translate(0, distance / 2, 0);
    geo.rotateX(Math.PI / 2);
    
    const isSelected = S.selected && S.selected.type === 'member' && S.selected.id === member.id;
    const mat = new THREE.MeshStandardMaterial({ 
      color: isSelected ? 0xf59e0b : (isDark ? 0x60a5fa : 0x2563eb),
      roughness: 0.4
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(v1);
    mesh.lookAt(v2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { id: member.id };
    
    canvas3d.membersGroup.add(mesh);
  });
}

function drawNodes3D(isDark) {
  const geo = new THREE.SphereGeometry(0.25, 16, 16);
  
  S.nodes.forEach((node) => {
    const isSelected = S.selected && S.selected.type === 'node' && S.selected.id === node.id;
    const mat = new THREE.MeshStandardMaterial({ 
      color: isSelected ? 0xf59e0b : (isDark ? 0xe2e8f0 : 0x1e293b),
      roughness: 0.2 
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.set(node.x, node.y, node.z || 0);
    sphere.castShadow = true;
    sphere.userData = { id: node.id };
    canvas3d.nodesGroup.add(sphere);
  });
}

function drawSupports3D(isDark) {
  const geoFixed = new THREE.BoxGeometry(0.8, 0.8, 0.2);
  const geoPin = new THREE.ConeGeometry(0.4, 0.6, 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });

  S.nodes.forEach(node => {
    if (!node.support || node.support === 'free') return;
    
    let mesh;
    if (node.support === 'fixed') {
      mesh = new THREE.Mesh(geoFixed, mat);
      mesh.position.set(node.x, node.y, (node.z||0) - 0.1);
    } else {
      // pin or roller
      mesh = new THREE.Mesh(geoPin, mat);
      mesh.position.set(node.x, node.y, (node.z||0) - 0.3);
      mesh.rotation.x = Math.PI; // point up
    }
    canvas3d.supportsGroup.add(mesh);
  });
}

function drawLoads3D(isDark) {
  S.loads.forEach(load => {
    const node = S.nodes.find(n => n.id === load.nodeId);
    if (!node) return;
    
    // Nodal forces
    if (Math.abs(load.fz) > 0.01 || Math.abs(load.fy) > 0.01 || Math.abs(load.fx) > 0.01) {
      const dir = new THREE.Vector3(load.fx || 0, load.fy || 0, load.fz || 0).normalize();
      const length = 2.0;
      const color = 0xef4444; // Red for loads
      
      // ArrowHelper(dir, origin, length, color, headLength, headWidth)
      // We want arrow pointing TO the node. So origin is node - (dir * length)
      const origin = new THREE.Vector3(node.x, node.y, node.z || 0).sub(dir.clone().multiplyScalar(length));
      
      const arrow = new THREE.ArrowHelper(dir, origin, length, color, 0.5, 0.3);
      canvas3d.loadsGroup.add(arrow);
    }
  });
}

export function showProp() {
  const panel = byId('propPanel');
  if (!panel) return;
  
  if (!S.selected) {
    panel.innerHTML = '<p class="prop-hint">Select an element to edit.</p>';
    return;
  }

  if (S.selected.type === 'node') {
    const node = S.nodes.find((item) => item.id === S.selected.id);
    if (!node) {
      panel.innerHTML = '';
      return;
    }
    panel.innerHTML = `
      <div class="pf"><label>Node ${node.id}</label></div>
      <div class="pf"><label>X (m)</label><input type="number" value="${node.x}" step="0.5" id="px"/></div>
      <div class="pf"><label>Y (m)</label><input type="number" value="${node.y}" step="0.5" id="py"/></div>
      <div class="pf"><label>Z (m)</label><input type="number" value="${node.z||0}" step="0.5" id="pz"/></div>
      <div class="pf"><label>Support</label><select id="pSupp">
        <option value="free" ${node.support === 'free' ? 'selected' : ''}>Free</option>
        <option value="pin" ${node.support === 'pin' ? 'selected' : ''}>Pin</option>
        <option value="roller" ${node.support === 'roller' ? 'selected' : ''}>Roller</option>
        <option value="fixed" ${node.support === 'fixed' ? 'selected' : ''}>Fixed</option>
      </select></div>`;
    panel.querySelector('#px').addEventListener('change', (e) => { node.x = parseFloat(e.target.value); draw(); });
    panel.querySelector('#py').addEventListener('change', (e) => { node.y = parseFloat(e.target.value); draw(); });
    panel.querySelector('#pz').addEventListener('change', (e) => { node.z = parseFloat(e.target.value); draw(); });
    panel.querySelector('#pSupp').addEventListener('change', (e) => { node.support = e.target.value; draw(); });
  } else if (S.selected.type === 'member') {
    const member = S.members.find((item) => item.id === S.selected.id);
    if (!member) {
      panel.innerHTML = '';
      return;
    }
    panel.innerHTML = `
      <div class="pf"><label>Member ${member.id} (${member.n1}-${member.n2})</label></div>
      <div class="pf"><label>A (m2)</label><input type="text" value="${member.A}" id="mA"/></div>
      <div class="pf"><label>Iy (m4)</label><input type="text" value="${member.Iy||1e-4}" id="mIy"/></div>
      <div class="pf"><label>Iz (m4)</label><input type="text" value="${member.Iz||1e-4}" id="mIz"/></div>
      <div class="pf"><label>E (GPa)</label><input type="number" value="${member.E}" step="1" id="mE"/></div>`;
    panel.querySelector('#mA').addEventListener('change', (e) => { member.A = parseFloat(e.target.value); });
    panel.querySelector('#mIy').addEventListener('change', (e) => { member.Iy = parseFloat(e.target.value); });
    panel.querySelector('#mIz').addEventListener('change', (e) => { member.Iz = parseFloat(e.target.value); });
    panel.querySelector('#mE').addEventListener('change', (e) => { member.E = parseFloat(e.target.value); });
  }
}
