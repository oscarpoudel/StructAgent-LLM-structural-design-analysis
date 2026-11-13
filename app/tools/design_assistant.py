"""Ollama-assisted steel design request routing with deterministic calculations.

Ollama proposes a typed operation and extracts numerical inputs. Inputs are
checked against numeric literals actually present in the user's request.
The LLM never supplies calculated capacities or PASS/FAIL assertions.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.models import BeamSelectionInputs, ColumnSelectionInputs
from app.tools.code_checks import check_steel_h1_interaction
from app.tools.section_select import select_beam, select_column


class DesignTool(BaseModel):
    action: Literal["beam_section", "column_section", "steel_interaction", "clarify"]
    moment_kn_m: float | None = None
    shear_kn: float | None = None
    unbraced_length_m: float | None = None
    fy_mpa: float | None = None
    axial_load_kn: float | None = None
    kl_m: float | None = None
    axial_demand_kn: float | None = None
    available_axial_kn: float | None = None
    mx_demand_kn_m: float | None = None
    mx_available_kn_m: float | None = None
    my_demand_kn_m: float | None = None
    my_available_kn_m: float | None = None
    force_type: Literal["compression", "tension"] = "compression"


REQUIRED = {
    "beam_section": ("moment_kn_m", "shear_kn", "unbraced_length_m", "fy_mpa"),
    "column_section": ("axial_load_kn", "kl_m", "fy_mpa"),
    "steel_interaction": ("axial_demand_kn", "available_axial_kn", "mx_demand_kn_m",
                          "mx_available_kn_m", "my_demand_kn_m", "my_available_kn_m"),
}
LABELS = {
    "moment_kn_m": ["mu", "moment", "bending moment"],
    "shear_kn": ["vu", "shear"],
    "unbraced_length_m": ["lb", "unbraced length"],
    "fy_mpa": ["fy", "yield strength"],
    "axial_load_kn": ["pu", "axial load"],
    "kl_m": ["kl", "effective length"],
    "axial_demand_kn": ["pr", "pu", "axial demand"],
    "available_axial_kn": ["pc", "available axial", "axial capacity"],
    "mx_demand_kn_m": ["mux", "mrx", "mx"],
    "mx_available_kn_m": ["mcx", "major capacity"],
    "my_demand_kn_m": ["muy", "mry", "my"],
    "my_available_kn_m": ["mcy", "minor capacity"],
}
NUMERIC = r"([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)"


def is_design_request(message: str) -> bool:
    return bool(re.search(r"\b(design|size|select|check)\b", message, re.I)
                and re.search(r"\b(beam|column|steel|h1)\b", message, re.I))


def _literal_inputs(message: str) -> dict[str, float]:
    values = {}
    for field, aliases in LABELS.items():
        for alias in aliases:
            pattern = rf"(?<!\w){re.escape(alias)}(?!\w)\s*(?:=|:|is|of)\s*{NUMERIC}"
            match = re.search(pattern, message, flags=re.IGNORECASE)
            if match:
                values[field] = float(match.group(1))
                break
    return values


def _choose_action(message: str) -> str:
    lower = message.lower()
    if re.search(r"(?:h1|interaction|beam.column|combined axial|biaxial)", lower):
        return "steel_interaction"
    if "column" in lower:
        return "column_section"
    return "beam_section"


def _llm_extract(message: str, llm: Any) -> dict[str, Any]:
    schema = {
        "type": "function",
        "function": {
            "name": "extract_design_request",
            "description": "Extract explicitly stated numerical structural design demands; leave missing fields null.",
            "parameters": DesignTool.model_json_schema(),
        },
    }
    try:
        reply = llm.chat(
            system=(
                "You are an engineering input-extraction tool, not a designer. "
                "Choose beam_section, column_section, steel_interaction, or clarify. "
                "Only copy numbers explicitly stated in the user's text. "
                "Never guess missing loads, material properties, capacities or code parameters. "
                "Do not perform any calculations. Use the field names in the schema."
            ),
            messages=[{"role": "user", "content": message}],
            tools=[schema],
            tool_choice="auto",
        )
        raw = (reply.first_tool or {}).get("arguments", {})
        if not raw and reply.text:
            try:
                raw = json.loads(reply.text.strip().strip("`"))
            except (ValueError, TypeError):
                raw = {}
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def respond_to_design_request(message: str, llm: Any) -> dict[str, Any]:
    if len(message) > 2000:
        return {"message": "Please shorten the design request to 2000 characters.", "source": "validation"}
    parsed = _llm_extract(message, llm)
    action = parsed.get("action") if parsed.get("action") in REQUIRED else _choose_action(message)
    # Only explicitly labeled numeric values can reach a solver. Ollama
    # chooses the operation, but guessed values are never executable inputs.
    literal = _literal_inputs(message)
    extracted = {field: literal[field] for field in REQUIRED[action] if field in literal}

    missing = [field for field in REQUIRED[action] if field not in extracted]
    if missing:
        return {
            "message": ("To perform a deterministic design check, provide explicit values for: "
                        + ", ".join(missing) + ". Example: "
                        + ("Design steel beam Mu=220, Vu=80, Lb=3, Fy=345"
                           if action == "beam_section" else
                           "Design steel column Pu=400, KL=4, Fy=345"
                           if action == "column_section" else
                           "Check steel interaction Pr=300, Pc=1200, Mrx=100, Mcx=300, Mry=25, Mcy=150")
                        + ". Units: kN, kN-m, m and MPa as appropriate."),
            "source": "ollama_input_extraction_or_literal_parser",
        }

    try:
        if action == "beam_section":
            data = select_beam(BeamSelectionInputs(
                moment_kn_m=extracted["moment_kn_m"],
                shear_kn=extracted["shear_kn"],
                unbraced_length_m=extracted["unbraced_length_m"],
                fy_mpa=extracted["fy_mpa"],
            ))
            reference = "AISC 360-16 preliminary W-shape library selection, Chapters F/G"
            scope = "Candidate section sizing from a limited section library; not a member design certificate."
        elif action == "column_section":
            data = select_column(ColumnSelectionInputs(
                axial_load_kn=extracted["axial_load_kn"],
                kl_m=extracted["kl_m"],
                fy_mpa=extracted["fy_mpa"],
            ))
            reference = "AISC 360-16 preliminary W-shape library compression selection, Chapter E"
            scope = "Candidate shape only; confirm column end conditions, flexural buckling and other limit states."
        else:
            data = check_steel_h1_interaction(
                axial_demand_kn=extracted["axial_demand_kn"],
                available_axial_kn=extracted["available_axial_kn"],
                mx_demand_kn_m=extracted["mx_demand_kn_m"],
                mx_available_kn_m=extracted["mx_available_kn_m"],
                my_demand_kn_m=extracted["my_demand_kn_m"],
                my_available_kn_m=extracted["my_available_kn_m"],
                force_type="tension" if parsed.get("force_type") == "tension" or "tension" in message.lower() else "compression",
            )
            reference = data["reference"]
            scope = "AISC H1 interaction only, with designer-supplied available member strengths."
    except (ValueError, TypeError) as exc:
        return {"message": "Design inputs rejected: " + str(exc), "source": "deterministic_validation"}

    stamp = datetime.now(UTC).isoformat()
    digest = hashlib.sha256(json.dumps(extracted, sort_keys=True).encode()).hexdigest()
    selected = data.get("selected") if isinstance(data, dict) else None
    if action == "steel_interaction":
        summary = f"{reference}: {data['result']}; utilization {data['utilization']:.3f}."
    elif selected:
        summary = (f"Preliminary candidate {selected['name']}; "
                   f"selection from a limited steel shape library. See the attached input trace.")
    else:
        summary = "No shape in the current limited library satisfies the supplied demands."

    limitations = list(data.get("limitations", data.get("warnings", [])))
    limitations.append("Do not release these preliminary results for construction without independent professional verification.")
    report = [
        "# StructAgent preliminary design tool report",
        "", f"- UTC timestamp: {stamp}", f"- Tool: {action}",
        f"- Code context: {reference}", f"- SHA-256 of stated numeric inputs: {digest}",
        "", "## User-specified inputs",
        *[f"- {field}: {value:g}" for field, value in sorted(extracted.items())],
        "", "## Deterministic result", "", summary,
        "", "```json", json.dumps(data, indent=2, default=str), "```",
        "", "## Scope and warnings", f"- {scope}",
        *[f"- {warning}" for warning in limitations],
    ]
    return {
        "message": summary + " This result was calculated by Python, not generated numerically by Ollama.",
        "source": "ollama_assisted_deterministic_design" if parsed else "deterministic_labeled_input_fallback",
        "design_result": {
            "tool": action, "reference": reference, "inputs": extracted,
            "input_extraction": "explicitly_labeled_numbers_only",
            "result": data, "limitations": limitations, "timestamp_utc": stamp,
            "input_sha256": digest,
        },
        "design_report": "\n".join(report),
    }
