# StructAgent — Multi-Agent LLM Structural Analysis

A Flask-based structural analysis assistant that combines conversational AI agent workflows, an interactive browser-based 3D modeling canvas, deterministic engineering tools, and OpenSeesPy. This project supports preliminary elastic beam, truss, 2D frame, column buckling, and 3D space-frame analysis — all through a chat interface and an interactive 3D canvas.

This software is intended for research, education, experimentation, and early-stage engineering assistance. It is **not** a substitute for review, approval, or design work by a licensed professional engineer.

---

## Features

### Conversational AI Agent
- Chat interface for greetings, capability questions, and engineering requests
- Optional Ollama or PydanticAI LLM routing with deterministic fallbacks
- **Context-aware chat**: the agent sees the current 3D model and analysis results, answering questions about geometry, loads, floors, drifts, reactions, member forces, and more
- **Canvas tool routing**: the agent can draw beams, create 3D frame templates, apply member sections, toggle rigid diaphragms, set load combinations, and clear analysis results — all from natural language
- **LLM connection status indicator**: green/yellow/red dot in the chat header showing live connectivity

### Interactive 3D Modeling Canvas
- 3D canvas with grids, floor levels, plan/elevation/3D views, snapping, and axis labels
- Node, member, slab, and support tools for building structural models
- Beam/column/brace **member grouping** with one-click default section assignment
- Load assignment to `D`, `L`, `EX`, `EY` cases with nodal, member, and slab area loads
- **Rigid floor diaphragm** constraints for 3D floor levels
- **Rigid diaphragm** toggle for floor-level constraint
- Deformed shape and member force overlay visualization

### Solver Engine
- OpenSeesPy-backed beam, truss, 2D frame, and 3D frame analysis paths
- Closed-form beam calculations for fallback and cross-checking
- 3D frame: base reactions, nodal displacements/rotations, member end forces and envelopes, story drifts, load-combination-controlled results
- Column buckling check
- Load combination processing (`1.0D + 1.0L`, `1.2D + 1.6L`, `1.2D + 1.0EX + 0.5L`, `1.2D + 1.0EY + 0.5L`)

### Project Persistence
- Server-backed project storage with SQLite — cross-browser (Chrome, Firefox, Edge)
- Autosave (every 2 seconds) and on `beforeunload`
- IndexedDB-to-server migration on first load

### Export & Reporting
- CSV and Markdown report export with detailed nested 3D analysis data
- Basic result critic for deflection limits, finite-value checks, and missing design inputs
- Markdown report generation with assumptions, warnings, and key results

---

## Current Scope

The solver paths support preliminary linear elastic analysis for **beams**, **trusses**, **2D frames**, **columns**, and **3D space frames**. For 3D frame models, the browser canvas can build geometry from grid/story levels, assign supports and member properties, apply nodal/member/slab loads, run OpenSeesPy, and report:

- Base reactions
- Nodal translations and rotations
- Member end forces and force envelopes
- Story displacements and story drift ratios
- Load-combination summaries
- Deformed shape and member force overlays
- CSV and Markdown exports with detailed nested result data

The 3D workflow is intended for ETABS-style preliminary comparison, not final design. Current limitations include no P-Delta analysis, no automatic code design checks, limited member release handling, and simplified section assignment.

---

## Safety Notice

All outputs are preliminary and depend on the assumptions and units provided by the user. The assistant does **not** perform code compliance checks, load path validation, constructability review, connection design, detailing, or licensed engineering approval.

---

## Project Layout

```text
app/
  agents.py            Agent orchestration, context summarizer, canvas tool router
  config.py            Environment-driven settings (Pydantic-Settings + .env)
  llm.py               Ollama, PydanticAI, and Disabled LLM clients
  main.py              Flask app factory, DB init, LLM status check, blueprints
  models.py            Pydantic request/response models (Chat, Analyze, Canvas, etc.)
  logging_config.py    Structured logging (JSON + console)
  routes/
    analyze.py         Chat, analyze, evaluate, llm-status endpoints
    history.py         Analysis history CRUD
    pages.py           Static page serving
    projects.py        Project CRUD with SQLite
    sections.py        AISC section lookup
  static/
    index.html         Main application page
    styles.css         Full UI styling (glass design, topbar, canvas, chat, modals)
    js/
      chat.js          Chat UI, context builder, LLM status polling, canvas actions
      analysis.js      Model payload builder, drawing functions, analysis runner
      state.js         Global state (S) with nodes, members, loads, results
      main.js          App initialization, project grid, autosave
      canvas3d/        Three.js 3D canvas (render, interaction, scene, ui, export)
      results.js       Results panel, CSV/Markdown export, force overlays
      sections.js      AISC section browser
      projects.js      Server-side project persistence with fallback
      history.js       Analysis history panel
      api.js           API fetch wrappers
      dom.js           DOM helpers
      tabs.js          Tab navigation
      shortcuts.js     Keyboard shortcuts
      modals.js        Nodal load, member load, slab dialogs
  tools/
    beam.py            Closed-form beam calculations (SS, cantilever, fixed, propped)
    opensees_beam.py   OpenSeesPy beam analysis tool
    opensees_3d.py     OpenSeesPy 3D frame analysis tool
    frame.py           2D frame analysis
    truss.py           2D truss analysis
    column.py          Column buckling check
    sections.py        AISC database and section properties
    load_combinations.py Load combination processing
    report.py          Markdown report formatter
    opensees_beam.py   OpenSeesPy beam solver
scripts/
  debug_chat.py        CLI debugger for chat routing
  run.py               Alternative entry point
tests/
  test_flask_app.py    API integration tests (chat, analyze, canvas, context, LLM status, projects)
  test_beam_tool.py    Beam calculation tests
  test_all_tools.py    Cross-tool test suite
  test_opensees_3d.py  3D frame OpenSeesPy tests
```

