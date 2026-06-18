import { byId } from './dom.js';
import { S } from './state.js';
import { triggerRedraw } from './canvas3d/scene.js';

let draw;

export function initModals(canvasDraw) {
  draw = canvasDraw;
}

function openModal(title, bodyHtml, onOk) {
  const overlay = byId('modalOverlay');
  const modal = byId('modal');
  byId('modalTitle').textContent = title;
  byId('modalBody').innerHTML = bodyHtml;
  overlay.classList.remove('hidden');
  byId('modalOk').onclick = () => {
    onOk(modal);
    overlay.classList.add('hidden');
    triggerRedraw();
  };
  byId('modalCancel').onclick = () => overlay.classList.add('hidden');
  return modal;
}

export function showSupportModal(node) {
  openModal(`Set Support - Node ${node.id}`, `
    <div class="modal-opts">
      <label class="modal-opt"><input type="radio" name="sup" value="free" ${node.support === 'free' ? 'checked' : ''}/> Free</label>
      <label class="modal-opt"><input type="radio" name="sup" value="pin" ${node.support === 'pin' ? 'checked' : ''}/> Pin</label>
      <label class="modal-opt"><input type="radio" name="sup" value="roller" ${node.support === 'roller' || node.support === 'roller_x' ? 'checked' : ''}/> Roller</label>
      <label class="modal-opt"><input type="radio" name="sup" value="fixed" ${node.support === 'fixed' ? 'checked' : ''}/> Fixed</label>
    </div>`, (modal) => {
    const selected = modal.querySelector('input[name=sup]:checked');
    if (selected) node.support = selected.value;
  });
}

export function showLoadModal(node) {
  const existing = S.loads.find((load) => load.nodeId === node.id) || { case: 'D', fx: 0, fy: 0, fz: 0, moment: 0 };
  const modal = openModal(`Apply Load - Node ${node.id}`, `
    <div class="pf"><label>Load Case</label><select id="lcase">
      <option value="D" ${existing.case === 'D' ? 'selected' : ''}>D - Dead</option>
      <option value="L" ${existing.case === 'L' ? 'selected' : ''}>L - Live</option>
      <option value="EX" ${existing.case === 'EX' ? 'selected' : ''}>EX - Lateral X</option>
      <option value="EY" ${existing.case === 'EY' ? 'selected' : ''}>EY - Lateral Y</option>
    </select></div>
    <div class="pf"><label>Fx (kN, global +X)</label><input type="number" value="${existing.fx}" step="1" id="lfx"/></div>
    <div class="pf"><label>Fy (kN, global +Y)</label><input type="number" value="${existing.fy}" step="1" id="lfy"/></div>
    <div class="pf"><label>Fz (kN, global +Z)</label><input type="number" value="${existing.fz || 0}" step="1" id="lfz"/></div>
    <div class="pf"><label>Moment (kN-m)</label><input type="number" value="${existing.moment}" step="1" id="lm"/></div>
  `, (modal) => {
    const loadCase = modal.querySelector('#lcase').value;
    const fx = parseFloat(modal.querySelector('#lfx').value) || 0;
    const fy = parseFloat(modal.querySelector('#lfy').value) || 0;
    const fz = parseFloat(modal.querySelector('#lfz').value) || 0;
    const moment = parseFloat(modal.querySelector('#lm').value) || 0;
    S.loads = S.loads.filter((load) => load.nodeId !== node.id || (load.case || 'D') !== loadCase);
    if (Math.abs(fx) > 0.001 || Math.abs(fy) > 0.001 || Math.abs(fz) > 0.001 || Math.abs(moment) > 0.001) {
      S.loads.push({ nodeId: node.id, case: loadCase, fx, fy, fz, moment });
    }
  });
  const caseSelect = modal.querySelector('#lcase');
  caseSelect.addEventListener('change', () => {
    const load = S.loads.find((item) => item.nodeId === node.id && (item.case || 'D') === caseSelect.value) || { fx: 0, fy: 0, fz: 0, moment: 0 };
    modal.querySelector('#lfx').value = load.fx || 0;
    modal.querySelector('#lfy').value = load.fy || 0;
    modal.querySelector('#lfz').value = load.fz || 0;
    modal.querySelector('#lm').value = load.moment || 0;
  });
}

export function showMemberLoadModal(member) {
  const existing = S.memberLoads.find((memberLoad) => memberLoad.memberId === member.id) || { case: 'D', udl: 0 };
  const modal = openModal(`Distributed Load - Member ${member.id}`, `
    <div class="pf"><label>Load Case</label><select id="mcase">
      <option value="D" ${existing.case === 'D' ? 'selected' : ''}>D - Dead</option>
      <option value="L" ${existing.case === 'L' ? 'selected' : ''}>L - Live</option>
      <option value="EX" ${existing.case === 'EX' ? 'selected' : ''}>EX - Lateral X</option>
      <option value="EY" ${existing.case === 'EY' ? 'selected' : ''}>EY - Lateral Y</option>
    </select></div>
    <div class="pf"><label>UDL (kN/m, +down)</label><input type="number" value="${existing.udl}" step="1" id="mudl"/></div>
  `, (modal) => {
    const loadCase = modal.querySelector('#mcase').value;
    const udl = parseFloat(modal.querySelector('#mudl').value) || 0;
    S.memberLoads = S.memberLoads.filter((memberLoad) => memberLoad.memberId !== member.id || (memberLoad.case || 'D') !== loadCase);
    if (Math.abs(udl) > 0.001) S.memberLoads.push({ memberId: member.id, case: loadCase, udl });
  });
  const caseSelect = modal.querySelector('#mcase');
  caseSelect.addEventListener('change', () => {
    const load = S.memberLoads.find((item) => item.memberId === member.id && (item.case || 'D') === caseSelect.value) || { udl: 0 };
    modal.querySelector('#mudl').value = load.udl || 0;
  });
}

export function showSlabModal(cornerNodes) {
  const elev = cornerNodes[0] ? (cornerNodes[0].z || 0) : 0;
  const ids = cornerNodes.map(n => n.id).join(', ');
  openModal(`Create Slab - Nodes [${ids}]`, `
    <div class="pf"><label>Elevation (m)</label><input type="number" value="${elev}" step="0.1" id="slElev"/></div>
    <div class="pf"><label>Thickness (m)</label><input type="number" value="0.15" step="0.01" id="slThk"/></div>
    <div class="pf"><label>Load Case</label><select id="slCase">
      <option value="D">D - Dead</option>
      <option value="L">L - Live</option>
    </select></div>
    <div class="pf"><label>Area Load (kN/m², +down)</label><input type="number" value="0" step="0.5" id="slLoad"/></div>
  `, (modal) => {
    const elevation = parseFloat(modal.querySelector('#slElev').value) || 0;
    const thickness = parseFloat(modal.querySelector('#slThk').value) || 0.15;
    const areaLoad = parseFloat(modal.querySelector('#slLoad').value) || 0;
    const loadCase = modal.querySelector('#slCase').value;
    const slab = {
      id: S.nextSlabId++,
      nodeIds: cornerNodes.map(n => n.id),
      elevation,
      thickness,
      areaLoad,
      loadCase,
    };
    S.slabs.push(slab);
    S.slabCorners = [];
  });
}
