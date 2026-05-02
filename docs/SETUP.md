# Setup and Configuration Guide

## Prerequisites

- **Python 3.12+** (project uses Python 3.12.12)
- **Conda** (for environment management) or **pip** (for direct installation)
- **Ollama** (optional, for LLM-powered features) running on accessible server
- **Git** (for cloning the repository)

## Installation

### 1. Clone the Repository

\\\ash
git clone <repository-url>
cd struct_analysis
\\\

### 2. Create Conda Environment

\\\ash
conda env create -f environment.yml
conda activate struct_analysis
\\\

This installs all dependencies including:
- Flask 3.1.1
- OpenSeesPy 4.3.3
- Pydantic 2.11.7
- PydanticAI 0.0.33
- NumPy 2.3.2
- SciPy 1.16.2
- gunicorn 23.0.0
- python-dotenv 1.1.1

### 3. Alternative: pip Installation

\\\ash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
\\\

### 4. Configure Environment

Copy the example environment file and customize:

\\\ash
cp .env.example .env
\\\

Edit .env with your settings:

\\\env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=glm-4.7-flash:latest

# Agent LLM Provider: ollama, pydanticai, or none
AGENT_LLM_PROVIDER=ollama
AGENT_LLM_TIMEOUT_S=8.0

# Application Settings
APP_ENV=development
APP_SECRET_KEY=change-me-before-deploy
\\\

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| OLLAMA_BASE_URL | http://128.235.163.220:11434 | URL of Ollama server |
| OLLAMA_MODEL | glm-4.7-flash:latest | Model name for LLM calls |
| AGENT_LLM_PROVIDER | ollama | LLM provider: \ollama\, \pydanticai\, or \
one\ |
| AGENT_LLM_TIMEOUT_S | 8.0 | Timeout in seconds for LLM calls |
| APP_ENV | development | Application environment |
| APP_SECRET_KEY | change-me-before-deploy | Flask secret key (change for production) |

## Running the Application

### Development Mode

\\\ash
python -m app.main
\\\

The application will be available at \http://localhost:5000\.

### Production Mode with Gunicorn

\\\ash
gunicorn --bind 0.0.0.0:5000 --workers 4 --timeout 120 'app.main:get_app()'
\\\

### Docker (if Dockerfile exists)

\\\ash
docker build -t struct_analysis .
docker run -p 5000:5000 --env-file .env struct_analysis
\\\

## Ollama Setup

### Local Ollama Server

1. Install Ollama from https://ollama.ai
2. Pull the required model:

\\\ash
ollama pull glm-4.7-flash:latest
\\\

3. Start the Ollama server (runs on \http://localhost:11434\ by default)

### Remote Ollama Server

If using a remote Ollama server:
1. Ensure the server is accessible from your application
2. Set \OLLAMA_BASE_URL\ to the remote server address
3. Ensure the required model is pulled on the remote server

### LLM Provider Options

- **ollama**: Direct HTTP calls to Ollama \/api/generate\ endpoint
- **pydanticai**: Uses PydanticAI library with Ollama via OpenAI-compatible \/v1\ endpoint
- **none**: Disables LLM features, uses deterministic fallbacks only

## Project Structure

\\\
struct_analysis/
├── app/
│   ├── __init__.py
│   ├── main.py              # Flask application entry point
│   ├── config.py            # Settings and configuration
│   ├── models.py            # Pydantic request/response schemas
│   ├── agents.py            # Multi-agent system orchestration
│   ├── llm.py               # LLM client implementations
│   ├── tools/               # Engineering analysis tools
│   │   ├── __init__.py
│   │   ├── beam.py          # Closed-form beam analysis
│   │   ├── opensees_beam.py # OpenSeesPy beam solver
│   │   ├── truss.py         # Truss analysis (matrix stiffness)
│   │   ├── frame.py         # 2D frame analysis (OpenSeesPy)
│   │   ├── column.py        # Column buckling analysis
│   │   ├── opensees_3d.py   # 3D structure analysis
│   │   ├── sections.py      # Steel section database
│   │   └── report.py        # Report formatter
│   └── static/              # Frontend assets
│       ├── index.html       # Application shell
│       ├── css/             # Stylesheets
│       └── js/              # JavaScript modules
├── docs/                    # Documentation
├── environment.yml          # Conda environment definition
├── .env.example             # Environment variable template
├── .gitignore               # Git ignore rules
├── LICENSE                  # PolyForm Noncommercial 1.0.0
└── README.md               # Project overview
\\\

## Troubleshooting

### OpenSeesPy Import Error

If you encounter OpenSeesPy import errors:
1. Ensure OpenSeesPy is installed: \pip install openseespy\
2. On Windows, you may need Visual C++ Redistributable
3. Check that your Python version is compatible (3.12+)

### LLM Connection Timeout

If LLM calls timeout:
1. Verify Ollama server is running: \curl http://localhost:11434/api/tags\
2. Check \OLLAMA_BASE_URL\ is correct
3. Increase \AGENT_LLM_TIMEOUT_S\ if needed
4. Try switching to \pydanticai\ provider

### SQLite Database Lock

If you encounter database lock errors:
1. Ensure no other process is accessing \nalysis_history.db\
2. Delete the database file to start fresh (history will be lost)
3. In production, consider using a proper database

### Port Already in Use

If port 5000 is already in use:
1. Change the port: \lask run --port 8080\
2. Or find and kill the process using the port