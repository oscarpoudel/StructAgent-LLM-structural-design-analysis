"""Flask endpoint contract tests for scoped engineering design APIs."""
from types import SimpleNamespace

from app.llm import DisabledLLMClient
from app.main import create_app
from app.tools.report import format_traceability_appendix


def test_code_checks_and_load_templates_endpoints():
    app = create_app()
    client = app.test_client()
    interaction = client.post("/api/design/code-checks/steel-interaction", json={
        "axial_demand_kn": 20, "available_axial_kn": 100,
        "mx_demand_kn_m": 30, "mx_available_kn_m": 100,
        "my_demand_kn_m": 10, "my_available_kn_m": 100,
        "force_type": "compression",
    })
    assert interaction.status_code == 200
    assert interaction.json["results"]["equation"] == "H1-1a"
    assert interaction.json["results"]["result"] == "PASS"

    invalid = client.post("/api/design/code-checks/steel-interaction", json={
        "axial_demand_kn": 20, "available_axial_kn": 0,
    })
    assert invalid.status_code == 422

    templates = client.post("/api/load-combinations/3d-templates",
                            json={"cases": ["D", "L", "EX"]})
    assert templates.status_code == 200
    assert any("EX" in c["factors"] for c in templates.json["results"]["combinations"])

    drift = client.post("/api/design/code-checks/story-drift", json={
        "story_drifts": [{"height_m": 3, "drift_mm": 5,
                          "drift_x_mm": 3, "drift_y_mm": 4}],
        "risk_category": "II", "structure_class": "other",
        "cd": 4, "ie": 1, "seismic_elastic_confirmed": True,
        "direction": "x",
    })
    assert drift.status_code == 200
    assert drift.json["results"]["direction"] == "x"
    assert drift.json["results"]["checks"][0]["design_drift_mm"] == 12.0


def test_chat_design_without_live_ollama_can_use_strict_labeled_parser(monkeypatch):
    from app.routes import analyze

    app = create_app()
    monkeypatch.setattr(analyze, "_get_agent_system",
                        lambda: SimpleNamespace(llm=DisabledLLMClient()))
    result = app.test_client().post("/api/chat", json={
        "message": "Check steel H1 interaction Pr=20, Pc=100, Mrx=30, Mcx=100, Mry=10, Mcy=100",
    })
    assert result.status_code == 200
    assert result.json["response_type"] == "design"
    assert result.json["design_result"]["result"]["equation"] == "H1-1a"
    assert "## Deterministic result" in result.json["design_report"]


def test_traceability_appendix_exposes_run_context():
    appendix = format_traceability_appendix({
        "solver": "openseespy_3d_frame",
        "traceability": {
            "timestamp_utc": "2026-11-13T10:00:00+00:00",
            "model_sha256": "abc123",
            "load_combination": "1.2D+1.6L",
            "analysis_order": "first_order",
        },
        "story_response": {"story_drifts": [{
            "from_m": 0, "to_m": 3, "drift_x_mm": 3,
            "drift_y_mm": 4, "drift_mm": 5, "pairing_method": "matched_xy",
        }]},
    })
    assert "abc123" in appendix
    assert "1.2D+1.6L" in appendix
    assert "Directional interstory" in appendix
    assert "matched_xy" in appendix


def test_named_project_and_metadata_roundtrip_server(tmp_path, monkeypatch):
    from app import main as app_module

    monkeypatch.setattr(app_module, "DB_PATH", tmp_path / "project-test.db")
    app = create_app()
    client = app.test_client()
    record = {
        "id": "proj_validated_01", "name": "Three-story Office Frame",
        "metadata": {
            "projectNumber": "STR-2026-03", "client": "Engineering Research Lab",
            "engineer": "Design Team", "location": "Kathmandu",
            "structureType": "building", "codeBasis": "ASCE 7-22",
            "description": "Research-stage gravity and lateral analysis",
        },
        "nodes": [], "members": [], "levels": [
            {"name": "Ground", "elevation": 0},
            {"name": "Roof", "elevation": 3.5},
        ], "updatedAt": 1000,
    }
    put_response = client.put("/api/projects/proj_validated_01", json=record)
    assert put_response.status_code == 200
    got = client.get("/api/projects/proj_validated_01")
    assert got.status_code == 200
    assert got.json["project"]["name"] == "Three-story Office Frame"
    assert got.json["project"]["metadata"]["projectNumber"] == "STR-2026-03"
    assert got.json["project"]["metadata"]["location"] == "Kathmandu"

    record["name"] = "Revised Office and Laboratory Block"
    record["metadata"]["description"] = "Additional structural assessment"
    record["updatedAt"] = 2000
    updated = client.put("/api/projects/proj_validated_01", json=record)
    assert updated.status_code == 200
    listed = client.get("/api/projects")
    assert listed.status_code == 200
    item = next(p for p in listed.json["projects"] if p["id"] == "proj_validated_01")
    assert item["name"] == "Revised Office and Laboratory Block"
    assert item["metadata"]["description"] == "Additional structural assessment"
