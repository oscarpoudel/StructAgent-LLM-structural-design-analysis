# Backend Documentation

## app/main.py - Flask Application Entry Point

The central Flask application that defines all API routes, manages SQLite history, and initializes the agent system.

### Key Components

- **Flask app**: Serves static files from pp/static/, disables JSON key sorting
- **SQLite history**: nalysis_history.db stores all analyses with schema: id, timestamp, analysis_type, prompt, results_json, report_markdown
- **LLM/Agent setup**: get_agent_system() creates StructuralAgentSystem with the configured LLM provider (ollama/pydanticai/none)
- **Request classification**: is_structural_analysis_request() and is_drawing_analysis_request() determine routing between chat conversation and analysis
- **Canvas analysis**: nalyze_structure_model() runs truss or frame analysis on drawn structures

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| / | GET | Serves index.html |
| /health | GET | Health check endpoint |
| /api/analyze | POST | Run analysis from natural language prompt |
| /api/chat | POST | Chat with structural assistant (conversation, canvas actions, or analysis) |
| /api/analyze/structure | POST | Analyze a drawn structure model |
| /api/sections | GET | List or search steel sections |
| /api/sections/<name> | GET | Get properties for a specific section |
| /api/history | GET | Get analysis history |
| /api/history/<id> | GET | Get specific history item |
| /api/export/csv | POST | Export results as CSV |
| /api/export/report | POST | Export markdown report |

## app/agents.py - Multi-Agent System

Orchestrates the analysis pipeline using specialized agents with deterministic fallbacks.

### Managed Agents

1. **Conversation Agent**: Handles greetings and conceptual questions. System prompt defines structural analysis expertise.
2. **Intent Agent**: Extracts structural engineering intent from user prompts. Returns JSON with structure_type, analysis_type, boundary_conditions.
3. **Planning Agent**: Selects appropriate solver based on intent. Maps to openseespy_beam, openseespy_truss, openseespy_frame, openseespy_3d_frame, or column_euler_aisc.
4. **Canvas Router Agent**: Routes chat messages to canvas tools (clear_canvas, draw_simple_beam, none).

### Analysis Pipeline

StructuralAgentSystem.analyze(prompt) executes:

1. **Type detection**: Keyword-based detection of analysis type (beam, truss, frame, column, 3d_frame)
2. **Intent extraction**: LLM call with 3s timeout, falls back to deterministic defaults
3. **Planning**: LLM selects solver, falls back to type-based mapping
4. **Input extraction**: Regex-based parameter extraction from prompt text
5. **Solver execution**: Calls appropriate tool (beam, truss, frame, column, 3d)
6. **Critic validation**: Checks result sanity, deflection limits, compression warnings
7. **Report generation**: Formats markdown engineering report

### Input Extraction Methods

- _extract_beam_inputs(): Parses span, UDL, point loads, E, I, A, section modulus, support type via regex
- _extract_truss_inputs(): Parses JSON or creates default Warren truss with extracted span/height/load
- _extract_frame_inputs(): Parses JSON or creates default portal frame with extracted width/height/loads
- _extract_column_inputs(): Parses length, area, inertia, E, Fy, end condition, axial load
- _extract_3d_inputs(): Parses JSON or creates default 3D cantilever column

### Support Type Detection

- detect_analysis_type(): Keywords for truss, frame, column, 3d; defaults to beam
- detect_support_type(): Keywords for cantilever, fixed-fixed, propped cantilever; defaults to simply_supported

## app/models.py - Pydantic Schemas

All request/response models and input schemas using Pydantic v2.

### Request Models

- **AnalyzeRequest**: prompt (min 5 chars)
- **ChatRequest**: message (min 1 char), optional nalysis_type, optional model (canvas structure)

### Beam Inputs

- **PointLoad**: magnitude_kn, position_m
- **BeamInputs**: span_m, udl_kn_per_m, point_loads, elastic_modulus_gpa, inertia_m4, rea_m2, section_modulus_m3, deflection_limit_ratio, support_type

### Truss Inputs

- **TrussNode**: id, x, y, support (free/pin/roller_x/roller_y/fixed)
- **TrussMember**: id, start_node, end_node, rea_m2, elastic_modulus_gpa
- **TrussLoad**: 
ode_id, x_kn, y_kn
- **TrussInputs**: 
odes, members, loads

### Frame Inputs

- **FrameNode**: id, x, y, support (free/pin/roller/fixed)
- **FrameMember**: id, start_node, end_node, rea_m2, inertia_m4, elastic_modulus_gpa
- **FrameLoad**: 
ode_id, x_kn, y_kn, moment_kn_m
- **FrameMemberLoad**: member_id, udl_kn_per_m
- **FrameInputs**: 
odes, members, 
odal_loads, member_loads

### Column Inputs

- **ColumnInputs**: length_m, rea_m2, inertia_m4, elastic_modulus_gpa, yield_stress_mpa, end_condition, xial_load_kn

### 3D Structure Inputs

- **Support3D**: ux, uy, uz, x, y, z (boolean DOF constraints)
- **Node3D**: id, x, y, z, support
- **Member3D**: id, start_node, end_node, rea_m2, iy_m4, iz_m4, j_m4, elastic_modulus_gpa, shear_modulus_gpa
- **Load3D**: 
ode_id, x_kn, y_kn, z_kn, mx_kn_m, my_kn_m, mz_kn_m
- **MemberLoad3D**: member_id, wy_kn_per_m, wz_kn_per_m
- **Structure3DInputs**: 
odes, members, 
odal_loads, member_loads

### Response Models

- **AgentTrace**: gent, summary, data
- **DiagramData**: positions, shear_kn, moment_kn_m, deflection_mm
- **AnalyzeResponse**: status, nalysis_type, ssumptions, warnings, 	races, esults, eport_markdown, diagrams
- **CanvasAction**: ction, rguments
- **CanvasToolDecision**: ction, rguments, message, confidence
- **ChatResponse**: status, esponse_type, message, source, nalysis, canvas_action

## app/llm.py - LLM Clients

Three LLM client implementations with a unified generate(system, prompt) interface:

1. **DisabledLLMClient**: Raises RuntimeError on any call. Used when gent_llm_provider=none.
2. **OllamaClient**: Direct HTTP POST to Ollama /api/generate endpoint with temperature=0.1
3. **PydanticAIClient**: Uses PydanticAI library with Ollama provider via OpenAI-compatible /v1 endpoint

## app/config.py - Settings

PydanticSettings loaded from .env file with defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| ollama_base_url | http://128.235.163.220:11434 | Ollama server URL |
| ollama_model | glm-4.7-flash:latest | Model name |
| gent_llm_provider | ollama | Provider: ollama, pydanticai, none |
| gent_llm_timeout_s | 8.0 | Timeout for LLM calls |
| pp_env | development | Environment |
| pp_secret_key | change-me-before-deploy | Flask secret key |

get_settings() is cached with @lru_cache for performance.