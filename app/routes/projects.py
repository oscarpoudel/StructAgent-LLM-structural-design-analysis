"""Project persistence routes blueprint."""
from __future__ import annotations

from flask import Blueprint, jsonify, request

bp = Blueprint("projects", __name__)

# Set by app factory
_get_projects = None
_get_project = None
_save_project = None
_delete_project = None


@bp.get("/api/projects")
def project_list():
    return jsonify({"status": "ok", "projects": _get_projects()})


@bp.get("/api/projects/<project_id>")
def project_detail(project_id: str):
    project = _get_project(project_id)
    if not project:
        return jsonify({"status": "error", "message": "Project not found"}), 404
    return jsonify({"status": "ok", "project": project})


@bp.put("/api/projects/<project_id>")
def project_save(project_id: str):
    project = request.get_json(silent=True) or {}
    if not isinstance(project, dict):
        return jsonify({"status": "error", "message": "Project payload must be an object"}), 400
    if not project.get("id"):
        project["id"] = project_id
    if project.get("id") != project_id:
        return jsonify({"status": "error", "message": "Project id mismatch"}), 400
    try:
        saved_id = _save_project(project)
    except ValueError as error:
        return jsonify({"status": "error", "message": str(error)}), 400
    return jsonify({"status": "ok", "id": saved_id})


@bp.delete("/api/projects/<project_id>")
def project_delete(project_id: str):
    _delete_project(project_id)
    return jsonify({"status": "ok"})
