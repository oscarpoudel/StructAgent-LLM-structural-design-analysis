# Backend Documentation

## Project Structure

```
app/
├── __init__.py
├── main.py              # Flask app factory, DB init, blueprint wiring
├── config.py            # PydanticSettings from .env
├── models.py            # Pydantic v2 request/response schemas
├── agents.py            # Multi-agent orchestration, context summarizer, canvas router
├── llm.py               # LLM client implementations (Ollama, OllamaAI, disabled)
├── logging_config.py    # Structured logging setup
├── routes/
│   ├── __init__.py
│   ├── pages.py         # Static page routes (/ , /health)
│   ├── analyze.py       # Analysis & chat API routes
│   ├── projects.py      # Project CRUD API routes
│   ├── history.py       # History & export API routes
│   └── sections.py      # Steel section database API routes
├── tools/
│   ├── __init__.py
│   ├── beam.py          # Closed-form beam analysis
│   ├── opensees_beam.py # OpenSeesPy beam solver
│   ├── truss.py         # Truss analysis (matrix stiffness)
│   ├── frame.py         # 2D frame analysis (OpenSeesPy)
│   ├── column.py        # Column buckling analysis
│   ├── opensees_3d.py   # 3D structure analysis
│   ├── sections.py      # Steel section database
│   ├── report.py        # Report formatter
│   └── load_combinations.py  # ASCE 7 load combination generator
└── static/              # Frontend assets
```

## app/main.py - Flask Application Entry Point

The Flask application factory that initializes all components.

### Key Components

- **Flask app factory**: `get_app()` creates and configures the Flask instance
- **SQLite databases**:
  - `analysis_history.db` - Stores analysis results with schema: id, timestamp, analysis_type, prompt, results_json, report_markdown
  - `projects.db` - Stores user projects with schema: id (UUID), name, model (JSON), results (JSON), created_at, updated_at
- **Blueprint registration**: Registers route blueprints from `routes/pages.py`, `routes/analyze.py`, `routes/projects.py`, `routes/history.py`, `routes/sections.py`
- **LLM status check**: `_check_llm_status()` pings Ollama `/api/tags` to verify provider reachability
- **LLM client**: `_get_llm_client()` creates the configured LLM client based on `AGENT_LLM_PROVIDER`

### Database Schema

```sql
-- Analysis history
CREATE TABLE analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    analysis_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    results_json TEXT,
    report_markdown TEXT
);

-- Projects
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    results TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

## app/routes/analyze.py - Analysis & Chat Routes

The main API routes for analysis and chat functionality.

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Chat with structural assistant |
| `/api/chat/evaluate` | POST | Evaluate existing analysis results |
| `/api/analyze` | POST | Run analysis from natural language prompt |
| `/api/analyze/structure` | POST | Analyze a drawn structure model |
| `/api/llm-status` | GET | Check LLM provider connectivity |

### Chat Request Classification

- `_is_structural_analysis_request()` - Checks if message requests structural analysis (keywords: analyze, calculate, solve, etc.)
- `_is_context_question()` - Detects questions about the current canvas model (keywords: moment, stress, deflection, reaction, floor, story, height, dimension, bay, grid, etc.)
- `_has_real_context()` - Validates that frontend context contains meaningful model data (not empty defaults)
- `_summarize_canvas_context()` - Extracts engineering summary from model data: floor levels from Z-coordinates, building dimensions, member group counts (beams/columns/braces), active load combination, rigid diaphragm status

### Context Summarizer

`_summarize_canvas_context(context)` produces a structured summary including:

- **Floor levels**: Unique Z-coordinates of nodes (sorted)
- **Dimensions**: X and Y extents of the model
- **Member groups**: Counts of beams, columns, and braces
- **Load combination**: Active load combination name
- **Rigid diaphragm**: Whether enabled
- **Model summary**: Additional details from `model_summary` field

### Canvas Action Router

The `CanvasRouterAgent` routes chat messages to canvas tool actions:

- `clear_analysis` - Clear analysis results from canvas
- `draw_3d_frame_template` - Draw a 3D frame template (3-bay, 3-story)
- `apply_member_group_sections` - Apply steel sections to member groups
- `set_rigid_diaphragm` - Toggle rigid diaphragm option
- `set_load_combination` - Set active load combination
- `clear_canvas` - Clear entire canvas
- `draw_simple_beam` - Draw a simple beam
- `run_current_analysis` - Run analysis on current model

## app/routes/projects.py - Project Persistence

CRUD API for server-backed project storage.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/projects` | GET | List all projects |
| `/api/projects` | POST | Create a new project |
| `/api/projects/<id>` | PUT | Update an existing project |
| `/api/projects/<id>` | DELETE | Delete a project |

Projects store the full model state and analysis results, enabling cross-browser continuity through server-side SQLite storage.

## app/routes/history.py - History & Export Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/history` | GET | Get paginated analysis history |
| `/api/history/<id>` | GET | Get specific history record |
| `/api/export/csv` | POST | Export analysis as CSV |
| `/api/export/report` | POST | Export analysis as markdown |

## app/routes/sections.py - Section Database Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sections` | GET | List/search steel sections |
| `/api/sections/<name>` | GET | Get specific section properties |

## app/routes/pages.py - Static Page Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Serve index.html |
| `/health` | GET | Health check |

## app/agents.py - Multi-Agent System

Orchestrates the analysis pipeline using specialized agents with deterministic fallbacks.

### Managed Agents

