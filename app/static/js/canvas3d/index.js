import { initScene, startRenderLoop, canvas3d, triggerRedraw } from './scene.js';
import { initUI } from './ui.js';
import { initInteraction } from './interaction.js';
import { draw } from './render.js';
import { S } from '../state.js';

export { draw, canvas3d };

let _lastWidth = 0;
let _lastHeight = 0;

export function initCanvas(modals) {
  initScene();
  initUI();
  initInteraction(modals);

  window.addEventListener('resize', resizeCanvas);

  startRenderLoop(draw);
}

export function resizeCanvas() {
  if (!canvas3d.canvas) return;
  const wrap = canvas3d.canvas.parentElement;
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;

  if (width < 1 || height < 1) return false;

  if (canvas3d.renderer && (width !== _lastWidth || height !== _lastHeight)) {
    canvas3d.renderer.setSize(width, height);
    canvas3d.camera.aspect = width / height;
    canvas3d.camera.updateProjectionMatrix();
    _lastWidth = width;
    _lastHeight = height;
  }
  triggerRedraw();
  return true;
}

export function fitModelToCanvas() {
  if (!S.nodes.length) {
    if (canvas3d.camera) {
      canvas3d.camera.position.set(0, -30, 5);
      canvas3d.controls.target.set(0, 0, 5);
    }
    return;
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  S.nodes.forEach(n => {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
    const z = n.z || 0;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  });

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 10);

  if (canvas3d.camera && canvas3d.controls) {
    canvas3d.controls.target.set(cx, cy, cz);
    canvas3d.camera.position.set(cx - span * 0.8, cy - span * 0.8, cz + span * 0.6);
    canvas3d.camera.lookAt(cx, cy, cz);
    canvas3d.controls.update();
  }
  triggerRedraw();
}
