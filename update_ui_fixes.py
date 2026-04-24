import re

with open("app/static/js/canvas3d/ui.js", "r") as f:
    js = f.read()

# Update grid rendering to support ghost grids
old_grid_apply = """  applyGridBtn.addEventListener('click', () => {
    const cx = parseInt(gridCountXInp.value, 10);
    const sx = parseFloat(gridSpacingXInp.value);
    const cy = parseInt(gridCountYInp.value, 10);
    const sy = parseFloat(gridSpacingYInp.value);
    
    canvas3d.gridSpacingX = sx;
    canvas3d.gridSpacingY = sy;

    if (canvas3d.gridHelper) canvas3d.scene.remove(canvas3d.gridHelper);
    
    // Create custom grid for unequal X and Y
    canvas3d.gridHelper = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0x444444 });
    const cMaterial = new THREE.LineBasicMaterial({ color: 0x888888 }); // center lines
    
    const sizeX = cx * sx;
    const sizeY = cy * sy;
    
    for(let i = -cx/2; i <= cx/2; i++) {
        const points = [new THREE.Vector3(i * sx, -sizeY/2, 0), new THREE.Vector3(i * sx, sizeY/2, 0)];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        canvas3d.gridHelper.add(new THREE.Line(geo, i === 0 ? cMaterial : material));
    }
    for(let j = -cy/2; j <= cy/2; j++) {
        const points = [new THREE.Vector3(-sizeX/2, j * sy, 0), new THREE.Vector3(sizeX/2, j * sy, 0)];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        canvas3d.gridHelper.add(new THREE.Line(geo, j === 0 ? cMaterial : material));
    }
    
    canvas3d.gridHelper.position.z = canvas3d.currentZ;
    canvas3d.scene.add(canvas3d.gridHelper);
    
    canvas3d.groundPlane.geometry.dispose();
    canvas3d.groundPlane.geometry = new THREE.PlaneGeometry(sizeX, sizeY);
    
    draw();
  });"""

new_grid_apply = """  applyGridBtn.addEventListener('click', () => {
    const cx = parseInt(gridCountXInp.value, 10);
    const sx = parseFloat(gridSpacingXInp.value);
    const cy = parseInt(gridCountYInp.value, 10);
    const sy = parseFloat(gridSpacingYInp.value);
    
    canvas3d.gridSpacingX = sx;
    canvas3d.gridSpacingY = sy;

    if (canvas3d.gridHelper) canvas3d.scene.remove(canvas3d.gridHelper);
    
    canvas3d.gridHelper = createGridMesh(cx, sx, cy, sy, 0x444444, 0x888888);
    canvas3d.gridHelper.position.z = canvas3d.currentZ;
    canvas3d.scene.add(canvas3d.gridHelper);
    
    const sizeX = cx * sx;
    const sizeY = cy * sy;
    canvas3d.groundPlane.geometry.dispose();
    canvas3d.groundPlane.geometry = new THREE.PlaneGeometry(sizeX, sizeY);
    
    updateGhostGrids();
    draw();
  });"""

# add ghost grids logic
ghost_logic = """
function createGridMesh(cx, sx, cy, sy, color, centerColor) {
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: color });
    const cMaterial = new THREE.LineBasicMaterial({ color: centerColor }); 
    const sizeX = cx * sx;
    const sizeY = cy * sy;
    for(let i = -cx/2; i <= cx/2; i++) {
        const points = [new THREE.Vector3(i * sx, -sizeY/2, 0), new THREE.Vector3(i * sx, sizeY/2, 0)];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        group.add(new THREE.Line(geo, i === 0 ? cMaterial : material));
    }
    for(let j = -cy/2; j <= cy/2; j++) {
        const points = [new THREE.Vector3(-sizeX/2, j * sy, 0), new THREE.Vector3(sizeX/2, j * sy, 0)];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        group.add(new THREE.Line(geo, j === 0 ? cMaterial : material));
    }
    return group;
}

export function updateGhostGrids() {
    if (!canvas3d.ghostGridsGroup) return;
    // clear ghost grids
    while(canvas3d.ghostGridsGroup.children.length > 0) {
        canvas3d.ghostGridsGroup.remove(canvas3d.ghostGridsGroup.children[0]);
    }
    
    const cx = parseInt(byId('gridCountX').value, 10);
    const sx = parseFloat(byId('gridSpacingX').value);
    const cy = parseInt(byId('gridCountY').value, 10);
    const sy = parseFloat(byId('gridSpacingY').value);
    
    // Add all levels below currentZ as ghost grids
    const levelSel = byId('levelSelect');
    for(let i = 0; i < levelSel.options.length; i++) {
        const val = parseFloat(levelSel.options[i].value);
        if (val < canvas3d.currentZ && val >= 0) {
            const g = createGridMesh(cx, sx, cy, sy, 0x1a202c, 0x334155);
            g.position.z = val;
            canvas3d.ghostGridsGroup.add(g);
        }
    }
}
"""

js = js.replace(old_grid_apply, ghost_logic + "\n" + new_grid_apply)

# Add updateGhostGrids call to level change
js = js.replace("canvas3d.gridHelper.position.z = z;", "canvas3d.gridHelper.position.z = z;\n    updateGhostGrids();")

# Add showGhostGrid display toggle
js = js.replace("['showGrid', 'showLabels', 'showDeformed', 'showForces'].forEach", "['showGrid', 'showGhostGrid', 'showLabels', 'showDeformed', 'showForces'].forEach")

with open("app/static/js/canvas3d/ui.js", "w") as f:
    f.write(js)
