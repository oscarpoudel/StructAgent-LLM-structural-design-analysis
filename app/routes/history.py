"""History routes blueprint."""
from __future__ import annotations

import csv
import io
import json

from flask import Blueprint, jsonify, request, Response

from app.logging_config import get_logger

bp = Blueprint("history", __name__)
log = get_logger(__name__)

# Set by app factory
_get_history = None
_get_history_item = None


@bp.get("/api/history")
def history_list():
    limit = request.args.get("limit", 50, type=int)
    items = _get_history(limit)
    for item in items:
        try:
            item["results"] = json.loads(item.pop("results_json"))
        except (json.JSONDecodeError, KeyError):
            item["results"] = {}
    return jsonify({"status": "ok", "history": items})


@bp.get("/api/history/<int:item_id>")
def history_detail(item_id: int):
    item = _get_history_item(item_id)
    if not item:
        return jsonify({"status": "error", "message": "Not found"}), 404
    try:
        item["results"] = json.loads(item.pop("results_json"))
    except (json.JSONDecodeError, KeyError):
        item["results"] = {}
    return jsonify({"status": "ok", "item": item})


@bp.post("/api/export/csv")
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

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=analysis_results.csv"},
    )


@bp.post("/api/export/report")
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
