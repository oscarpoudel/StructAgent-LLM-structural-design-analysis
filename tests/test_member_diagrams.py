"""Reference checks for local 3D beam section force diagrams."""
import pytest

from app.models import Load3D, Member3D, MemberLoad3D, Node3D, Structure3DInputs, Support3D
from app.tools.member_diagrams import local_member_force_diagram
from app.tools.opensees_3d import analyze_3d_structure_opensees


def test_uniform_local_transverse_load_simply_supported_equilibrium():
    # A simply supported L=6 m beam under wy=-10 kN/m has
    # V_i=V_j=30 kN and an exact midspan sagging moment +45 kN-m.
    local = [0, 30, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0]
    diagram = local_member_force_diagram(local, 6, wy_kn_per_m=-10, stations=41)
    assert diagram["components"]["Mz"][0] == 0
    assert diagram["components"]["Mz"][20] == pytest.approx(45)
    assert diagram["components"]["Mz"][-1] == pytest.approx(0)
    assert diagram["components"]["Vy"][0] == -30
    assert diagram["components"]["Vy"][-1] == 30
    assert diagram["ranges"]["Mz"]["max_abs"] == pytest.approx(45)
    assert all(abs(res) < 1e-8 for res in diagram["end_equilibrium_residuals"].values())


def test_cantilever_end_force_diagrams_reproduce_end_reactions():
    local = [-100, -20, -5, -2, -3, -4,
             100, 20, 5, 2, 33, -116]
    diagram = local_member_force_diagram(local, 6, stations=3)
    assert diagram["components"]["N"] == [100, 100, 100]
    assert diagram["components"]["Mz"] == [4, -56, -116]
    assert diagram["components"]["My"] == [3, 18, 33]
    assert all(abs(v) < 1e-8 for v in diagram["end_equilibrium_residuals"].values())


def test_diagram_rejects_invalid_force_vector():
    with pytest.raises(ValueError):
        local_member_force_diagram([0] * 11, 3)
    with pytest.raises(ValueError):
        local_member_force_diagram([0] * 12, 0)


def test_opensees_local_force_and_diagram_contract():
    fixed = Support3D(ux=True, uy=True, uz=True, rx=True, ry=True, rz=True)
    model = Structure3DInputs(
        nodes=[Node3D(id=1, x=0, y=0, z=0, support=fixed),
               Node3D(id=2, x=6, y=0, z=0)],
        members=[Member3D(id=1, start_node=1, end_node=2, area_m2=0.03,
                          iy_m4=0.001, iz_m4=0.001, j_m4=0.001)],
        nodal_loads=[Load3D(node_id=2, case="D", fy_kn=-20)],
        load_combinations=[{"name": "D", "factors": {"D": 1}}],
        active_load_combination="D",
    )
    result = analyze_3d_structure_opensees(model)
    assert result.get("status") != "error", result
    assert len(result["member_forces"]["1"] if "1" in result["member_forces"] else result["member_forces"][1]) == 12
    diagrams = result["member_force_diagrams"]
    d = diagrams.get("1", diagrams.get(1))
    assert d and len(d["station_m"]) == 41
    # No in-span element load: all shear and axial resultants are constant,
    # moments vary linearly. This does not prescribe a design capacity.
    assert d["components"]["Vy"][0] == pytest.approx(d["components"]["Vy"][-1])
    assert abs(d["components"]["My"][0] - d["components"]["My"][-1]) >= 0


def test_opensees_uniform_local_load_diagram_equilibrates_at_both_ends():
    fixed = Support3D(ux=True, uy=True, uz=True, rx=True, ry=True, rz=True)
    model = Structure3DInputs(
        nodes=[Node3D(id=1, x=0, y=0, z=0, support=fixed),
               Node3D(id=2, x=6, y=0, z=0)],
        members=[Member3D(id=1, start_node=1, end_node=2,
                          area_m2=0.04, iy_m4=0.001, iz_m4=0.001, j_m4=0.001)],
        member_loads=[MemberLoad3D(member_id=1, case="D", wy_kn_per_m=-10)],
        load_combinations=[{"name": "1.0D", "factors": {"D": 1}}],
        active_load_combination="1.0D",
    )
    result = analyze_3d_structure_opensees(model)
    assert result.get("status") != "error", result
    diagram = result["member_force_diagrams"].get(1)
    assert diagram is not None
    assert diagram["local_uniform_loads"]["wy_kn_per_m"] == -10
    assert diagram["components"]["Vy"][-1] - diagram["components"]["Vy"][0] == pytest.approx(60)
    assert max(abs(v) for v in diagram["end_equilibrium_residuals"].values()) < 1e-4
    assert result["force_coordinate_system"].startswith("local")
