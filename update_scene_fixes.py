import re

with open("app/static/js/canvas3d/scene.js", "r") as f:
    js = f.read()

js = js.replace("gridHelper: null,", "gridHelper: null,\n  ghostGridsGroup: null,")
js = js.replace("canvas3d.scene.add(canvas3d.supportsGroup);", "canvas3d.scene.add(canvas3d.supportsGroup);\n  canvas3d.ghostGridsGroup = new THREE.Group();\n  canvas3d.scene.add(canvas3d.ghostGridsGroup);")

with open("app/static/js/canvas3d/scene.js", "w") as f:
    f.write(js)
