# StructAgent - Architecture Overview

## Project Summary

**StructAgent** is a Flask-based structural analysis assistant that combines multi-agent LLM workflows with deterministic engineering solvers (closed-form equations and OpenSeesPy FEM). It provides a web UI for conversational structural analysis, interactive 3D canvas drawing, and automated engineering reports.

**Scope:** Preliminary elastic analysis only. Not for licensed professional design.

**License:** PolyForm Noncommercial 1.0.0

## High-Level Architecture

The application follows a layered architecture with clear separation between frontend, backend routing, agent orchestration, and deterministic solvers.

`
+------------------------------------------------------------------+
|                        Frontend (Vanilla JS)                      |
|  +----------+  +----------+  +----------+  +----------+          |
|  |  Chat    |  |  3D      |  | Results  |  | Sections |          |
|  |  Tab     |  |  Canvas  |  | Tab      |  | Tab      |          |
|  +----+-----+  +----+-----+  +----+-----+  +----+-----+          |
|       |              |              |              |               |
|  +----+--------------+--------------+--------------+-----+        |
|  |              State Manager (state.js)                         |
|  +---------------------------------------------------------------+
+-----------------------------+-------------------------------------+
                              | HTTP/JSON
+-----------------------------+-------------------------------------+
|                      Backend (Flask)                               |
|  +-------------+  +-------------+  +----------------------------+ |
|  |  Routes     |  | Agent System|  |  Engineering Tools         | |
|  |  (main.py) |-| (agents.py)  |  |  (tools/*.py)              | |
|  +-----+------+  +------+------|  +----------------------------+ |
|        |               |                                            |
|  +-----+------+  +-----+------+  +----------------------------+  |
|  | SQLite DB  |  | LLM Client  |  | Section Database           |  |
|  | (history)  |  | (llm.py)    |  | (sections.py)              |  |
|  +------------+  +-------------+  +----------------------------+  |
+-------------------------------------------------------------------+
`

## Component Map

| Layer | File(s) | Responsibility |
|-------|---------|----------------|
| **Entry** | pp/main.py | Flask app, routes, SQLite history, agent initialization |
| **Agents** | pp/agents.py | Multi-agent routing, intent detection, analysis pipelines |
| **Models** | pp/models.py | Pydantic schemas for all inputs/outputs |
| **LLM** | pp/llm.py | Ollama, PydanticAI, and disabled LLM clients |
| **Config** | pp/config.py | PydanticSettings from .env |
| **Beam Solver** | pp/tools/beam.py | Closed-form beam analysis (4 support types) |
| **Beam FEM** | pp/tools/opensees_beam.py | OpenSeesPy beam with cross-validation |
| **Truss** | pp/tools/truss.py | OpenSeesPy truss + direct stiffness fallback |
| **Frame** | pp/tools/frame.py | OpenSeesPy frame + direct stiffness fallback |
| **Column** | pp/tools/column.py | Euler buckling + AISC Chapter E |
| **3D Frame** | pp/tools/opensees_3d.py | OpenSeesPy 3D (ndm=3, ndf=6) |
| **Reports** | pp/tools/report.py | Markdown engineering report formatter |
| **Sections** | pp/tools/sections.py | AISC W-shape, HSS, Angle database |
| **Frontend** | pp/static/ | HTML, CSS, vanilla JS |

## Data Flow

### Analysis Request Flow
1. User types prompt in chat or analysis tab
2. Frontend sends POST /api/chat or POST /api/analyze
3. main.py validates request with Pydantic schemas
4. gents.py detects analysis type (beam/truss/frame/column/3d)
5. Intent agent extracts parameters from natural language
6. Planning agent selects solver
7. Input extraction converts text to structured Pydantic models
8. Solver tool runs (OpenSeesPy or closed-form)
9. Critic agent validates results
10. Report formatter generates markdown
11. Results saved to SQLite history
12. Response returned to frontend

### Canvas Drawing Flow
1. User draws structure on 3D canvas (Three.js)
2. State manager tracks nodes, members, supports, loads
3. User clicks Analyze or types analysis command
4. Frontend sends POST /api/analyze/structure with model data
5. Backend validates with TrussInputs or FrameInputs
6. Solver runs directly on canvas model
7. Results displayed in results tab

## Key Design Decisions

1. **Deterministic-first:** Solvers use closed-form equations and FEM, not LLM-generated numbers
2. **LLM for routing only:** LLM handles intent detection, parameter extraction, and conversation
3. **Fallback chains:** OpenSeesPy -> direct stiffness -> closed-form, ensuring analysis always runs
4. **Pydantic validation:** All inputs validated before reaching solvers
5. **SQLite history:** All analyses persisted for traceability
6. **Canvas integration:** Drawing produces analyzable models, bridging visual and computational workflows