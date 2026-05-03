# Graph Report - .  (2026-05-02)

## Corpus Check
- Corpus is ~30,151 words - fits in a single context window. You may not need a graph.

## Summary
- 496 nodes · 984 edges · 72 communities detected
- Extraction: 60% EXTRACTED · 40% INFERRED · 0% AMBIGUOUS · INFERRED: 391 edges (avg confidence: 0.65)
- Token cost: 58,000 input · 8,000 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend 3D Canvas JS|Frontend 3D Canvas JS]]
- [[_COMMUNITY_Agent Models & Schemas|Agent Models & Schemas]]
- [[_COMMUNITY_Config & LLM Clients|Config & LLM Clients]]
- [[_COMMUNITY_Beam Analysis Tool|Beam Analysis Tool]]
- [[_COMMUNITY_Multi-Agent System|Multi-Agent System]]
- [[_COMMUNITY_Main Routes & Core Tools|Main Routes & Core Tools]]
- [[_COMMUNITY_API & Results JS|API & Results JS]]
- [[_COMMUNITY_Sections Tool|Sections Tool]]
- [[_COMMUNITY_Load Combinations Tool|Load Combinations Tool]]
- [[_COMMUNITY_OpenSees Beam Solver|OpenSees Beam Solver]]
- [[_COMMUNITY_Flask App Tests|Flask App Tests]]
- [[_COMMUNITY_Logging Config|Logging Config]]
- [[_COMMUNITY_Pages Routes|Pages Routes]]
- [[_COMMUNITY_3D Canvas Core Files|3D Canvas Core Files]]
- [[_COMMUNITY_Beam Analysis Docs|Beam Analysis Docs]]
- [[_COMMUNITY_API Endpoints & Backend|API Endpoints & Backend]]
- [[_COMMUNITY_App Initialization|App Initialization]]
- [[_COMMUNITY_Tools Initialization|Tools Initialization]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Single readme_pydanticai|Single: readme_pydanticai]]
- [[_COMMUNITY_Single readme_simply_supported_beam|Single: readme_simply_supported_beam]]
- [[_COMMUNITY_Single readme_markdown_report|Single: readme_markdown_report]]
- [[_COMMUNITY_Single readme_python312|Single: readme_python312]]
- [[_COMMUNITY_Single readme_conda|Single: readme_conda]]
- [[_COMMUNITY_Single index_plotly|Single: index_plotly]]
- [[_COMMUNITY_Single index_threejs|Single: index_threejs]]
- [[_COMMUNITY_Single index_orbitcontrols|Single: index_orbitcontrols]]
- [[_COMMUNITY_Single index_chat_tab|Single: index_chat_tab]]
- [[_COMMUNITY_Single index_draw_tab|Single: index_draw_tab]]
- [[_COMMUNITY_Single index_sections_tab|Single: index_sections_tab]]
- [[_COMMUNITY_Single index_history_tab|Single: index_history_tab]]
- [[_COMMUNITY_Single index_3d_view|Single: index_3d_view]]
- [[_COMMUNITY_Single api_analyze_structure_endpoint|Single: api_analyze_structure_endpoint]]
- [[_COMMUNITY_Single api_sections_endpoint|Single: api_sections_endpoint]]
- [[_COMMUNITY_Single api_history_endpoint|Single: api_history_endpoint]]
- [[_COMMUNITY_Single api_export_csv_endpoint|Single: api_export_csv_endpoint]]
- [[_COMMUNITY_Single api_export_report_endpoint|Single: api_export_report_endpoint]]
- [[_COMMUNITY_Single api_health_endpoint|Single: api_health_endpoint]]
- [[_COMMUNITY_Single architecture_layered_arch|Single: architecture_layered_arch]]
- [[_COMMUNITY_Single architecture_solvers|Single: architecture_solvers]]
- [[_COMMUNITY_Single architecture_sqlite|Single: architecture_sqlite]]
- [[_COMMUNITY_Single architecture_pydantic|Single: architecture_pydantic]]
- [[_COMMUNITY_Single architecture_fallback_chain|Single: architecture_fallback_chain]]
- [[_COMMUNITY_Single backend_models_py|Single: backend_models_py]]
- [[_COMMUNITY_Single backend_config_py|Single: backend_config_py]]
- [[_COMMUNITY_Single backend_conversation_agent|Single: backend_conversation_agent]]
- [[_COMMUNITY_Single backend_intent_agent|Single: backend_intent_agent]]
- [[_COMMUNITY_Single backend_planning_agent|Single: backend_planning_agent]]
- [[_COMMUNITY_Single backend_canvas_router_agent|Single: backend_canvas_router_agent]]
- [[_COMMUNITY_Single frontend_index_html|Single: frontend_index_html]]
- [[_COMMUNITY_Single frontend_styles_css|Single: frontend_styles_css]]
- [[_COMMUNITY_Single frontend_theme_js|Single: frontend_theme_js]]
- [[_COMMUNITY_Single frontend_canvas3d_js|Single: frontend_canvas3d_js]]
- [[_COMMUNITY_Single frontend_canvas2d_js|Single: frontend_canvas2d_js]]
- [[_COMMUNITY_Single frontend_state_js|Single: frontend_state_js]]
- [[_COMMUNITY_Single frontend_app_js|Single: frontend_app_js]]
- [[_COMMUNITY_Single frontend_diagrams_js|Single: frontend_diagrams_js]]
- [[_COMMUNITY_Single frontend_results_js|Single: frontend_results_js]]
- [[_COMMUNITY_Single setup_conda|Single: setup_conda]]
- [[_COMMUNITY_Single setup_ollama|Single: setup_ollama]]
- [[_COMMUNITY_Single setup_gunicorn|Single: setup_gunicorn]]
- [[_COMMUNITY_Single setup_docker|Single: setup_docker]]
- [[_COMMUNITY_Single setup_environment_yml|Single: setup_environment_yml]]
- [[_COMMUNITY_Single tools_truss_py|Single: tools_truss_py]]
- [[_COMMUNITY_Single tools_frame_py|Single: tools_frame_py]]
- [[_COMMUNITY_Single tools_column_py|Single: tools_column_py]]
- [[_COMMUNITY_Single tools_opensees_3d_py|Single: tools_opensees_3d_py]]
- [[_COMMUNITY_Single tools_report_py|Single: tools_report_py]]
- [[_COMMUNITY_Single tools_sections_py|Single: tools_sections_py]]

