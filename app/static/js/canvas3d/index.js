import { initScene, startRenderLoop, canvas3d } from './scene.js';
import { initUI } from './ui.js';
import { initInteraction } from './interaction.js';
import { draw } from './render.js';
import { S } from '../state.js';

export { draw };

export function initCanvas(modals) {
  initScene();
  initUI();
  initInteraction(modals);
  
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 50);
  
  startRenderLoop();
}

export function resizeCanvas() {
  if (!canvas3d.canvas) return;
  const wrap = canvas3d.canvas.parentElement;
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;
  
  if (canvas3d.renderer) {
    canvas3d.renderer.setSize(width, height);
    canvas3d.camera.aspect = width / height;
    canvas3d.camera.updateProjectionMatrix();
  }
  draw();
}

export function fitModelToCanvas() {
  if (!S.nodes.length) {
    if (canvas3d.camera) {
      canvas3d.camera.position.set(0, -20, 20);
      canvas3d.controls.target.set(0, 0, 0);
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

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  
  if (canvas3d.camera && canvas3d.controls) {
    canvas3d.controls.target.set(cx, cy, cz);
    canvas3d.camera.position.set(cx, cy - Math.max(width, height) * 1.5, cz + Math.max(width, height));
    canvas3d.controls.update();
  }
  draw();
}
