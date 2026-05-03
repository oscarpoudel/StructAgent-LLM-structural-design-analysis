"""Section library routes blueprint."""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.tools.sections import get_section, list_sections, search_sections, section_to_dict

bp = Blueprint("sections", __name__)


@bp.get("/api/sections")
def sections_list():
    section_type = request.args.get("type", "all")
    query = request.args.get("q", "")
    if query:
        results = search_sections(query)
        return jsonify({"status": "ok", "sections": [section_to_dict(s) for s in results]})
    names = list_sections(section_type)
    return jsonify({"status": "ok", "sections": names})


@bp.get("/api/sections/<name>")
def section_detail(name: str):
    section = get_section(name)
    if not section:
        return jsonify({"status": "error", "message": f"Section '{name}' not found"}), 404
    return jsonify({"status": "ok", "section": section_to_dict(section)})