## God Nodes (most connected - your core abstractions)
1. `StructuralAgentSystem` - 43 edges
2. `byId()` - 41 edges
3. `BeamInputs` - 32 edges
4. `AgentResult` - 27 edges
5. `ConversationResult` - 25 edges
6. `PointLoad` - 24 edges
7. `analyze_beam()` - 24 edges
8. `ManagedAgent` - 23 edges
9. `ColumnInputs` - 20 edges
10. `TestLoadCombinations` - 20 edges

## Surprising Connections (you probably didn't know these)
- `ManagedAgent` --uses--> `OllamaClient`  [INFERRED]
  app\agents.py → app\llm.py
- `ManagedAgent` --uses--> `AgentTrace`  [INFERRED]
  app\agents.py → app\models.py
- `ManagedAgent` --uses--> `BeamInputs`  [INFERRED]
  app\agents.py → app\models.py
- `ManagedAgent` --uses--> `PointLoad`  [INFERRED]
  app\agents.py → app\models.py
- `AgentResult` --uses--> `OllamaClient`  [INFERRED]
  app\agents.py → app\llm.py

## Hyperedges (group relationships)
- **Structural Analysis Pipeline** — app_main, app_agents, app_models, app_routes_analyze [EXTRACTED 1.00]
- **Flask Blueprint Registration** — app_main, app_routes_analyze, app_routes_history, app_routes_pages, app_routes_sections [EXTRACTED 1.00]
- **3D Canvas Rendering Pipeline** — canvas3d_index_js, canvas3d_scene_js, canvas3d_render_js, canvas3d_interaction_js, canvas3d_ui_js [INFERRED 0.90]
- **Structural Element Analysis Tools** — beam_py, column_py, frame_py, truss_py [INFERRED 0.85]
- **Application Test Suite** — test_all_tools_py, test_beam_tool_py, test_flask_app_py [INFERRED 0.80]
- **Analysis Request Flow** — architecture_frontend, backend_main_py, backend_agents_py, tools_beam_py, architecture_sqlite [EXTRACTED 1.00]
- **Frontend Tabs** — index_chat_tab, index_draw_tab, index_sections_tab, index_history_tab [EXTRACTED 1.00]
- **LLM Clients** — readme_ollama, readme_pydanticai, backend_llm_py [EXTRACTED 1.00]

