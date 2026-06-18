from app.main import app


class StubAgentSystem:
    def chat(self, message: str):
        from app.agents import ConversationResult

        return ConversationResult(message=f"LLM replied to: {message}", source="llm")

    def route_canvas_tool(self, message: str):
        from app.models import CanvasToolDecision

        if "clear" in message.lower():
            return CanvasToolDecision(action="clear_canvas", message="I cleared the drawing canvas.", confidence=0.9), "llm"
        return CanvasToolDecision(), "llm"


def test_analyze_route_returns_opensees_result() -> None:
    client = app.test_client()

    response = client.post(
        "/api/analyze",
        json={
            "prompt": (
                "Analyze a simply supported steel beam. Span is 6 m, uniform load is 20 kN/m, "
                "E is 200 GPa, I is 8e-6 m4. Check deflection against L/360."
            )
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    # OpenSeesPy may fall back to closed-form on Windows (missing DLLs)
    assert "openseespy" in data["results"]["solver"] or "closed_form" in data["results"]["solver"]
    assert round(float(data["results"]["max_moment_kn_m"]), 2) == 90.0


def test_chat_route_answers_greeting_with_llm(monkeypatch) -> None:
    client = app.test_client()

    import app.routes.analyze as analyze_mod
    monkeypatch.setattr(analyze_mod, "_get_agent_system", lambda: StubAgentSystem())

    response = client.post("/api/chat", json={"message": "hi"})

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["response_type"] == "conversation"
    assert data["message"] == "LLM replied to: hi"
    assert data["source"] == "llm"
    assert data["analysis"] is None


def test_chat_route_answers_structural_question_without_running_analysis(monkeypatch) -> None:
    client = app.test_client()

    import app.routes.analyze as analyze_mod
    monkeypatch.setattr(analyze_mod, "_get_agent_system", lambda: StubAgentSystem())

    response = client.post("/api/chat", json={"message": "what is beam deflection?"})

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["response_type"] == "conversation"
    assert data["message"] == "LLM replied to: what is beam deflection?"
    assert data["analysis"] is None


def test_chat_route_returns_canvas_action_for_clear_command(monkeypatch) -> None:
    client = app.test_client()
    from app.models import CanvasToolDecision

    class StubCanvasAgent(StubAgentSystem):
        def route_canvas_tool(self, message: str):
            return CanvasToolDecision(action="clear_canvas", message="I cleared the drawing canvas.", confidence=0.9), "llm"

    import app.routes.analyze as analyze_mod
    monkeypatch.setattr(analyze_mod, "_get_agent_system", lambda: StubCanvasAgent())

    response = client.post("/api/chat", json={"message": "clear the canvas"})

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["response_type"] == "canvas_action"
    assert data["canvas_action"]["action"] == "clear_canvas"
    assert data["analysis"] is None


def test_chat_route_returns_canvas_action_for_draw_beam(monkeypatch) -> None:
    client = app.test_client()
    from app.models import CanvasToolDecision

    class StubCanvasAgent(StubAgentSystem):
        def route_canvas_tool(self, message: str):
            return CanvasToolDecision(
                action="draw_simple_beam",
                arguments={"span_m": 2.0, "point_loads": [{"magnitude_kn": 10, "position_m": 1.0}]},
                message="I drew a simply supported beam on the canvas.",
                confidence=0.9,
            ), "llm"

    import app.routes.analyze as analyze_mod
    monkeypatch.setattr(analyze_mod, "_get_agent_system", lambda: StubCanvasAgent())

    response = client.post("/api/chat", json={"message": "draw a simply supported beam 2m long with 10kN at middle"})

    assert response.status_code == 200
    data = response.get_json()
    assert data["response_type"] == "canvas_action"
    assert data["canvas_action"]["action"] == "draw_simple_beam"
    assert data["canvas_action"]["arguments"]["span_m"] == 2.0
    assert data["analysis"] is None


def test_chat_route_runs_analysis_for_engineering_request() -> None:
    client = app.test_client()

    response = client.post(
        "/api/chat",
        json={
            "message": (
                "Analyze a simply supported steel beam. Span is 6 m, uniform load is 20 kN/m, "
                "E is 200 GPa, I is 8e-6 m4. Check deflection against L/360."
            )
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["response_type"] == "analysis"
    # OpenSeesPy may fall back to closed-form on Windows
    assert "openseespy" in data["source"] or "closed_form" in data["source"]
    assert "openseespy" in data["analysis"]["results"]["solver"] or "closed_form" in data["analysis"]["results"]["solver"]


def test_analyze_structure_route_leaves_3d_support_conversion_to_model_builder(monkeypatch) -> None:
    client = app.test_client()
    captured = {}

    def fake_analyze_structure_model(analysis_type, model):
        captured["analysis_type"] = analysis_type
        captured["model"] = model
        return {"solver": "fake_3d"}, "report"

    import app.routes.analyze as analyze_mod
    monkeypatch.setattr(analyze_mod, "_analyze_structure_model", fake_analyze_structure_model)

    response = client.post(
        "/api/analyze/structure",
        json={
            "analysis_type": "3d_frame",
            "model": {
                "nodes": [{"id": 1, "x": 0, "y": 0, "z": 0, "support": "roller"}],
                "members": [],
            },
        },
    )

    assert response.status_code == 200
    assert captured["analysis_type"] == "3d_frame"
    assert captured["model"]["nodes"][0]["support"] == "roller"


def test_export_csv_includes_nested_3d_analysis_results() -> None:
    client = app.test_client()

    response = client.post(
        "/api/export/csv",
        json={
            "analysis": {
                "results": {
                    "load_combination": "1.2D + 1.0EX + 0.5L",
                    "base_reactions": {"Fx_kn": -12.5, "Fz_kn": 120.0},
                    "story_response": {
                        "story_drifts": [{"from_m": 0, "to_m": 3.5, "drift_mm": 8.2}],
                    },
                    "member_force_summary": {
                        "4": {"group": "beam", "max_abs_moment_z_kn_m": 44.0},
                    },
                }
            }
        },
    )

    body = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "base_reactions.Fx_kn,-12.5,kN" in body
    assert "story_response.story_drifts[0].drift_mm,8.2,mm" in body
    assert "member_force_summary.4.max_abs_moment_z_kn_m,44.0,kN-m" in body


def test_export_report_appends_detailed_results_json() -> None:
    client = app.test_client()

    response = client.post(
        "/api/export/report",
        json={
            "report_markdown": "# Report",
            "results": {"load_combination": "Combo 1", "base_reactions": {"Fx_kn": 1.5}},
        },
    )

    body = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "## Detailed Analysis Data" in body
    assert '"load_combination": "Combo 1"' in body
    assert '"Fx_kn": 1.5' in body


def test_export_report_regenerates_stale_3d_beam_template() -> None:
    client = app.test_client()
    stale_report = """# Preliminary Structural Analysis Report

## Request
Canvas-drawn 3D frame structure

## Analysis Type
Beam Analysis (simply_supported)

## Input Summary
- Span: None m
"""

    response = client.post(
        "/api/export/report",
        json={
            "analysis": {
                "analysis_type": "3d_frame",
                "assumptions": ["Preliminary elastic 3D analysis."],
                "warnings": [],
                "report_markdown": stale_report,
                "results": {
                    "solver": "openseespy_3d_frame",
                    "num_nodes": 2,
                    "num_members": 1,
                    "load_combination": "1.2D + 1.0EX + 0.5L",
                    "base_reactions": {"Fx_kn": -5.0, "Fy_kn": 0.0, "Fz_kn": 20.0},
                    "story_response": {"story_drifts": [{"from_m": 0.0, "to_m": 3.5, "height_m": 3.5, "drift_mm": 1.3}]},
                    "member_force_summary": {"1": {"group": "beam", "max_abs_axial_kn": 1.0}},
                },
            },
            "analysis_type": "3d_frame",
            "report_markdown": stale_report,
        },
    )

    body = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "# Preliminary 3D Frame Analysis Report" in body
    assert "3D Space Frame Analysis" in body
    assert "Beam Analysis" not in body
    assert "Span: None" not in body
    assert "## Base Reactions" in body
    assert "## Detailed Analysis Data" in body
