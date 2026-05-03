"""Analysis routes blueprint."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from app.logging_config import get_logger
from app.models import (
    AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse,
    TrussInputs, FrameInputs, CanvasAction,
)
from app.tools.load_combinations import run_all_load_combinations, get_controlling_combination

bp = Blueprint("analyze", __name__)
log = get_logger(__name__)


# These are set by the app factory (app/main.py) to avoid circular imports
_get_agent_system = None
_save_history = None
_build_analysis_response = None
_analyze_structure_model = None


def _is_structural_analysis_request(message: str) -> bool:
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


def _is_drawing_analysis_request(message: str) -> bool:
    text = message.lower()
    drawing_terms = ["drawing", "drawn", "canvas", "model", "current structure", "this structure", "sketch"]
    terse = ["perform analysis", "run analysis", "run the analysis", "analyze it", "analyse it", "analyze this"]
    return any(term in text for term in drawing_terms) or any(term in text for term in terse)


def _has_drawn_structure(model: dict | None) -> bool:
    if not model:
        return False
    return len(model.get("nodes", [])) >= 2 and len(model.get("members", [])) >= 1


@bp.post("/api/analyze")
def analyze():
    try:
        req = AnalyzeRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        log.warning("analyze_validation_error", extra={"errors": error.error_count()})
        return jsonify({"status": "error", "errors": error.errors()}), 422

    response = _build_analysis_response(req.prompt)
    return jsonify(response.model_dump(mode="json"))


@bp.post("/api/chat")
def chat():
    try:
        chat_req = ChatRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        log.warning("chat_validation_error", extra={"errors": error.error_count()})
        return jsonify({"status": "error", "errors": error.errors()}), 422

    log.info("chat_request", extra={"msg_len": len(chat_req.message)})
    agent_system = _get_agent_system()
    canvas_decision, canvas_source = agent_system.route_canvas_tool(chat_req.message)
    if canvas_decision.action != "none":
        canvas_action = CanvasAction(action=canvas_decision.action, arguments=canvas_decision.arguments)
        return jsonify(ChatResponse(
            status="ok",
            response_type="canvas_action",
            message=canvas_decision.message or "I updated the canvas.",
            source=f"canvas_tool:{canvas_source}",
            canvas_action=canvas_action,
        ).model_dump(mode="json"))

    if not _is_structural_analysis_request(chat_req.message):
        chat_result = agent_system.chat(chat_req.message)
        return jsonify(ChatResponse(
            status="ok",
            response_type="conversation",
            message=chat_result.message,
            source=chat_result.source,
        ).model_dump(mode="json"))

    if _has_drawn_structure(chat_req.model) and _is_drawing_analysis_request(chat_req.message):
        analysis_type = (chat_req.analysis_type or "frame").lower()
        results, report_md = _analyze_structure_model(analysis_type, chat_req.model)
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
        analysis = _build_analysis_response(chat_req.message)

    type_labels = {
        "beam": "beam analysis", "truss": "truss analysis",
        "frame": "frame analysis", "column": "column buckling analysis",
    }
    label = type_labels.get(analysis.analysis_type, "structural analysis")
    return jsonify(ChatResponse(
        status="ok",
        response_type="analysis",
        message=f"I ran the preliminary {label} and summarized the key checks below.",
        source=analysis.results.get("solver", "analysis"),
        analysis=analysis,
    ).model_dump(mode="json"))


@bp.post("/api/analyze/structure")
def analyze_structure():
    """Accepts a drawn structure (nodes, members, loads) and runs analysis."""
    data = request.get_json(silent=True) or {}
    analysis_type = data.get("analysis_type", "frame")
    try:
        results, report_md = _analyze_structure_model(analysis_type, data.get("model", {}))
        return jsonify({
            "status": "ok", "analysis_type": analysis_type,
            "results": results, "report_markdown": report_md,
        })
    except ValidationError as error:
        return jsonify({"status": "error", "errors": error.errors()}), 422
    except Exception as error:
        log.error("analyze_structure_error", extra={"error": str(error)})
        return jsonify({"status": "error", "message": str(error)}), 500


@bp.post("/api/load-combinations")
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
    return jsonify({"status": "ok", "method": method, "combinations": all_combos, "controlling": controlling})


@bp.post("/api/validate")
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
            if not parsed.members:
                errors.append("Truss requires at least 1 member.")
            if len([n for n in parsed.nodes if n.support != "free"]) < 2:
                warnings_out.append("Truss needs at least 2 supported nodes to be statically determinate.")
        else:
            parsed = FrameInputs.model_validate(model)
            if len(parsed.nodes) < 2:
                errors.append("Frame requires at least 2 nodes.")
            if not parsed.members:
                errors.append("Frame requires at least 1 member.")
            if not [n for n in parsed.nodes if n.support != "free"]:
                errors.append("Frame has no supports — it is a mechanism.")
    except ValidationError as exc:
        errors.extend([str(e["msg"]) for e in exc.errors()])

    return jsonify({
        "status": "error" if errors else "ok",
        "analysis_type": analysis_type,
        "errors": errors,
        "warnings": warnings_out,
    }), (400 if errors else 200)