## Communities

### Community 0 - "Frontend 3D Canvas JS"
Cohesion: 0.06
Nodes (60): fitModelToCanvas(), initCanvas(), resizeCanvas(), addMemberDirect(), addNode(), getMousePos(), initInteraction(), onClick() (+52 more)

### Community 1 - "Agent Models & Schemas"
Cohesion: 0.12
Nodes (51): AgentResult, ConversationResult, ManagedAgent, Extract 3D structure inputs or use a default simple 3D frame., Extract truss inputs from prompt, or use a default example truss., Extract frame inputs or use a default portal frame., AnalyzeRequest, CanvasAction (+43 more)

### Community 2 - "Config & LLM Clients"
Cohesion: 0.06
Nodes (35): get_settings(), Settings, DisabledLLMClient, OllamaClient, _openai_compatible_url(), PydanticAIClient, PydanticAI adapter for Ollama's OpenAI-compatible chat endpoint., _analyze_structure_model() (+27 more)

### Community 3 - "Beam Analysis Tool"
Cohesion: 0.09
Nodes (28): BeamInputs, PointLoad, A single concentrated load on a beam., Tests for beam input validation., TestBeamInputValidation, test_simply_supported_udl_beam_results(), analyze_beam(), analyze_simply_supported_udl() (+20 more)

### Community 4 - "Multi-Agent System"
Cohesion: 0.14
Nodes (13): detect_analysis_type(), detect_support_type(), _find_number(), _find_optional_number(), Detect the type of structural analysis requested., Detect beam support conditions from text., StructuralAgentSystem, AgentTrace (+5 more)

### Community 5 - "Main Routes & Core Tools"
Cohesion: 0.09
Nodes (20): build_payload(), main(), print_response(), print_router_debug(), repl(), run_prompt(), analyze_frame(), _analyze_frame_direct_stiffness() (+12 more)

### Community 6 - "API & Results JS"
Cohesion: 0.12
Nodes (22): analyzeStructure(), exportCsv(), exportReport(), fetchSection(), jsonRequest(), searchSections(), sendChat(), formatBoolean() (+14 more)

### Community 7 - "Sections Tool"
Cohesion: 0.16
Nodes (16): Section library routes blueprint., section_detail(), sections_list(), _add(), _add_angle(), _add_hss(), get_section(), list_sections() (+8 more)

### Community 8 - "Load Combinations Tool"
Cohesion: 0.15
Nodes (10): load_combinations(), Return ASCE 7 factored load combinations for given load components., apply_load_combination(), get_controlling_combination(), LoadCombination, Apply a load combination to individual load components.          Returns the fac, Run all load combinations for given load components.          Args:         dl_k, Find the controlling (maximum absolute) load combination.          Args: (+2 more)

### Community 9 - "OpenSees Beam Solver"
Cohesion: 0.27
Nodes (9): test_opensees_simply_supported_udl_beam_results(), analyze_beam_opensees(), analyze_simply_supported_udl_opensees(), _build_node_positions(), _find_nearest_node(), OpenSeesPy beam model supporting multiple support types and load types., Build sorted list of node positions including endpoints, midspan, and point load, Find the 1-indexed node ID closest to target position. (+1 more)

### Community 10 - "Flask App Tests"
Cohesion: 0.24
Nodes (3): StubAgentSystem, test_chat_route_answers_greeting_with_llm(), test_chat_route_answers_structural_question_without_running_analysis()

### Community 11 - "Logging Config"
Cohesion: 0.25
Nodes (7): configure_logging(), get_logger(), Structured logging configuration for StructAgent., JSON-style structured log formatter., Set up root logger with structured output to stderr., Return a module-level logger., _StructuredFormatter

### Community 12 - "Pages Routes"
Cohesion: 0.4
Nodes (3): health(), Page + health routes blueprint., Enhanced health check — verifies DB and numpy/opensees availability.

### Community 13 - "3D Canvas Core Files"
Cohesion: 0.7
Nodes (5): canvas3d/index.js, canvas3d/interaction.js, canvas3d/render.js, canvas3d/scene.js, canvas3d/ui.js

