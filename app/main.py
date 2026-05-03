from __future__ import annotations

import csv
import io
import json
import sqlite3
import time
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, Response
from pydantic import ValidationError

from app.agents import StructuralAgentSystem, detect_analysis_type
from app.config import get_settings
from app.llm import DisabledLLMClient, OllamaClient, PydanticAIClient
from app.logging_config import configure_logging, get_logger
from app.models import (
    AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse,
    TrussInputs, TrussNode, TrussMember, TrussLoad,
    FrameInputs, FrameNode, FrameMember, FrameLoad, FrameMemberLoad,
    BeamInputs, PointLoad, ColumnInputs, DiagramData, AgentTrace, CanvasAction,
)
from app.tools.load_combinations import run_all_load_combinations, get_controlling_combination
from app.tools.report import format_engineering_report
from app.tools.sections import get_section, list_sections, search_sections, section_to_dict

configure_logging()
log = get_logger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR.parent / "analysis_history.db"

app = Flask(
    __name__,
    static_folder=str(BASE_DIR / "static"),
    static_url_path="/static",
)
app.config["JSON_SORT_KEYS"] = False


# ---------------------------------------------------------------------------
# SQLite history
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


_init_db()


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
        "SELECT id, timestamp, analysis_type, prompt, results_json, report_markdown FROM history ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _get_history_item(item_id: int) -> dict | None:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id, timestamp, analysis_type, prompt, results_json, report_markdown FROM history WHERE id = ?",
        (item_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# LLM / Agent setup
# ---------------------------------------------------------------------------

def get_agent_system() -> StructuralAgentSystem:
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


def build_analysis_response(prompt: str) -> AnalyzeResponse:
    t0 = time.perf_counter()
    log.info("analysis_start", extra={"prompt_len": len(prompt)})
    result = get_agent_system().analyze(prompt)

    # Extract diagram data if available
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

    # Save to history
    _save_history(result.analysis_type, prompt, result.results, result.report_markdown)
    elapsed = round(time.perf_counter() - t0, 3)
    log.info("analysis_done", extra={"type": result.analysis_type, "elapsed_s": elapsed})
    return response


def is_structural_analysis_request(message: str) -> bool:
    text = message.lower()
    conversational_starts = [
        "hi", "hello", "hey", "what is", "what are", "how do", "how can",
        "why", "explain", "define", "tell me about", "help me",
    ]
    if any(text.startswith(term) for term in conversational_starts):
        return False

    analysis_phrases = [
        "run analysis", "run the analysis", "perform analysis", "perform an analysis",
        "do analysis", "solve", "calculate", "compute", "evaluate",
        "analyze", "analyse", "check",
    ]
    structural_terms = [
        "beam", "column", "frame", "truss", "load", "span", "moment",
        "shear", "deflection", "stress", "opensees", "kn", "gpa", "m4",
        "l/", "buckling", "euler", "slenderness", "cantilever", "fixed",
        "portal", "axial", "drawing", "drawn", "canvas", "model", "structure", "analysis",
    ]
    return any(term in text for term in analysis_phrases) and any(term in text for term in structural_terms)


def is_drawing_analysis_request(message: str) -> bool:
    text = message.lower()
    drawing_terms = ["drawing", "drawn", "canvas", "model", "current structure", "this structure", "sketch"]
    terse_analysis_terms = ["perform analysis", "run analysis", "run the analysis", "analyze it", "analyse it", "analyze this"]
    return any(term in text for term in drawing_terms) or any(term in text for term in terse_analysis_terms)


def has_drawn_structure(model: dict | None) -> bool:
    if not model:
        return False
    return len(model.get("nodes", [])) >= 2 and len(model.get("members", [])) >= 1


def analyze_structure_model(analysis_type: str, model: dict) -> tuple[dict, str]:
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
# Routes: Pages
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return send_from_directory(BASE_DIR / "static", "index.html")


@app.get("/health")
def health():
    """Enhanced health check — verifies DB and numpy/opensees availability."""
    checks: dict[str, str] = {}

    # DB check
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("SELECT 1")
        conn.close()
        checks["db"] = "ok"
    except Exception as exc:
        checks["db"] = f"error: {exc}"

    # Numpy check
    try:
        import numpy as np  # noqa: F401
        checks["numpy"] = "ok"
    except ImportError:
        checks["numpy"] = "unavailable"

    # OpenSeesPy check (optional)
    try:
        import openseespy.opensees  # noqa: F401
        checks["opensees"] = "ok"
    except Exception:
        checks["opensees"] = "unavailable"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    status_code = 200 if overall == "ok" else 503
    return jsonify({"status": overall, "checks": checks}), status_code


# ---------------------------------------------------------------------------
# Routes: Analysis
# ---------------------------------------------------------------------------

@app.post("/api/load-combinations")
def load_combinations():
    """Return ASCE 7 factored load combinations for given load components."""
    data = request.get_json(silent=True) or {}
    try:
        dl = float(data.get("dl_kn", 0.0))
        ll = float(data.get("ll_kn", 0.0))
        wl = float(data.get("wl_kn", 0.0))
        sl = float(data.get("sl_kn", 0.0))
        el = float(data.get("el_kn", 0.0))
        method = str(data.get("method", "lrfd")).lower()
        if method not in ("lrfd", "asd"):
            method = "lrfd"
    except (TypeError, ValueError) as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400

    all_combos = run_all_load_combinations(dl, ll, wl, sl, el, method=method)
    controlling = get_controlling_combination(dl, ll, wl, sl, el, method=method)
    return jsonify({
        "status": "ok",
        "method": method,
        "combinations": all_combos,
        "controlling": controlling,
    })


@app.post("/api/validate")
def validate_model():
    """Validate a structural model payload without running analysis."""
    data = request.get_json(silent=True) or {}
    analysis_type = data.get("analysis_type", "frame")
    model = data.get("model", {})
    errors: list[str] = []
    warnings_out: list[str] = []

    try:
        if analysis_type == "truss":
            parsed = TrussInputs.model_validate(model)
            if len(parsed.nodes) < 2:
                errors.append("Truss requires at least 2 nodes.")
            if len(parsed.members) < 1:
                errors.append("Truss requires at least 1 member.")
            supported = [n for n in parsed.nodes if n.support != "free"]
            if len(supported) < 2:
                warnings_out.append("Truss needs at least 2 supported nodes to be statically determinate.")
        else:
            parsed = FrameInputs.model_validate(model)
            if len(parsed.nodes) < 2:
                errors.append("Frame requires at least 2 nodes.")
            if len(parsed.members) < 1:
                errors.append("Frame requires at least 1 member.")
            supported = [n for n in parsed.nodes if n.support != "free"]
            if not supported:
                errors.append("Frame has no supports — it is a mechanism.")
    except ValidationError as exc:
        errors.extend([str(e["msg"]) for e in exc.errors()])

    return jsonify({
        "status": "error" if errors else "ok",
        "analysis_type": analysis_type,
        "errors": errors,
        "warnings": warnings_out,
    }), (400 if errors else 200)

@app.post("/api/analyze")
def analyze():
    try:
        analysis_request = AnalyzeRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        log.warning("analyze_validation_error", extra={"errors": error.error_count()})
        return jsonify({"status": "error", "errors": error.errors()}), 422

    response = build_analysis_response(analysis_request.prompt)
    return jsonify(response.model_dump(mode="json"))


@app.post("/api/chat")
def chat():
    try:
        chat_request = ChatRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        log.warning("chat_validation_error", extra={"errors": error.error_count()})
        return jsonify({"status": "error", "errors": error.errors()}), 422

    log.info("chat_request", extra={"msg_len": len(chat_request.message)})
    agent_system = get_agent_system()
    canvas_decision, canvas_source = agent_system.route_canvas_tool(chat_request.message)
    if canvas_decision.action != "none":
        canvas_action = CanvasAction(action=canvas_decision.action, arguments=canvas_decision.arguments)
        response = ChatResponse(
            status="ok",
            response_type="canvas_action",
            message=canvas_decision.message or "I updated the canvas.",
            source=f"canvas_tool:{canvas_source}",
            canvas_action=canvas_action,
        )
        return jsonify(response.model_dump(mode="json"))

    if not is_structural_analysis_request(chat_request.message):
        chat_result = agent_system.chat(chat_request.message)
        response = ChatResponse(
            status="ok",
            response_type="conversation",
            message=chat_result.message,
            source=chat_result.source,
        )
        return jsonify(response.model_dump(mode="json"))

    if has_drawn_structure(chat_request.model) and is_drawing_analysis_request(chat_request.message):
        analysis_type = (chat_request.analysis_type or "frame").lower()
        results, report_md = analyze_structure_model(analysis_type, chat_request.model)
        analysis = AnalyzeResponse(
            status="ok",
            analysis_type=analysis_type,
            assumptions=[
                "Preliminary elastic analysis only.",
                "Input model was taken from the current canvas drawing.",
            ],
            warnings=["Not a substitute for licensed engineering review or full code compliance."],
            traces=[],
            results=results,
            report_markdown=report_md,
            diagrams=None,
        )
    else:
        analysis = build_analysis_response(chat_request.message)

    analysis_type = analysis.analysis_type
    type_labels = {
        "beam": "beam analysis",
        "truss": "truss analysis",
        "frame": "frame analysis",
        "column": "column buckling analysis",
    }
    label = type_labels.get(analysis_type, "structural analysis")

    response = ChatResponse(
        status="ok",
        response_type="analysis",
        message=f"I ran the preliminary {label} and summarized the key checks below.",
        source=analysis.results.get("solver", "analysis"),
        analysis=analysis,
    )
    return jsonify(response.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# Routes: Direct Structure Analysis (from canvas drawing)
# ---------------------------------------------------------------------------

@app.post("/api/analyze/structure")
def analyze_structure():
    """Accepts a drawn structure (nodes, members, loads) and runs analysis."""
    data = request.get_json(silent=True) or {}
    analysis_type = data.get("analysis_type", "frame")

    try:
        results, report_md = analyze_structure_model(analysis_type, data.get("model", {}))

        return jsonify({
            "status": "ok",
            "analysis_type": analysis_type,
            "results": results,
            "report_markdown": report_md,
        })
    except ValidationError as error:
        return jsonify({"status": "error", "errors": error.errors()}), 422
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


# ---------------------------------------------------------------------------
# Routes: Section Library
# ---------------------------------------------------------------------------

@app.get("/api/sections")
def sections_list():
    section_type = request.args.get("type", "all")
    query = request.args.get("q", "")
    if query:
        results = search_sections(query)
        return jsonify({"status": "ok", "sections": [section_to_dict(s) for s in results]})
    names = list_sections(section_type)
    return jsonify({"status": "ok", "sections": names})


@app.get("/api/sections/<name>")
def section_detail(name: str):
    section = get_section(name)
    if not section:
        return jsonify({"status": "error", "message": f"Section '{name}' not found"}), 404
    return jsonify({"status": "ok", "section": section_to_dict(section)})


# ---------------------------------------------------------------------------
# Routes: History
# ---------------------------------------------------------------------------

@app.get("/api/history")
def history_list():
    limit = request.args.get("limit", 50, type=int)
    items = _get_history(limit)
    # Parse results_json back to dict for each item
    for item in items:
        try:
            item["results"] = json.loads(item.pop("results_json"))
        except (json.JSONDecodeError, KeyError):
            item["results"] = {}
    return jsonify({"status": "ok", "history": items})


@app.get("/api/history/<int:item_id>")
def history_detail(item_id: int):
    item = _get_history_item(item_id)
    if not item:
        return jsonify({"status": "error", "message": "Not found"}), 404
    try:
        item["results"] = json.loads(item.pop("results_json"))
    except (json.JSONDecodeError, KeyError):
        item["results"] = {}
    return jsonify({"status": "ok", "item": item})


# ---------------------------------------------------------------------------
# Routes: Export
# ---------------------------------------------------------------------------

@app.post("/api/export/csv")
def export_csv():
    """Export analysis results as CSV."""
    data = request.get_json(silent=True) or {}
    results = data.get("results", {})
    if not results:
        return jsonify({"status": "error", "message": "No results to export"}), 400

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Key", "Value", "Unit"])

    unit_map = {
        "max_reaction_kn": "kN", "max_shear_kn": "kN", "max_moment_kn_m": "kN-m",
        "max_deflection_mm": "mm", "deflection_limit_mm": "mm",
        "left_reaction_kn": "kN", "right_reaction_kn": "kN",
        "euler_buckling_load_kn": "kN", "nominal_strength_kn": "kN",
        "design_strength_kn": "kN", "applied_load_kn": "kN",
        "axial_stress_mpa": "MPa", "critical_stress_mpa": "MPa",
        "bending_stress_mpa": "MPa", "elastic_buckling_stress_mpa": "MPa",
        "max_displacement_mm": "mm", "span_m": "m", "length_m": "m",
        "effective_length_m": "m", "radius_of_gyration_m": "m",
    }

    for key, value in results.items():
        if isinstance(value, (dict, list)):
            continue
        unit = unit_map.get(key, "")
        writer.writerow([key, value, unit])

    csv_content = output.getvalue()
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=analysis_results.csv"},
    )


@app.post("/api/export/report")
def export_report():
    """Export the markdown report as a downloadable .md file."""
    data = request.get_json(silent=True) or {}
    report = data.get("report_markdown", "")
    if not report:
        return jsonify({"status": "error", "message": "No report to export"}), 400

    return Response(
        report,
        mimetype="text/markdown",
        headers={"Content-Disposition": "attachment; filename=analysis_report.md"},
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    log.info("struct_agent_starting", extra={"env": get_settings().app_env})
    app.run(debug=True)
