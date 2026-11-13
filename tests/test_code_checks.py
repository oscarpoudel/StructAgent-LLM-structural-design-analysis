"""Regressions for scoped deterministic engineering checks."""
import math

import pytest

from app.tools.code_checks import check_member_deflection, check_seismic_story_drift


def drift(**overrides):
    values = {
        "story_drifts": [{"height_m": 3.0, "drift_mm": 9.0}],
        "risk_category": "II",
        "structure_class": "other",
        "cd": 4.0,
        "importance_factor": 1.0,
        "seismic_elastic_confirmed": True,
    }
    values.update(overrides)
    return check_seismic_story_drift(**values)


def test_asce_7_22_ordinary_limit_and_design_amplification():
    result = drift()
    assert result["allowable_ratio"] == 0.020
    assert result["checks"][0]["design_drift_mm"] == 36
    assert result["checks"][0]["allowable_drift_mm"] == 60
    assert result["checks"][0]["utilization"] == 0.6
    assert result["summary"]["result"] == "PASS"


def test_asce_7_22_risk_iv_and_governing_story():
    result = drift(
        risk_category="IV",
        story_drifts=[{"height_m": 3, "drift_mm": 4}, {"height_m": 4, "drift_mm": 12}],
    )
    assert result["summary"]["result"] == "FAIL"
    assert result["summary"]["governing_story"] == 2
    assert result["checks"][1]["allowable_drift_mm"] == 40


def test_special_four_story_class_requires_eligibility():
    with pytest.raises(ValueError, match="nonstructural"):
        drift(structure_class="four_story_compatible")
    with pytest.raises(ValueError, match="more than four"):
        drift(
            structure_class="four_story_compatible",
            compatible_partitions_confirmed=True,
            story_drifts=[{"height_m": 3, "drift_mm": 1}] * 5,
        )
    result = drift(structure_class="four_story_compatible", compatible_partitions_confirmed=True)
    assert result["allowable_ratio"] == 0.025


@pytest.mark.parametrize("class_name,limit", [
    ("masonry_cantilever", 0.010),
    ("masonry_other", 0.007),
])
def test_masonry_limits(class_name, limit):
    assert drift(structure_class=class_name)["allowable_ratio"] == limit


@pytest.mark.parametrize("bad_drift", [-1.0, math.inf, math.nan, None])
def test_bad_displacements_rejected(bad_drift):
    with pytest.raises(ValueError):
        drift(story_drifts=[{"height_m": 3, "drift_mm": bad_drift}])


def test_seismic_confirmation_required():
    with pytest.raises(ValueError, match="Confirm"):
        drift(seismic_elastic_confirmed=False)


def test_deflection_is_user_selected_and_unit_consistent():
    good = check_member_deflection(span_m=6, deflection_mm=10, span_ratio=360)
    assert good["result"] == "PASS"
    assert good["allowable_mm"] == pytest.approx(16.66667)
    bad = check_member_deflection(span_m=6, deflection_mm=20, span_ratio=360)
    assert bad["result"] == "FAIL"


def test_deflection_rejects_zero_span():
    with pytest.raises(ValueError):
        check_member_deflection(span_m=0, deflection_mm=1, span_ratio=360)