### Community 15 - "Beam Analysis Docs"
Cohesion: 0.5
Nodes (4): Closed-Form Beam Calculations, OpenSeesPy, app/tools/beam.py - Beam Analysis Tool, app/tools/opensees_beam.py - OpenSeesPy Beam Solver

### Community 16 - "API Endpoints & Backend"
Cohesion: 0.5
Nodes (4): POST /api/analyze, POST /api/chat, Backend Layer, app/main.py - Flask Routes

### Community 17 - "App Initialization"
Cohesion: 1.0
Nodes (1): Structural analysis assistant application.

### Community 18 - "Tools Initialization"
Cohesion: 1.0
Nodes (1): Tool layer for deterministic engineering calculations.

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (2): Flask, StructAgent

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (2): Frontend Layer, StructAgent Web UI

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (2): Multi-Agent System, app/agents.py - Multi-Agent System

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (2): app/llm.py - LLM Clients, Ollama

### Community 47 - "Single: readme_pydanticai"
Cohesion: 1.0
Nodes (1): PydanticAI

### Community 48 - "Single: readme_simply_supported_beam"
Cohesion: 1.0
Nodes (1): Simply Supported Beam Analysis

### Community 49 - "Single: readme_markdown_report"
Cohesion: 1.0
Nodes (1): Markdown Report Generation

### Community 50 - "Single: readme_python312"
Cohesion: 1.0
Nodes (1): Python 3.12

### Community 51 - "Single: readme_conda"
Cohesion: 1.0
Nodes (1): Conda Environment

### Community 52 - "Single: index_plotly"
Cohesion: 1.0
Nodes (1): Plotly.js

### Community 53 - "Single: index_threejs"
Cohesion: 1.0
Nodes (1): Three.js

### Community 54 - "Single: index_orbitcontrols"
Cohesion: 1.0
Nodes (1): OrbitControls

### Community 55 - "Single: index_chat_tab"
Cohesion: 1.0
Nodes (1): Chat Tab

### Community 56 - "Single: index_draw_tab"
Cohesion: 1.0
Nodes (1): Draw Tab

### Community 57 - "Single: index_sections_tab"
Cohesion: 1.0
Nodes (1): Sections Tab

### Community 58 - "Single: index_history_tab"
Cohesion: 1.0
Nodes (1): History Tab

### Community 59 - "Single: index_3d_view"
Cohesion: 1.0
Nodes (1): 3D View

### Community 60 - "Single: api_analyze_structure_endpoint"
Cohesion: 1.0
Nodes (1): POST /api/analyze/structure

### Community 61 - "Single: api_sections_endpoint"
Cohesion: 1.0
Nodes (1): GET /api/sections

### Community 62 - "Single: api_history_endpoint"
Cohesion: 1.0
Nodes (1): GET /api/history

### Community 63 - "Single: api_export_csv_endpoint"
Cohesion: 1.0
Nodes (1): POST /api/export/csv

### Community 64 - "Single: api_export_report_endpoint"
Cohesion: 1.0
Nodes (1): POST /api/export/report

### Community 65 - "Single: api_health_endpoint"
Cohesion: 1.0
Nodes (1): GET /health

### Community 66 - "Single: architecture_layered_arch"
Cohesion: 1.0
Nodes (1): Layered Architecture

### Community 67 - "Single: architecture_solvers"
Cohesion: 1.0
Nodes (1): Deterministic Solvers

### Community 68 - "Single: architecture_sqlite"
Cohesion: 1.0
Nodes (1): SQLite History DB

### Community 69 - "Single: architecture_pydantic"
Cohesion: 1.0
Nodes (1): Pydantic Validation

### Community 70 - "Single: architecture_fallback_chain"
Cohesion: 1.0
Nodes (1): Solver Fallback Chain

### Community 71 - "Single: backend_models_py"
Cohesion: 1.0
Nodes (1): app/models.py - Pydantic Schemas

### Community 72 - "Single: backend_config_py"
Cohesion: 1.0
Nodes (1): app/config.py - Settings

### Community 73 - "Single: backend_conversation_agent"
Cohesion: 1.0
Nodes (1): Conversation Agent

### Community 74 - "Single: backend_intent_agent"
Cohesion: 1.0
Nodes (1): Intent Agent

