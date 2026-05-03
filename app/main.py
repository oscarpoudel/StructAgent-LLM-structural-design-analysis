"""Flask application factory."""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

from flask import Flask

from app.config import get_settings
from app.llm import DisabledLLMClient, OllamaClient, PydanticAIClient
from app.logging_config import configure_logging, get_logger
from app.models import (
    AnalyzeResponse, TrussInputs, FrameInputs,
)
from app.agents import StructuralAgentSystem
from app.tools.report import format_engineering_report

configure_logging()
log = get_logger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR.parent / "analysis_history.db"


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _init_db() -> None:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            analysis_type TEXT NOT NULL,
            prompt TEXT NOT NULL,
            results_json TEXT NOT NULL,
            report_markdown TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def _save_history(analysis_type: str, prompt: str, results: dict, report: str) -> int:
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.execute(
        "INSERT INTO history (timestamp, analysis_type, prompt, results_json, report_markdown) VALUES (?, ?, ?, ?, ?)",
        (time.time(), analysis_type, prompt, json.dumps(results, default=str), report),
    )
    row_id = cur.lastrowid
    conn.commit()
    conn.close()
    return row_id


def _get_history(limit: int = 50) -> list[dict]:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, timestamp, analysis_type, prompt, results_json, report_markdown "
        "FROM history ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _get_history_item(item_id: int) -> dict | None:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id, timestamp, analysis_type, prompt, results_json, report_markdown "
        "FROM history WHERE id = ?",
        (item_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Agent / analysis helpers
# ---------------------------------------------------------------------------

def _get_agent_system() -> StructuralAgentSystem:
    settings = get_settings()
    provider = settings.agent_llm_provider.lower()
    if provider == "none":
        llm = DisabledLLMClient()
    elif provider == "pydanticai":
        try:
            llm = PydanticAIClient(settings.ollama_base_url, settings.ollama_model)
        except Exception:
            llm = OllamaClient(settings.ollama_base_url, settings.ollama_model, settings.agent_llm_timeout_s)
    else:
        llm = OllamaClient(settings.ollama_base_url, settings.ollama_model, settings.agent_llm_timeout_s)
    return StructuralAgentSystem(llm, agent_timeout_s=settings.agent_llm_timeout_s)


def _build_analysis_response(prompt: str) -> AnalyzeResponse:
    t0 = time.perf_counter()
    log.info("analysis_start", extra={"prompt_len": len(prompt)})
    result = _get_agent_system().analyze(prompt)
    diagrams = getattr(result, "_diagrams", None)
    response = AnalyzeResponse(
        status="ok",
        analysis_type=result.analysis_type,
        assumptions=result.assumptions,
        warnings=result.warnings,
        traces=result.traces,
        results=result.results,
        report_markdown=result.report_markdown,
        diagrams=diagrams,
    )
    _save_history(result.analysis_type, prompt, result.results, result.report_markdown)
    log.info("analysis_done", extra={"type": result.analysis_type, "elapsed_s": round(time.perf_counter() - t0, 3)})
    return response


def _analyze_structure_model(analysis_type: str, model: dict) -> tuple[dict, str]:
    if analysis_type == "truss":
        from app.tools.truss import analyze_truss as run_truss
        inputs = TrussInputs.model_validate(model)
        results = run_truss(inputs)
        report_md = format_engineering_report(
            "Canvas-drawn truss structure",
            ["Preliminary elastic analysis.", "All joints pin-connected."],
            [], results, analysis_type="truss",
        )
    else:
        from app.tools.frame import analyze_frame as run_frame
        inputs = FrameInputs.model_validate(model)
        results = run_frame(inputs)
        report_md = format_engineering_report(
            "Canvas-drawn frame structure",
            ["Preliminary elastic analysis.", "Rigid beam-column connections."],
            [], results, analysis_type="frame",
        )
    _save_history(analysis_type, f"Canvas {analysis_type}", results, report_md)
    return results, report_md


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> Flask:
    settings = get_settings()
    _init_db()

    app = Flask(
        __name__,
        static_folder=str(BASE_DIR / "static"),
        static_url_path="/static",
    )
    app.config["JSON_SORT_KEYS"] = False
    app.secret_key = settings.app_secret_key

    # Wire blueprint dependencies before registering
    from app.routes import analyze as analyze_bp_mod
    analyze_bp_mod._get_agent_system = _get_agent_system
    analyze_bp_mod._save_history = _save_history
    analyze_bp_mod._build_analysis_response = _build_analysis_response
    analyze_bp_mod._analyze_structure_model = _analyze_structure_model

    from app.routes import history as history_bp_mod
    history_bp_mod._get_history = _get_history
    history_bp_mod._get_history_item = _get_history_item

    from app.routes import pages as pages_bp_mod
    pages_bp_mod._db_path = DB_PATH
    pages_bp_mod._static_dir = BASE_DIR / "static"

    # Register blueprints
    from app.routes.analyze import bp as analyze_bp
    from app.routes.history import bp as history_bp
    from app.routes.sections import bp as sections_bp
    from app.routes.pages import bp as pages_bp

    app.register_blueprint(analyze_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(sections_bp)
    app.register_blueprint(pages_bp)

    log.info("struct_agent_starting", extra={"env": settings.app_env})
    return app


# Expose a module-level app instance for Waitress / legacy `flask run`
app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
