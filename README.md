# Multi-Agent LLM Structural Analysis

A Flask-based structural analysis assistant that combines conversational agent workflows, an interactive browser-based modeling canvas, deterministic engineering tools, and OpenSeesPy. The current implementation supports preliminary elastic beam, truss, 2D frame, column, and 3D space-frame analysis workflows.

This software is intended for research, education, experimentation, and early-stage engineering assistance. It is not a substitute for review, approval, or design work by a licensed professional engineer.

## Features

- Chat interface for greetings, capability questions, and engineering requests
- Optional Ollama or PydanticAI LLM routing with deterministic fallbacks
- Flask web API and browser UI
- Interactive 3D modeling canvas with grids, levels, plan/elevation/3D views, snapping, and axis labels
- OpenSeesPy-backed beam, truss, 2D frame, and 3D frame analysis paths
- Closed-form beam calculations for fallback and cross-checking
- 3D frame load cases and load combinations (`D`, `L`, `EX`, `EY`)
- Optional rigid floor diaphragm constraints for 3D floor levels
- Beam/column/brace member grouping with quick default section assignment
- 3D story displacement, drift, base reaction, member force envelope, deformed shape, and force overlay outputs
- CSV and Markdown report export with nested 3D analysis data
- Basic result critic for deflection limits, finite-value checks, and missing design inputs
- Markdown report generation with assumptions, warnings, and key results
- Python 3.12 conda environment
- Noncommercial software license for research and educational use

## Current Scope

The solver paths support preliminary linear elastic analysis for beams, trusses, 2D frames, columns, and 3D space frames. For 3D frame models, the browser canvas can build geometry from grid/story levels, assign supports and member properties, apply nodal/member/slab loads, run OpenSeesPy, and report:

- base reactions
- nodal translations and rotations
- member end forces and force envelopes
- story displacements and story drift ratios
- load-combination summaries
- deformed shape and member force overlays
- CSV and Markdown exports with detailed nested result data

The 3D workflow is intended for ETABS-style preliminary comparison, not final design. Current limitations include no P-Delta analysis, no automatic code design checks, limited member release handling, and simplified section assignment.

## Safety Notice

All outputs are preliminary and depend on the assumptions and units provided by the user. The assistant does not perform code compliance checks, load path validation, constructability review, connection design, detailing, or licensed engineering approval.

## Project Layout

```text
app/
  agents.py            Agent orchestration and analysis workflow
  config.py            Environment-driven settings
  llm.py               Ollama, PydanticAI, and fallback LLM clients
  main.py              Flask app factory and shared analysis helpers
  models.py            Pydantic request and response models
  routes/              Flask route blueprints
  static/              Browser chat and 3D modeling UI
  tools/
    beam.py            Closed-form beam calculations
    opensees_beam.py   OpenSeesPy beam analysis tool
    opensees_3d.py     OpenSeesPy 3D frame analysis tool
    report.py          Markdown report formatter
tests/
  test_all_tools.py
  test_beam_tool.py
  test_flask_app.py
  test_opensees_3d.py
```

## Setup

Create and activate the conda environment:

```powershell
conda env create -f environment.yml
conda activate struct-agent
```

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

## Run Locally

```powershell
python -m flask --app app.main run --debug
```

Open the browser UI:

```text
http://127.0.0.1:5000
```

## Example Prompt

```text
Analyze a simply supported steel beam. Span is 6 m, uniform load is 20 kN/m, E is 200 GPa, I is 8e-6 m4. Check deflection against L/360.
```

## 3D Frame Canvas Workflow

1. Create a project and define X/Y grid spacings plus story levels.
2. Use `Node` and `Member` tools to model geometry, or use `3x3 3-Story Frame` as a starter model.
3. Assign base supports with the `Support` tool.
4. Click `Apply Beam/Column Sections` to classify vertical members as columns, horizontal members as beams, and inclined members as braces, then assign default preliminary section properties.
5. Apply nodal, member, or slab loads. Loads can be assigned to `D`, `L`, `EX`, or `EY` cases.
6. Select a load combination and choose whether rigid floor diaphragms are enabled.
7. Click `Analyze`.
8. Review base reactions, story drift, member envelopes, displacements, deformed shape, and force overlays.
9. Use `CSV` or `Report` in the results panel to export full analysis data.

Use `Clear Analysis` to remove results while keeping the model. Use `Clear Model` to delete geometry and loads.

## API

Chat endpoint:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:5000/api/chat `
  -ContentType 'application/json' `
  -Body '{"message":"hi"}'
```

Analysis through chat:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:5000/api/chat `
  -ContentType 'application/json' `
  -Body '{"message":"Analyze a simply supported steel beam. Span is 6 m, uniform load is 20 kN/m, E is 200 GPa, I is 8e-6 m4. Check deflection against L/360."}'
```

Direct analysis endpoint:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:5000/api/analyze `
  -ContentType 'application/json' `
  -Body '{"prompt":"Analyze a simply supported steel beam. Span is 6 m, uniform load is 20 kN/m, E is 200 GPa, I is 8e-6 m4. Check deflection against L/360."}'
```

## Testing

```powershell
$env:PYTHONPATH='.'; pytest
```

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

- `canvas-router`: the canvas tool decision (`none`, `clear_canvas`, `draw_simple_beam`)
- `chat-response`: the final `/api/chat` response type
- `canvas-action`: tool payload sent to the browser
- `analysis-traces`: solver/agent traces when an analysis is run

If `source` is `fallback`, the live LLM router was unavailable, disabled, or timed out and the deterministic parser handled the prompt. If `source` is `llm`, the configured LLM produced the routing decision.

## Deployment Notes

For production-like local hosting, use Waitress:

```powershell
waitress-serve --listen=127.0.0.1:5000 app.main:app
```

Keep `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `APP_SECRET_KEY` in the host environment, not in source control.

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0.

Research, experimentation, testing, personal study, educational use, and noncommercial public-interest use are permitted. Commercial use is not permitted without separate written permission from the copyright holder.
