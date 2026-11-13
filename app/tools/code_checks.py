"""Deterministic, scoped structural code checks.

These checks compare user-confirmed demands against a particular acceptance
criterion. They do not certify whole-building code compliance.
"""
from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

# ASCE/SEI 7-22, Section 12.12.1, Table 12.12-1.
# Values are Delta_a / h_sx. The special four-story class requires
# qualifying non-masonry construction and drift-compatible partitions.
DRIFT_LIMITS = {
    "other": {"I": 0.020, "II": 0.020, "III": 0.015, "IV": 0.010},
    "four_story_compatible": {"I": 0.025, "II": 0.025, "III": 0.020, "IV": 0.015},
    "masonry_cantilever": {"I": 0.010, "II": 0.010, "III": 0.010, "IV": 0.010},
    "masonry_other": {"I": 0.007, "II": 0.007, "III": 0.007, "IV": 0.007},
}

LIMIT_LABELS = {
    "other": "All other structures",
    "four_story_compatible": "Eligible buildings of four stories or fewer with drift-compatible nonstructural components",
    "masonry_cantilever": "Masonry cantilever shear wall structures",
    "masonry_other": "Other masonry shear wall structures",
}


def _positive_number(value: object, name: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(f"{name} must be a finite positive number.") from exc
    if not math.isfinite(result) or result <= 0:
        raise ValueError(f"{name} must be a finite positive number.")
    return result


def _nonnegative_number(value: object, name: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(f"{name} must be a finite nonnegative number.") from exc
    if not math.isfinite(result) or result < 0:
        raise ValueError(f"{name} must be a finite nonnegative number.")
    return result


def check_seismic_story_drift(
    story_drifts: object,
    *,
    risk_category: str,
    structure_class: str,
    cd: object,
    importance_factor: object,
    seismic_elastic_confirmed: bool,
    compatible_partitions_confirmed: bool = False,
) -> dict:
    """Screen elastic seismic story drifts against ASCE 7-22 Table 12.12-1.

    Input drift_mm is an *elastic seismic* interstory drift from analysis,
    not a pre-amplified design drift or mixed gravity / wind combination.
    Delta = Cd * delta_elastic / Ie. This is a scoped check only.
    """
    if seismic_elastic_confirmed is not True:
        raise ValueError("Confirm that the drifts are from an elastic seismic analysis, not a gravity/wind load combination.")
    if risk_category not in ("I", "II", "III", "IV"):
        raise ValueError("risk_category must be I, II, III, or IV.")
    if structure_class not in DRIFT_LIMITS:
        raise ValueError("Unsupported structure_class.")
    if not isinstance(story_drifts, list) or not 1 <= len(story_drifts) <= 100:
        raise ValueError("Provide between 1 and 100 analyzed story drifts.")
    if structure_class == "four_story_compatible":
        if len(story_drifts) > 4:
            raise ValueError("The four-story exception cannot be applied to models with more than four analyzed stories.")
        if compatible_partitions_confirmed is not True:
            raise ValueError("Confirm the required drift-compatible nonstructural components for the four-story exception.")

    factor_cd = _positive_number(cd, "Cd")
    factor_ie = _positive_number(importance_factor, "Ie")
    if factor_cd > 20 or factor_ie > 5:
        raise ValueError("Check Cd and Ie against the adopted seismic system and code provisions.")

    limit = DRIFT_LIMITS[structure_class][risk_category]
    checks = []
    for index, item in enumerate(story_drifts, start=1):
        if not isinstance(item, Mapping):
            raise ValueError(f"Story {index} must be an object.")
        height_m = _positive_number(item.get("height_m"), f"Story {index} height_m")
        elastic_mm = _nonnegative_number(item.get("drift_mm"), f"Story {index} drift_mm")
        design_mm = elastic_mm * factor_cd / factor_ie
        allowed_mm = limit * height_m * 1000.0
        utilization = design_mm / allowed_mm
        checks.append({
            "story": index,
            "height_m": round(height_m, 5),
            "elastic_drift_mm": round(elastic_mm, 5),
            "design_drift_mm": round(design_mm, 5),
            "allowable_drift_mm": round(allowed_mm, 5),
            "design_drift_ratio": round(design_mm / (height_m * 1000.0), 7),
            "utilization": round(utilization, 5),
            "result": "PASS" if utilization <= 1.0 + 1e-12 else "FAIL",
        })

    governing = max(checks, key=lambda row: row["utilization"])
    return {
        "reference": "ASCE/SEI 7-22, Section 12.12.1, Table 12.12-1",
        "risk_category": risk_category,
        "structure_class": structure_class,
        "structure_description": LIMIT_LABELS[structure_class],
        "allowable_ratio": limit,
        "cd": factor_cd,
        "ie": factor_ie,
        "summary": {
            "result": "PASS" if all(row["result"] == "PASS" for row in checks) else "FAIL",
            "governing_story": governing["story"],
            "governing_utilization": governing["utilization"],
            "stories_checked": len(checks),
        },
        "checks": checks,
        "limitations": [
            "Preliminary drift screening only; not a structural code compliance certificate.",
            "The input must be the elastic interstory displacement from a seismic load case, not a gravity/wind combination or already-amplified design drift.",
            "Cd and Ie must be selected from the adopted seismic force-resisting system and risk-category provisions by a qualified designer.",
            "The 3D solver reports peak resultant story drift, not separate code-qualified directional seismic drift envelopes; the demand must be verified.",
            "P-delta effects, torsion, accidental eccentricity, orthogonal directions, load-combination rules, system irregularities and seismic detailing require separate verification.",
            "Single-story drift-limit exceptions and other special provisions are not automatically applied.",
        ],
    }


def check_member_deflection(*, span_m: object, deflection_mm: object, span_ratio: object) -> dict:
    """Check a user-selected serviceability L/N criterion.

    AISC 360-22 Chapter L addresses serviceability but does not prescribe a
    universal L/360 limit for every structural member. The limit is project
    selected and must be justified by the governing code/specification.
    """
    length_m = _positive_number(span_m, "span_m")
    demand_mm = _nonnegative_number(deflection_mm, "deflection_mm")
    denominator = _positive_number(span_ratio, "span_ratio")
    if denominator < 50 or denominator > 2000:
        raise ValueError("Choose a practical project-specified denominator between 50 and 2000.")
    allowed_mm = length_m * 1000 / denominator
    utilization = demand_mm / allowed_mm
    return {
        "reference": "AISC 360-22 Chapter L (serviceability context); project-selected acceptance criterion",
        "criterion": f"L/{denominator:g}",
        "span_m": length_m,
        "deflection_mm": demand_mm,
        "allowable_mm": round(allowed_mm, 5),
        "utilization": round(utilization, 5),
        "result": "PASS" if utilization <= 1.0 + 1e-12 else "FAIL",
        "limitations": [
            "The L/N acceptance limit is user-selected and is not a universal AISC 360-22 requirement.",
            "Use the appropriate service-load combination and deflection component; verify governing building code, occupancy, finishes and cladding requirements.",
            "This does not check vibration, strength, stability, or connection adequacy.",
        ],
    }
