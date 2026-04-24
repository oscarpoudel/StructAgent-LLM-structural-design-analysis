import re

with open("app/static/js/canvas3d/render.js", "r") as f:
    js = f.read()

js = js.replace("if (canvas3d.gridHelper) {", "if (canvas3d.gridHelper) {")
js = js.replace("canvas3d.gridHelper.visible = showGrid ? showGrid.checked : true;\n  }", "canvas3d.gridHelper.visible = showGrid ? showGrid.checked : true;\n  }\n  if (canvas3d.ghostGridsGroup) {\n    const showGhost = byId('showGhostGrid');\n    canvas3d.ghostGridsGroup.visible = showGhost ? showGhost.checked : true;\n  }")

with open("app/static/js/canvas3d/render.js", "w") as f:
    f.write(js)
