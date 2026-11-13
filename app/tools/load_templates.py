"""Selected ASCE/SEI 7-22 LRFD load-case templates for 3D frame models.

These are not an exhaustive code combination set. Directional earthquake cases
must already include relevant rho / Ev effects under a designer's definition.
"""
from __future__ import annotations

SUPPORTED = frozenset({"D", "L", "S", "W", "EX", "EY"})


def representative_strength_combinations(cases: list[str]) -> dict:
    if not isinstance(cases, list) or len(cases) > 10:
        raise ValueError("cases must contain up to 10 case identifiers.")
    selected = set(cases)
    if not selected or not selected.issubset(SUPPORTED):
        raise ValueError("Supported cases: D, L, S, W, EX, EY.")
    if "D" not in selected:
        raise ValueError("D (dead load) is required for these templates.")

    combos: list[dict] = []

    def add(name: str, factors: dict[str, float]) -> None:
        if all(case in selected for case in factors):
            combos.append({"name": name, "factors": factors})

    add("1.4D", {"D": 1.4})
    add("1.2D+1.6L", {"D": 1.2, "L": 1.6})
    add("1.2D+1.6S", {"D": 1.2, "S": 1.6})
    add("1.2D+1.6L+0.5S", {"D": 1.2, "L": 1.6, "S": 0.5})
    add("1.2D+1.6S+1.0L", {"D": 1.2, "S": 1.6, "L": 1.0})
    for sign in (-1.0, 1.0):
        symbol = "+" if sign > 0 else "-"
        for name, factors in [
            (f"1.2D+L{symbol}W", {"D": 1.2, "L": 1.0, "W": sign}),
            (f"0.9D{symbol}W", {"D": 0.9, "W": sign}),
            (f"1.2D+L{symbol}EX", {"D": 1.2, "L": 1.0, "EX": sign}),
            (f"1.2D+L{symbol}EY", {"D": 1.2, "L": 1.0, "EY": sign}),
            (f"0.9D{symbol}EX", {"D": 0.9, "EX": sign}),
            (f"0.9D{symbol}EY", {"D": 0.9, "EY": sign}),
        ]:
            add(name, factors)

    return {
        "edition": "ASCE/SEI 7-22 Chapter 2 - representative LRFD strength templates",
        "combinations": combos,
        "warnings": [
            "Not an exhaustive or automatically validated design combination set.",
            "Lr and rain load cases, special load combinations, overstrength, vertical seismic effects, redundancy factors and orthogonal combinations require separate design checks.",
            "EX and EY must be user-defined code-consistent earthquake effects; these templates only multiply existing cases.",
            "Use dedicated elastic seismic combinations for drift, not these strength combinations.",
        ],
    }
