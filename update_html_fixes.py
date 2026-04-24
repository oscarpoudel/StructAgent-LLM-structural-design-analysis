import re

with open("app/static/index.html", "r") as f:
    html = f.read()

# Add 3D Frame to Analysis options
old_analysis_opts = """    <select id="analysisType" class="tool-select">
      <option value="frame">Frame</option>
      <option value="truss">Truss</option>
    </select>"""

new_analysis_opts = """    <select id="analysisType" class="tool-select">
      <option value="3d_frame" selected>3D Frame</option>
      <option value="frame">2D Frame</option>
      <option value="truss">2D Truss</option>
    </select>"""
html = html.replace(old_analysis_opts, new_analysis_opts)

# Add Ghost Grid to Display options
old_display = """    <p class="toolbar-title">Display</p>
    <label class="chk"><input type="checkbox" id="showGrid" checked/> Grid</label>
    <label class="chk"><input type="checkbox" id="showLabels" checked/> Labels</label>
    <label class="chk"><input type="checkbox" id="showDeformed"/> Deformed</label>
    <label class="chk"><input type="checkbox" id="showForces"/> Forces</label>"""

new_display = """    <p class="toolbar-title">Display</p>
    <label class="chk"><input type="checkbox" id="showGrid" checked/> Active Grid</label>
    <label class="chk"><input type="checkbox" id="showGhostGrid" checked/> Lower Grids</label>
    <label class="chk"><input type="checkbox" id="showLabels" checked/> Labels</label>
    <label class="chk"><input type="checkbox" id="showDeformed"/> Deformed</label>
    <label class="chk"><input type="checkbox" id="showForces"/> Forces</label>"""
html = html.replace(old_display, new_display)

# Add Coordinate display
html = html.replace('  </section>\n\n  <!-- Results Panel -->', '    <div id="coordDisplay" style="position:absolute; bottom:10px; right:10px; padding:4px 8px; background:rgba(0,0,0,0.6); color:#fff; font-family:monospace; border-radius:4px; pointer-events:none; font-size:11px;">X: 0.00 | Y: 0.00 | Z: 0.00</div>\n  </section>\n\n  <!-- Results Panel -->')

with open("app/static/index.html", "w") as f:
    f.write(html)