### Community 75 - "Single: backend_planning_agent"
Cohesion: 1.0
Nodes (1): Planning Agent

### Community 76 - "Single: backend_canvas_router_agent"
Cohesion: 1.0
Nodes (1): Canvas Router Agent

### Community 77 - "Single: frontend_index_html"
Cohesion: 1.0
Nodes (1): app/static/index.html - App Shell

### Community 78 - "Single: frontend_styles_css"
Cohesion: 1.0
Nodes (1): app/static/css/styles.css - Main Stylesheet

### Community 79 - "Single: frontend_theme_js"
Cohesion: 1.0
Nodes (1): app/static/js/theme.js - Theme Management

### Community 80 - "Single: frontend_canvas3d_js"
Cohesion: 1.0
Nodes (1): app/static/js/canvas3d.js - Three.js 3D Canvas

### Community 81 - "Single: frontend_canvas2d_js"
Cohesion: 1.0
Nodes (1): app/static/js/canvas2d.js - 2D Drawing Canvas

### Community 82 - "Single: frontend_state_js"
Cohesion: 1.0
Nodes (1): app/static/js/state.js - State Management

### Community 83 - "Single: frontend_app_js"
Cohesion: 1.0
Nodes (1): app/static/js/app.js - Main Controller

### Community 84 - "Single: frontend_diagrams_js"
Cohesion: 1.0
Nodes (1): app/static/js/diagrams.js - Plotly Diagrams

### Community 85 - "Single: frontend_results_js"
Cohesion: 1.0
Nodes (1): app/static/js/results.js - Results Rendering

### Community 86 - "Single: setup_conda"
Cohesion: 1.0
Nodes (1): Conda Environment

### Community 87 - "Single: setup_ollama"
Cohesion: 1.0
Nodes (1): Ollama Setup

### Community 88 - "Single: setup_gunicorn"
Cohesion: 1.0
Nodes (1): Gunicorn Production Server

### Community 89 - "Single: setup_docker"
Cohesion: 1.0
Nodes (1): Docker Deployment

### Community 90 - "Single: setup_environment_yml"
Cohesion: 1.0
Nodes (1): environment.yml - Conda Dependencies

### Community 91 - "Single: tools_truss_py"
Cohesion: 1.0
Nodes (1): app/tools/truss.py - Truss Analysis Tool

### Community 92 - "Single: tools_frame_py"
Cohesion: 1.0
Nodes (1): app/tools/frame.py - Frame Analysis Tool

### Community 93 - "Single: tools_column_py"
Cohesion: 1.0
Nodes (1): app/tools/column.py - Column Analysis Tool

### Community 94 - "Single: tools_opensees_3d_py"
Cohesion: 1.0
Nodes (1): app/tools/opensees_3d.py - 3D Structure Analysis Tool

### Community 95 - "Single: tools_report_py"
Cohesion: 1.0
Nodes (1): app/tools/report.py - Report Formatter

### Community 96 - "Single: tools_sections_py"
Cohesion: 1.0
Nodes (1): app/tools/sections.py - Steel Section Database

