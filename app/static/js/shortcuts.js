import { byId } from './dom.js';
import { S } from './state.js';
import { draw, showProp } from './canvas3d/render.js';
import { clearCurrentModel } from './analysis.js';

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const key = e.key.toLowerCase();

    // Tool selection shortcuts
    if (key === 'n') { document.querySelector('[data-tool="node"]').click(); }
    if (key === 'm') { document.querySelector('[data-tool="member"]').click(); }
    if (key === 's') { document.querySelector('[data-tool="support"]').click(); }
    if (key === 'l') { document.querySelector('[data-tool="load"]').click(); }
    if (key === 'escape' || key === 'v') { document.querySelector('[data-tool="select"]').click(); }

    // Delete selected element
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (S.selected) {
        if (S.selected.type === 'node') {
          const nodeId = S.selected.id;
          S.members = S.members.filter(m => m.n1 !== nodeId && m.n2 !== nodeId);
          S.loads = S.loads.filter(l => l.nodeId !== nodeId);
          S.nodes = S.nodes.filter(n => n.id !== nodeId);
        } else if (S.selected.type === 'member') {
          const memberId = S.selected.id;
          S.members = S.members.filter(m => m.id !== memberId);
          S.memberLoads = S.memberLoads.filter(l => l.memberId !== memberId);
        }
        S.selected = null;
        showProp();
        draw();
      } else if (S.tool === 'delete') {
        document.querySelector('[data-tool="select"]').click();
      } else {
        document.querySelector('[data-tool="delete"]').click();
      }
    }
  });
}
