"""Benchmark and regression checks for advanced preliminary engineering tools."""
import math

import pytest

from app.models import Load3D, Member3D, Node3D, Structure3DInputs, Support3D
from app.tools.code_checks import check_seismic_story_drift, check_steel_h1_interaction
from app.tools.design_assistant import is_design_request, respond_to_design_request
from app.tools.load_templates import representative_strength_combinations
from app.tools.opensees_3d import _story_response, analyze_3d_structure_opensees
from app.tools.pdelta import amplification_factor, amplify_story_drifts, stability_coefficient


def test_directional_paired_drift_benchmark():
    model = Structure3DInputs(
        nodes=[Node3D(id=1, x=0, y=0, z=0),
               Node3D(id=2, x=0, y=0, z=3)],
        members=[],
    )
    result = _story_response(model, {
        1: [0, 0, 0, 0, 0, 0],
        2: [3, 4, 0, 0, 0, 0],
    })["story_drifts"][0]
    assert result["drift_mm"] == 5.0
    assert result["drift_x_mm"] == 3.0
    assert result["drift_y_mm"] == 4.0
    assert result["pairing_method"] == "matched_xy"

    code = check_seismic_story_drift(
        [result], risk_category="II", structure_class="other",
        cd=4, importance_factor=1, seismic_elastic_confirmed=True,
        direction="x",
    )
    assert code["checks"][0]["design_drift_mm"] == 12.0


def test_h1_both_branches_and_boundary():
    inputs = dict(
        axial_demand_kn=19, available_axial_kn=100,
        mx_demand_kn_m=30, mx_available_kn_m=100,
        my_demand_kn_m=10, my_available_kn_m=100,
    )
    below = check_steel_h1_interaction(**inputs)
    assert below["equation"] == "H1-1b"
    assert below["utilization"] == pytest.approx(0.495)
    at = check_steel_h1_interaction(**{**inputs, "axial_demand_kn": 20})
    assert at["equation"] == "H1-1a"
    assert at["utilization"] == pytest.approx(0.555556, abs=1e-6)


def test_h1_rejects_invalid_capacity():
    with pytest.raises(ValueError):
        check_steel_h1_interaction(
            axial_demand_kn=10, available_axial_kn=math.inf,
            mx_demand_kn_m=4, mx_available_kn_m=200,
            my_demand_kn_m=3, my_available_kn_m=100,
        )


def test_signed_seismic_templates_are_separate_from_wind():
    data = representative_strength_combinations(["D", "L", "W", "EX", "EY"])
    combos = data["combinations"]
    assert {c["factors"]["EX"] for c in combos if "EX" in c["factors"]} == {-1.0, 1.0}
    assert {c["factors"]["EY"] for c in combos if "EY" in c["factors"]} == {-1.0, 1.0}
    assert all(not ({"W", "EX"} <= set(c["factors"])) for c in combos)
    assert all(not ({"W", "EY"} <= set(c["factors"])) for c in combos)


def test_pdelta_dimensional_benchmark():
    # Elastic seismic story P = 1000 kN, displacement = 12 mm, V = 100 kN, h = 3 m.
    # Dimensionless theta = 1000 * 0.012 / (100 * 3) = 0.04.
    theta = stability_coefficient(100, 3, 1000, 12)
    assert theta == pytest.approx(0.04)
    assert amplification_factor(theta) == pytest.approx(1.0 / 0.96)
    response = amplify_story_drifts(
        [{"height_m": 3, "drift_mm": 12, "from_m": 0, "to_m": 3}],
        100, 3, 1000,
    )
    assert response["theta"] == pytest.approx(0.04)
    assert response["story_drifts"][0]["drift2_mm"] == pytest.approx(12.5)


def test_pdelta_rejects_zero_base_shear():
    with pytest.raises(ValueError):
        stability_coefficient(0, 3, 1000, 12)


def test_opensees_pdelta_comparison_on_simple_cantilever():
    fixed = Support3D(ux=True, uy=True, uz=True, rx=True, ry=True, rz=True)
    model = Structure3DInputs(
        nodes=[Node3D(id=1, x=0, y=0, z=0, support=fixed),
               Node3D(id=2, x=0, y=0, z=3)],
        members=[Member3D(
            id=1, start_node=1, end_node=2, area_m2=.03,
            iy_m4=.001, iz_m4=.001, j_m4=.001,
            elastic_modulus_gpa=200, shear_modulus_gpa=77,
        )],
        nodal_loads=[Load3D(node_id=2, case="D", fx_kn=30, fz_kn=-600)],
        analysis_order="p_delta",
    )
    result = analyze_3d_structure_opensees(model)
    verification = result["second_order_verification"]
    assert verification["first_order_solver_status"] == 0
    assert verification["pdelta_solver_status"] == 0
    assert verification["amplification_ratio"] is not None
    assert 1.0 <= verification["amplification_ratio"] < 1.5


class _FakeLLM:
    def chat(self, **kwargs):
        del kwargs
        from app.llm import LLMReply
        return LLMReply(
            tool_calls=[{"name": "extract_design_request", "arguments": {
                "action": "steel_interaction",
                "axial_demand_kn": 20,
                "available_axial_kn": 100,
                "mx_demand_kn_m": 30,
                "mx_available_kn_m": 100,
                "my_demand_kn_m": 10,
                "my_available_kn_m": 100,
            }}],
        )


def test_ollama_tool_result_is_recomputed_in_python():
    text = "Check steel H1 interaction Pr=20, Pc=100, Mrx=30, Mcx=100, Mry=10, Mcy=100"
    assert is_design_request(text)
    result = respond_to_design_request(text, _FakeLLM())
    assert result["source"] == "ollama_assisted_deterministic_design"
    assert result["design_result"]["result"]["equation"] == "H1-1a"
    assert result["design_result"]["result"]["utilization"] == pytest.approx(0.555556, abs=1e-6)
    assert "SHA-256" in result["design_report"]


def test_ollama_cannot_invent_missing_capacity():
    text = "Check steel interaction Pr=20, Pc=100, Mrx=30, Mcx=100"
    result = respond_to_design_request(text, _FakeLLM())
    assert result.get("design_result") is None
    assert "my_demand_kn_m" in result["message"]
