"""Local elastic 3D frame section-resultant diagrams from OpenSees end forces.

The OpenSees eleForce response is GLOBAL and must not be labeled local.
Use eleResponse(member, 'localForce') for the 12 local end resultants.

Section sign convention: positive internal axial N is tension, at x=0+
N=-N_i. Shears and moments are cut resultants on the left face.
Full-span local uniform Wy and Wz loads are integrated by equilibrium.
"""
from __future__ import annotations

import math


def local_member_force_diagram(
    local_end_forces: list[float],
    length_m: float,
    *,
    wy_kn_per_m: float = 0.0,
    wz_kn_per_m: float = 0.0,
    stations: int = 41,
) -> dict:
    if len(local_end_forces) != 12:
        raise ValueError("Local 3D element force vector must have 12 entries.")
    numeric = [float(v) for v in local_end_forces]
    if not all(math.isfinite(v) for v in numeric):
        raise ValueError("Local end forces must be finite.")
    if not math.isfinite(length_m) or length_m <= 0:
        raise ValueError("Member length must be finite and positive.")
    if not all(math.isfinite(float(v)) for v in (wy_kn_per_m, wz_kn_per_m)):
        raise ValueError("Uniform member loads must be finite.")
    if stations < 2 or stations > 201:
        raise ValueError("Stations must be between 2 and 201.")

    ni, vyi, vzi, ti, myi, mzi, nj, vyj, vzj, tj, myj, mzj = numeric
    wy, wz = float(wy_kn_per_m), float(wz_kn_per_m)
    xs = [length_m * index / (stations - 1) for index in range(stations)]
    curves = {
        "N": [-ni for _ in xs],
        "Vy": [-vyi - wy * x for x in xs],
        "Vz": [-vzi - wz * x for x in xs],
        "T": [-ti for _ in xs],
        "My": [-myi - vzi * x - wz * x * x / 2.0 for x in xs],
        "Mz": [-mzi + vyi * x + wy * x * x / 2.0 for x in xs],
    }

    # Check equilibrium at the far end. The residual is given to the user
    # rather than suppressing potentially inconsistent local results.
    endpoint_residuals = {
        "N": curves["N"][-1] - nj,
        "Vy": curves["Vy"][-1] - vyj,
        "Vz": curves["Vz"][-1] - vzj,
        "T": curves["T"][-1] - tj,
        "My": curves["My"][-1] - myj,
        "Mz": curves["Mz"][-1] - mzj,
    }
    units = {"N": "kN", "Vy": "kN", "Vz": "kN", "T": "kN-m", "My": "kN-m", "Mz": "kN-m"}
    return {
        "station_m": [round(x, 6) for x in xs],
        "components": {
            name: [round(v, 7) for v in values] for name, values in curves.items()
        },
        "ranges": {
            name: {"min": round(min(values), 7), "max": round(max(values), 7),
                   "max_abs": round(max(abs(v) for v in values), 7),
                   "unit": units[name]}
            for name, values in curves.items()
        },
        "local_uniform_loads": {"wy_kn_per_m": wy, "wz_kn_per_m": wz},
        "end_equilibrium_residuals": {name: round(v, 6) for name, v in endpoint_residuals.items()},
        "reference": "OpenSees elasticBeamColumn 3D localForce; section equilibrium under full-length uniform local loads",
        "limitations": [
            "Local member axes and signs follow OpenSees coordinate transformations.",
            "Only elasticBeamColumn frame members with full-span uniform local Wy/Wz loads are represented; no interior point loads are modeled.",
            "Under geometric PDelta transformation, geometric stiffness effects may require additional section-by-section equilibrium verification.",
            "Diagrams are for the selected load combination and cannot replace code load-envelope and member design checks.",
        ],
    }
