# Setup and Configuration Guide

## Prerequisites

- **Python 3.12+** (project uses Python 3.12.12)
- **Conda** (for environment management) or **pip** (for direct installation)
- **Ollama** (optional, for LLM-powered features) running on accessible server
- **Git** (for cloning the repository)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd struct_analysis
```

### 2. Create Conda Environment

```bash
conda env create -f environment.yml
conda activate struct_analysis
```

This installs all dependencies including:
- Flask 3.1.1
- OpenSeesPy 4.3.3
- Pydantic 2.11.7
- PydanticAI 0.0.33
- NumPy 2.3.2
- SciPy 1.16.2
- Waitress 3.0.2
- python-dotenv 1.1.1

### 3. Alternative: pip Installation

```bash
python -m venv venv
# On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure Environment

Copy the example environment file and customize:

```bash
cp .env.example .env
```

Edit .env with your settings:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:latest

# Agent LLM Provider: ollama, ollamai, or none
AGENT_LLM_PROVIDER=ollama
AGENT_LLM_TIMEOUT_S=8.0

# Application Settings
APP_ENV=development
APP_SECRET_KEY=change-me-before-deploy
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| OLLAMA_BASE_URL | http://128.235.163.220:11434 | URL of Ollama server |
| OLLAMA_MODEL | gemma4:latest | Model name for LLM calls |
| AGENT_LLM_PROVIDER | ollama | LLM provider: `ollama`, `ollamai`, or `none` |
| AGENT_LLM_TIMEOUT_S | 8.0 | Timeout in seconds for LLM calls |
| APP_ENV | development | Application environment |
| APP_SECRET_KEY | change-me-before-deploy | Flask secret key (change for production) |

## Running the Application

### Development Mode

```bash
python -m flask --app app.main run
```

Do NOT use `--debug` flag — the debug reloader may not pick up new route files. The application will be available at `http://localhost:5000`.

### Production Mode with Waitress (Windows)

```bash
waitress-serve --port 5000 app.main:get_app()
```

### Production Mode with Gunicorn (Linux/Mac)

```bash
gunicorn --bind 0.0.0.0:5000 --workers 4 --timeout 120 'app.main:get_app()'
```

### Docker (if Dockerfile exists)

```bash
docker build -t struct_analysis .
docker run -p 5000:5000 --env-file .env struct_analysis
```

## Ollama Setup

### Local Ollama Server

1. Install Ollama from https://ollama.ai
2. Pull the required model:

```bash
ollama pull gemma4:latest
```

3. Start the Ollama server (runs on `http://localhost:11434` by default)

### Remote Ollama Server

If using a remote Ollama server:
1. Ensure the server is accessible from your application
2. Set `OLLAMA_BASE_URL` to the remote server address
3. Ensure the required model is pulled on the remote server

### LLM Provider Options

- **ollama**: Direct HTTP calls to Ollama `/api/generate` endpoint
- **ollamai**: Uses Ollama Python library with OpenAI-compatible `/v1` endpoint (better structured output support)
- **none**: Disables LLM features, uses deterministic fallbacks only

## Running Tests

On Windows, set PYTHONPATH and run pytest:

```powershell
$env:PYTHONPATH='.'; pytest
```

### Test Coverage

16 integration tests covering:
- Chat route: analysis requests, conversation-only, canvas actions, context-aware queries, evaluate endpoint
- Project persistence: CRUD operations
- LLM status: response format
- Context-aware chat: model summarization
- 3D frame template canvas action

## Project Structure

```
struct_analysis/
├── app/
│   ├── __init__.py
│   ├── main.py              # Flask app factory, DB init, blueprint wiring
│   ├── config.py            # Settings and configuration
│   ├── models.py            # Pydantic request/response schemas
│   ├── agents.py            # Multi-agent system orchestration
│   ├── llm.py               # LLM client implementations
│   ├── logging_config.py    # Structured logging setup
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── pages.py         # Static page routes
│   │   ├── analyze.py       # Analysis & chat API routes
│   │   ├── projects.py      # Project CRUD API routes
│   │   ├── history.py       # History & export API routes
│   │   └── sections.py      # Steel section database routes
│   ├── tools/               # Engineering analysis tools
│   │   ├── __init__.py
│   │   ├── beam.py          # Closed-form beam analysis
│   │   ├── opensees_beam.py # OpenSeesPy beam solver
│   │   ├── truss.py         # Truss analysis (matrix stiffness)
│   │   ├── frame.py         # 2D frame analysis (OpenSeesPy)
│   │   ├── column.py        # Column buckling analysis
│   │   ├── opensees_3d.py   # 3D structure analysis
│   │   ├── load_combinations.py  # ASCE 7 load combinations
│   │   ├── sections.py      # Steel section database
│   │   └── report.py        # Report formatter
│   └── static/              # Frontend assets
│       ├── index.html       # Application shell
│       ├── styles.css       # Complete design system
│       └── js/              # JavaScript modules
│           ├── chat.js, analysis.js, main.js, ...
│           └── canvas3d/    # Three.js 3D canvas modules
├── scripts/
│   └── debug_chat.py        # CLI debug tool for chat/analysis
├── docs/                    # Documentation
│   ├── API.md, ARCHITECTURE.md, BACKEND.md, FRONTEND.md, SETUP.md, TOOLS.md
├── demo_images/             # Screenshots for README
├── environment.yml          # Conda environment definition
├── .env.example             # Environment variable template
├── .gitignore               # Git ignore rules
├── LICENSE                  # PolyForm Noncommercial 1.0.0
└── README.md               # Project overview
```

## Troubleshooting

### OpenSeesPy Import Error

If you encounter OpenSeesPy import errors:
1. Ensure OpenSeesPy is installed: `pip install openseespy`
2. On Windows, you may need Visual C++ Redistributable
3. Check that your Python version is compatible (3.12+)

### LLM Connection Timeout

If LLM calls timeout:
1. Verify Ollama server is running: `curl http://localhost:11434/api/tags`
2. Check `OLLAMA_BASE_URL` is correct
3. Increase `AGENT_LLM_TIMEOUT_S` if needed
4. Try switching to `ollamai` provider

### SQLite Database Lock

If you encounter database lock errors:
1. Ensure no other process is accessing the database files
2. Delete `analysis_history.db` or `projects.db` to start fresh (history will be lost)
3. In production, consider using a proper database

### Port Already in Use

If port 5000 is already in use:
1. Change the port: `python -m flask --app app.main run --port 8080`
2. Or find and kill the process using the port