---

## Setup

### Prerequisites
- Python 3.12+
- Conda (recommended) or pip
- [Ollama](https://ollama.com) (optional, for LLM features)

### Install

```powershell
conda env create -f environment.yml
conda activate struct-agent
```

### Configuration

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` if your Ollama endpoint, model, or timeout settings differ:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=your-model-name
AGENT_LLM_PROVIDER=ollama
AGENT_LLM_TIMEOUT_S=8.0
```

Supported `AGENT_LLM_PROVIDER` values:

- `ollama`: use the configured Ollama model for conversational responses and agent routing
- `pydanticai`: use the PydanticAI adapter where available
- `none`: skip live LLM calls and use deterministic fallbacks

Chat responses include a `source` field. `source: "llm"` means the model answered. `source: "fallback"` means the model timed out or was unavailable.

**Note on debug mode**: When running with `--debug`, the Flask reloader may not pick up new route files. For development, use:

```powershell
python -m flask --app app.main run
```

---

## Run Locally

```powershell
python -m flask --app app.main run
```

Open the browser UI at [http://127.0.0.1:5000](http://127.0.0.1:5000).

---

## Example Prompt

```text
Analyze a simply supported steel beam. Span is 6 m, uniform load is 20 kN/m, E is 200 GPa, I is 8e-6 m4. Check deflection against L/360.
```

---

## 3D Frame Canvas Workflow

1. **Create a project** and define X/Y grid spacings plus story levels.
2. Use **Node** and **Member** tools to model geometry, or use **3x3 3-Story Frame** as a starter model.
3. Assign base supports with the **Support** tool.
4. Click **Apply Beam/Column Sections** to classify vertical members as columns, horizontal members as beams, and inclined members as braces, then assign default preliminary section properties.
5. Apply nodal, member, or slab loads. Loads can be assigned to `D`, `L`, `EX`, or `EY` cases.
6. Select a **load combination** and choose whether **rigid floor diaphragms** are enabled.
7. Click **Analyze**.
8. Review base reactions, story drift, member envelopes, displacements, deformed shape, and force overlays.
9. Use **CSV** or **Report** in the results panel to export full analysis data.

Use **Clear Analysis** to remove results while keeping the model. Use **Clear Model** to delete geometry and loads.

---

## API

### Chat with context

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:5000/api/chat `
  -ContentType 'application/json' `
  -Body '{"message":"how many floors in this building?","model":{"nodes":[...],"members":[...]}}'
```

### Direct analysis

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:5000/api/analyze `
  -ContentType 'application/json' `
  -Body '{"prompt":"Analyze a simply supported steel beam. Span is 6 m, uniform load is 20 kN/m, E is 200 GPa, I is 8e-6 m4. Check deflection against L/360."}'
```

### LLM status

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5000/api/llm-status
```

### Projects CRUD

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5000/api/projects
```

---

## Testing

```powershell
$env:PYTHONPATH='.'; pytest
```

Or with coverage:

```powershell
$env:PYTHONPATH='.'; pytest --cov=app --cov-report=term
```

---

## Debug Chat Routing

Use the local CLI debugger to see how chat messages are routed before opening the browser:

```powershell
python scripts/debug_chat.py "draw a simply supported beam with 2m length and 10 kN load at middle"
```

Interactive mode:

```powershell
python scripts/debug_chat.py
```

The debugger prints:

- `canvas-router`: the canvas tool decision (`none`, `clear_canvas`, `draw_simple_beam`, `clear_analysis`, `draw_3d_frame_template`, etc.)
- `chat-response`: the final `/api/chat` response type
- `canvas-action`: tool payload sent to the browser
- `analysis-traces`: solver/agent traces when an analysis is run

If `source` is `fallback`, the live LLM router was unavailable, disabled, or timed out and the deterministic parser handled the prompt. If `source` is `llm`, the configured LLM produced the routing decision.

---

## Deployment Notes

For production-like local hosting, use Waitress (no debug reloader):

```powershell
waitress-serve --listen=127.0.0.1:5000 app.main:app
```

Keep `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `APP_SECRET_KEY` in the host environment, not in source control.

---

## License

StructAgent is distributed under the **PolyForm Noncommercial 1.0.0** license. It is source-available, not open source by the OSI definition — commercial use requires a separate license.

### You may freely:
- Use, modify, and run StructAgent for personal research, learning, or hobby projects
- Use it within charities, research, or educational settings
- Fork it, modify it, and redistribute under the same terms
- Contribute back via pull requests

### You need a commercial license if your organization uses StructAgent to:
- Power a paid product or service
- Run it as part of for-profit business operations
- Embed it in a commercial offering

See `COMMERCIAL.md` for how to obtain a commercial license — email **opoudel27@gmail.com**.

---

## Contributing

We welcome bug reports, documentation improvements, and pull requests. By contributing, you agree your work is licensed under the PolyForm-NC terms and that the maintainer may also relicense it commercially.

---

## Security

If you find a vulnerability, please do not file a public issue. Email **opoudel27@gmail.com**.

---

## Acknowledgements

StructAgent uses many great open-source projects, including: Flask, OpenSeesPy, Three.js, Pydantic, Pytest, Ollama, httpx, Pydantic-AI, and NumPy.
