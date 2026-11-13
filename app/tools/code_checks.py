"""Deterministic, scoped structural code checks.

These checks compare user-confirmed demands against a particular acceptance
criterion. They do not certify whole-building code compliance.
"""
from __future__ import annotations

import math
from collections.abc import Mapping

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
    direction: str = "resultant",
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

    if direction not in ("x", "y", "resultant"):
        raise ValueError("direction must be x, y or resultant.")
    drift_field = {"x": "drift_x_mm", "y": "drift_y_mm", "resultant": "drift_mm"}[direction]
    limit = DRIFT_LIMITS[structure_class][risk_category]
    checks = []
    for index, item in enumerate(story_drifts, start=1):
        if not isinstance(item, Mapping):
            raise ValueError(f"Story {index} must be an object.")
        height_m = _positive_number(item.get("height_m"), f"Story {index} height_m")
        if drift_field not in item:
            raise ValueError(f"Story {index} missing {drift_field}; run a directional 3D analysis.")
        elastic_mm = _nonnegative_number(item[drift_field], f"Story {index} {drift_field}")
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
        "direction": direction,
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
            "The selected direction is a maximum paired-node component, not a complete seismic envelope. Verify orthogonal effects, torsion and load cases.",
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

def check_steel_h1_interaction(
    *,
    axial_demand_kn: object,
    available_axial_kn: object,
    mx_demand_kn_m: object,
    mx_available_kn_m: object,
    my_demand_kn_m: object,
    my_available_kn_m: object,
    force_type: str = "compression",
) -> dict:
    """ANSI/AISC 360-22 H1-1 interaction with designer-provided available strengths.

    Required effects must be from the governing factored/ASD load cases;
    strengths must already account for all applicable member limit states.
    """
    if force_type not in ("compression", "tension"):
        raise ValueError("force_type must be compression or tension.")
    p = _nonnegative_number(axial_demand_kn, "axial_demand_kn")
    pc = _positive_number(available_axial_kn, "available_axial_kn")
    mx = _nonnegative_number(mx_demand_kn_m, "mx_demand_kn_m")
    mcx = _positive_number(mx_available_kn_m, "mx_available_kn_m")
    my = _nonnegative_number(my_demand_kn_m, "my_demand_kn_m")
    mcy = _positive_number(my_available_kn_m, "my_available_kn_m")
    axial_ratio = p / pc
    flexural_sum = mx / mcx + my / mcy
    if axial_ratio >= 0.2:
        utilization = axial_ratio + 8.0 / 9.0 * flexural_sum
        equation = "H1-1a"
    else:
        utilization = axial_ratio / 2.0 + flexural_sum
        equation = "H1-1b"
    return {
        "reference": f"ANSI/AISC 360-22 Section H1 ({equation})",
        "equation": equation,
        "force_type": force_type,
        "axial_ratio": round(axial_ratio, 6),
        "flexural_ratio_sum": round(flexural_sum, 6),
        "utilization": round(utilization, 6),
        "result": "PASS" if utilization <= 1.0 + 1e-12 else "FAIL",
        "input_summary": {
            "Pr_kN": p, "Pc_kN": pc, "Mrx_kNm": mx, "Mcx_kNm": mcx,
            "Mry_kNm": my, "Mcy_kNm": mcy,
        },
        "limitations": [
            "Only qualifying steel members and axes under AISC 360-22 H1 may use this interaction.",
            "Input capacities must already represent the available LRFD or ASD strengths including relevant Chapter D/E/F limit states.",
            "This does not calculate member stability, strength, connection adequacy, torsion or complete code compliance.",
        ],
    }
