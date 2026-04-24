import re

with open("app/static/js/canvas3d/interaction.js", "r") as f:
    js = f.read()

# Update hover mesh coordinates
js = js.replace("canvas3d.hoverMesh.visible = true;", "canvas3d.hoverMesh.visible = true;\n      const coordDisp = document.getElementById('coordDisplay');\n      if(coordDisp) coordDisp.textContent = `X: ${snapX(point.x).toFixed(2)} | Y: ${snapY(point.y).toFixed(2)} | Z: ${canvas3d.currentZ.toFixed(2)}`;")

# Fix Member tool randomly creating nodes
old_member_logic = """    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    let nodeId = null;
    
    if (intersectsNodes.length > 0) {
      nodeId = intersectsNodes[0].object.userData.id;
    } else {
      const intersects = raycaster.intersectObject(canvas3d.groundPlane);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        addNode({ x: snapX(pt.x), y: snapY(pt.y), z: canvas3d.currentZ });
        nodeId = S.nextNodeId - 1; 
      }
    }"""

new_member_logic = """    const intersectsNodes = raycaster.intersectObjects(canvas3d.nodesGroup.children);
    let nodeId = null;
    
    if (intersectsNodes.length > 0) {
      nodeId = intersectsNodes[0].object.userData.id;
    }"""
js = js.replace(old_member_logic, new_member_logic)

with open("app/static/js/canvas3d/interaction.js", "w") as f:
    f.write(js)