## Knowledge Gaps
- **130 isolated node(s):** `Detect the type of structural analysis requested.`, `Detect beam support conditions from text.`, `Extract 3D structure inputs or use a default simple 3D frame.`, `Extract truss inputs from prompt, or use a default example truss.`, `Extract frame inputs or use a default portal frame.` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Initialization`** (2 nodes): `__init__.py`, `Structural analysis assistant application.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tools Initialization`** (2 nodes): `__init__.py`, `Tool layer for deterministic engineering calculations.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `Flask`, `StructAgent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `Frontend Layer`, `StructAgent Web UI`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `Multi-Agent System`, `app/agents.py - Multi-Agent System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `app/llm.py - LLM Clients`, `Ollama`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: readme_pydanticai`** (1 nodes): `PydanticAI`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: readme_simply_supported_beam`** (1 nodes): `Simply Supported Beam Analysis`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: readme_markdown_report`** (1 nodes): `Markdown Report Generation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: readme_python312`** (1 nodes): `Python 3.12`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: readme_conda`** (1 nodes): `Conda Environment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: index_plotly`** (1 nodes): `Plotly.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: index_threejs`** (1 nodes): `Three.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: index_orbitcontrols`** (1 nodes): `OrbitControls`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: index_chat_tab`** (1 nodes): `Chat Tab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: index_draw_tab`** (1 nodes): `Draw Tab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: index_sections_tab`** (1 nodes): `Sections Tab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: index_history_tab`** (1 nodes): `History Tab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: index_3d_view`** (1 nodes): `3D View`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: api_analyze_structure_endpoint`** (1 nodes): `POST /api/analyze/structure`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: api_sections_endpoint`** (1 nodes): `GET /api/sections`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: api_history_endpoint`** (1 nodes): `GET /api/history`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: api_export_csv_endpoint`** (1 nodes): `POST /api/export/csv`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: api_export_report_endpoint`** (1 nodes): `POST /api/export/report`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: api_health_endpoint`** (1 nodes): `GET /health`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: architecture_layered_arch`** (1 nodes): `Layered Architecture`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: architecture_solvers`** (1 nodes): `Deterministic Solvers`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: architecture_sqlite`** (1 nodes): `SQLite History DB`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: architecture_pydantic`** (1 nodes): `Pydantic Validation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: architecture_fallback_chain`** (1 nodes): `Solver Fallback Chain`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: backend_models_py`** (1 nodes): `app/models.py - Pydantic Schemas`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: backend_config_py`** (1 nodes): `app/config.py - Settings`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: backend_conversation_agent`** (1 nodes): `Conversation Agent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: backend_intent_agent`** (1 nodes): `Intent Agent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: backend_planning_agent`** (1 nodes): `Planning Agent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: backend_canvas_router_agent`** (1 nodes): `Canvas Router Agent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_index_html`** (1 nodes): `app/static/index.html - App Shell`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_styles_css`** (1 nodes): `app/static/css/styles.css - Main Stylesheet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_theme_js`** (1 nodes): `app/static/js/theme.js - Theme Management`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_canvas3d_js`** (1 nodes): `app/static/js/canvas3d.js - Three.js 3D Canvas`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_canvas2d_js`** (1 nodes): `app/static/js/canvas2d.js - 2D Drawing Canvas`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_state_js`** (1 nodes): `app/static/js/state.js - State Management`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_app_js`** (1 nodes): `app/static/js/app.js - Main Controller`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_diagrams_js`** (1 nodes): `app/static/js/diagrams.js - Plotly Diagrams`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: frontend_results_js`** (1 nodes): `app/static/js/results.js - Results Rendering`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: setup_conda`** (1 nodes): `Conda Environment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: setup_ollama`** (1 nodes): `Ollama Setup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: setup_gunicorn`** (1 nodes): `Gunicorn Production Server`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: setup_docker`** (1 nodes): `Docker Deployment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: setup_environment_yml`** (1 nodes): `environment.yml - Conda Dependencies`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: tools_truss_py`** (1 nodes): `app/tools/truss.py - Truss Analysis Tool`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: tools_frame_py`** (1 nodes): `app/tools/frame.py - Frame Analysis Tool`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: tools_column_py`** (1 nodes): `app/tools/column.py - Column Analysis Tool`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: tools_opensees_3d_py`** (1 nodes): `app/tools/opensees_3d.py - 3D Structure Analysis Tool`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: tools_report_py`** (1 nodes): `app/tools/report.py - Report Formatter`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Single: tools_sections_py`** (1 nodes): `app/tools/sections.py - Steel Section Database`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StructuralAgentSystem` connect `Multi-Agent System` to `Agent Models & Schemas`, `Config & LLM Clients`, `Beam Analysis Tool`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `BeamInputs` connect `Beam Analysis Tool` to `Agent Models & Schemas`, `Multi-Agent System`, `OpenSees Beam Solver`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `_get_agent_system()` connect `Config & LLM Clients` to `Multi-Agent System`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `StructuralAgentSystem` (e.g. with `OllamaClient` and `AgentTrace`) actually correct?**
  _`StructuralAgentSystem` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `byId()` (e.g. with `initAnalysis()` and `runAnalysis()`) actually correct?**
  _`byId()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `BeamInputs` (e.g. with `ManagedAgent` and `AgentResult`) actually correct?**
  _`BeamInputs` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `AgentResult` (e.g. with `OllamaClient` and `AgentTrace`) actually correct?**
  _`AgentResult` has 21 INFERRED edges - model-reasoned connections that need verification._