1. **Conversation Agent**: Handles greetings, conceptual questions, and context-aware queries about the current model. System prompt defines structural analysis expertise.
2. **Intent Agent**: Extracts structural engineering intent from user prompts. Returns JSON with structure_type, analysis_type, boundary_conditions.
3. **Planning Agent**: Selects appropriate solver based on intent. Maps to openseespy_beam, openseespy_truss, openseespy_frame, openseespy_3d_frame, or column_euler_aisc.
4. **Canvas Router Agent**: Routes chat messages to canvas tool actions (8+ supported actions).
5. **Critic Agent**: Validates analysis results for sanity, deflection limits, compression warnings.

### Analysis Pipeline

`StructuralAgentSystem.analyze(prompt)` executes:

1. **Type detection**: Keyword-based detection of analysis type (beam, truss, frame, column, 3d_frame)
2. **Intent extraction**: LLM call with 3s timeout, falls back to deterministic defaults
3. **Planning**: LLM selects solver, falls back to type-based mapping
4. **Input extraction**: Regex-based parameter extraction from prompt text
5. **Solver execution**: Calls appropriate tool (beam, truss, frame, column, 3d)
6. **Critic validation**: Checks result sanity, deflection limits, compression warnings
7. **Report generation**: Formats markdown engineering report

### Input Extraction Methods

- `_extract_beam_inputs()`: Parses span, UDL, point loads, E, I, A, section modulus, support type via regex
- `_extract_truss_inputs()`: Parses JSON or creates default Warren truss with extracted span/height/load
- `_extract_frame_inputs()`: Parses JSON or creates default portal frame with extracted width/height/loads
- `_extract_column_inputs()`: Parses length, area, inertia, E, Fy, end condition, axial load
- `_extract_3d_inputs()`: Parses JSON or creates default 3D cantilever column

### Support Type Detection

- `detect_analysis_type()`: Keywords for truss, frame, column, 3d; defaults to beam
- `detect_support_type()`: Keywords for cantilever, fixed-fixed, propped cantilever; defaults to simply_supported

## app/models.py - Pydantic Schemas

All request/response models and input schemas using Pydantic v2.

### Request Models

- **AnalyzeRequest**: prompt (min 5 chars)
- **ChatRequest**: message (min 1 char), optional `analysis_type`, optional `model` (canvas structure), optional `results` (previous analysis), optional `context` (frontend context with model_summary)
- **EvaluateRequest**: results (dict), analysis_type, messages (chat history)

### Beam Inputs

- **PointLoad**: magnitude_kn, position_m
- **BeamInputs**: span_m, udl_kn_per_m, point_loads, elastic_modulus_gpa, inertia_m4, area_m2, section_modulus_m3, deflection_limit_ratio, support_type

### Truss Inputs

- **TrussNode**: id, x, y, support (free/pin/roller_x/roller_y/fixed)
- **TrussMember**: id, start_node, end_node, area_m2, elastic_modulus_gpa
- **TrussLoad**: node_id, fx_kn, fy_kn
- **TrussInputs**: nodes, members, loads

### Frame Inputs

- **FrameNode**: id, x, y, support (free/pin/roller/fixed)
- **FrameMember**: id, start_node, end_node, area_m2, inertia_m4, elastic_modulus_gpa
- **FrameLoad**: node_id, fx_kn, fy_kn, moment_kn_m
- **FrameMemberLoad**: member_id, udl_kn_per_m
- **FrameInputs**: nodes, members, nodal_loads, member_loads

### Column Inputs

- **ColumnInputs**: length_m, area_m2, inertia_m4, elastic_modulus_gpa, yield_stress_mpa, end_condition, axial_load_kn

### 3D Structure Inputs

- **Support3D**: ux, uy, uz, rx, ry, rz (boolean DOF constraints)
- **Node3D**: id, x, y, z, support
- **Member3D**: id, start_node, end_node, area_m2, iy_m4, iz_m4, j_m4, elastic_modulus_gpa, shear_modulus_gpa
- **Load3D**: node_id, fx_kn, fy_kn, fz_kn, mx_kn_m, my_kn_m, mz_kn_m
- **MemberLoad3D**: member_id, wy_kn_per_m, wz_kn_per_m
- **Structure3DInputs**: nodes, members, nodal_loads, member_loads

### Response Models

- **AgentTrace**: agent, summary, data
- **DiagramData**: positions, shear_kn, moment_kn_m, deflection_mm
- **AnalyzeResponse**: status, analysis_type, assumptions, warnings, traces, results, report_markdown, diagrams
- **CanvasAction**: action, arguments
- **CanvasToolDecision**: action, arguments, message, confidence
- **ChatResponse**: status, response_type, message, source, analysis, canvas_action
- **EvaluateResponse**: status, response_type, message, analysis, canvas_action

## app/llm.py - LLM Clients

Three LLM client implementations with a unified `generate(system, prompt)` interface:

1. **DisabledLLMClient**: Raises RuntimeError on any call. Used when `agent_llm_provider=none`.
2. **OllamaClient**: Direct HTTP POST to Ollama `/api/generate` endpoint with temperature=0.1
3. **OllamaAIClient**: Uses Ollama library with OpenAI-compatible client for structured output

## app/config.py - Settings

PydanticSettings loaded from `.env` file with defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| ollama_base_url | http://128.235.163.220:11434 | Ollama server URL |
| ollama_model | gemma4:latest | Model name |
| agent_llm_provider | ollama | Provider: ollama, ollamai, none |
| agent_llm_timeout_s | 8.0 | Timeout for LLM calls |
| app_env | development | Environment |
| app_secret_key | change-me-before-deploy | Flask secret key |

`get_settings()` is cached with `@lru_cache` for performance.

## app/logging_config.py - Logging

Structured logging configuration used across the application. Sets up console and file logging with consistent format including timestamps, log levels, and module names.
