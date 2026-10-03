#!/usr/bin/env python3
"""Executable layer rules for the race runtime (not a full GDScript parser).

Resolve global class names as well as literal load/preload/extends paths. Ignore
comments and strings when checking identifiers. Explicitly reject dynamic script
loads in inward layers so they cannot silently bypass the dependency graph.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from gdscript_contracts import (
    aggregate_dispatch_sources,
    bounded_resource_path,
    global_classes,
    inheritance_sources,
    mask,
)

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {
    "domain": {"domain"},
    "application": {"domain", "application"},
    "services": {"domain", "application", "services"},
    "ui": {"domain", "application", "ui"},
    "composition": {"domain", "application", "services", "ui", "composition"},
}
ENGINE_AUTHORITY = {
    "ClassDB",
    "Node",
    "Node2D",
    "Node3D",
    "Control",
    "SceneTree",
    "Timer",
    "Input",
    "DisplayServer",
    "RenderingServer",
    "AudioServer",
    "FileAccess",
    "DirAccess",
    "OS",
    "ProjectSettings",
    "ResourceLoader",
    "App",
}
PRESENTATION_AUTHORITY = {
    "GameToolbox",
    "GameToolboxFactory",
    "DeveloperWeekends",
    "DeveloperWeekendSession",
    "DeveloperCampaigns",
    "DeveloperTracks",
    "TrackReferencePreview",
    "RaceSessionRunner",
    "ReplayPlayback",
    "RaceViewSession",
    "MinimalRaceSession",
    "ReplaySessionBinding",
    "RaceCar",
    "RaceSim",
    "RaceSimPort",
    "RaceSimFoundation",
    "RaceSimCore",
    "RaceSimOperations",
    "PracticeRaceSim",
    "StrategyRaceSim",
    "RecoveryRaceSim",
    "WeatherRaceSim",
    "App",
    "Storage",
    "FileAccess",
    "DirAccess",
    "ReplayStorage",
    "RaceReplay",
    "CircuitNotebook",
    "ResultReceipts",
    "RaceMomentDirector",
}


@dataclass(frozen=True)
class Violation:
    path: str
    line: int
    rule: str
    detail: str


def layer(path: str) -> str:
    parts = path.split("/")
    return parts[1] if len(parts) > 2 and parts[0] == "scripts" else ""


def _inspect_identifiers(
    path: str, text: str, classes: dict[str, str], authority_paths: set[str], fail
) -> None:
    own = layer(path)
    for match in re.finditer(r"\b[A-Za-z_]\w*\b", text):
        name = match[0]
        target = classes.get(name)
        if target and layer(target) not in ALLOWED[own]:
            fail(path, match.start(), "dependency-direction", f"{name} -> {target}")
        if own == "domain" and name in ENGINE_AUTHORITY:
            fail(path, match.start(), "domain-engine-authority", name)
        if own == "domain" and name == "Time":
            fail(path, match.start(), "domain-wall-clock", name)
        if own == "ui" and (name in PRESENTATION_AUTHORITY or target in authority_paths):
            fail(path, match.start(), "detached-renderer", name)


def _inspect_literal(path: str, target: str, pos: int, authority_paths: set[str], fail) -> None:
    if not target.endswith(".gd"):
        return
    own = layer(path)
    resolved = bounded_resource_path(target)
    if resolved is None:
        fail(path, pos, "unbounded-script-path", target)
        return
    if layer(resolved) not in ALLOWED[own]:
        fail(path, pos, "literal-dependency", resolved)
    if own == "ui" and resolved in authority_paths:
        fail(path, pos, "detached-renderer", f"Literal authority reference: {resolved}")


def _inspect_loads(path: str, text: str, source: str, authority_paths: set[str], fail) -> None:
    own = layer(path)
    # Positions are preserved by mask(), so literals can be recovered without
    # matching "load(...)" inside comments or documentation strings.
    for match in re.finditer(r"\b(load|preload)\s*\(|\bextends\b", text):
        literal = re.match(r"\s*([\'\"])([^\'\"]+)\1", source[match.end() :])
        if literal and match[1]:
            trailing = text[match.end() + literal.end() :]
            if not re.match(r"\s*,?\s*\)", trailing):
                literal = None  # A literal prefix is still a computed dependency.
        if literal:
            _inspect_literal(path, literal[2], match.start(), authority_paths, fail)
        elif own in {"domain", "application"} and match[1]:
            fail(
                path,
                match.start(),
                "dynamic-load",
                "Inward layers require explicit dependencies",
            )


def _inspect_presentation(path: str, text: str, fail) -> None:
    own = layer(path)
    if path in {"scripts/ui/editor.gd", "scripts/ui/track_canvas.gd"}:
        for match in re.finditer(r"\bTrackGeometry\s*\.\s*new\s*\(", text):
            fail(
                path,
                match.start(),
                "editor-owns-compilation",
                "Inject an application draft compiler",
            )
    if own == "ui":
        for match in re.finditer(r"\.\s*source\s*\.\s*get_ref\s*\(", text):
            fail(path, match.start(), "presentation-private-authority", "record source aggregate")
        for match in re.finditer(
            r"\.\s*(_source|_simulation|_director|_player|_runner|_playback)\b", text
        ):
            fail(path, match.start(), "presentation-private-authority", match[1])
        for match in re.finditer(r"\.\s*(advance|advance_preview|step|tick)\s*\(", text):
            fail(path, match.start(), "ui-drives-simulation", match[1])


def _authority_ancestry(
    sources: dict[str, str], classes: dict[str, str]
) -> tuple[set[str], list[Violation]]:
    paths = set()
    errors = []
    for name, path in classes.items():
        if name in PRESENTATION_AUTHORITY:
            try:
                paths.update(
                    parent for parent, _ in inheritance_sources(sources, path, classes=classes)
                )
            except ValueError as error:
                paths.add(path)
                errors.append(Violation(path, 1, "authority-inheritance", str(error)))
    # Descendants keep authority even without an explicit global name. Resolve
    # full chains so aliases across layers or several subclasses cannot hide it.
    roots = paths.copy()
    for path in sources:
        # Service and composition types are already forbidden to UI by direction;
        # follow the layers where a renamed authority could otherwise be allowed.
        if layer(path) not in ALLOWED["ui"]:
            continue
        try:
            chain = {parent for parent, _ in inheritance_sources(sources, path, classes=classes)}
        except ValueError as error:
            if not any(existing.path == path for existing in errors):
                errors.append(Violation(path, 1, "authority-inheritance", str(error)))
            continue
        if chain & roots:
            paths.update(chain)
    return paths, errors


def inspect(root: Path) -> tuple[list[Violation], int]:
    sources = {
        p.relative_to(root).as_posix(): p.read_text(encoding="utf-8")
        for p in sorted((root / "scripts").rglob("*.gd"))
    }
    code = {path: mask(text) for path, text in sources.items()}
    try:
        classes = global_classes(sources)
    except ValueError as error:
        return [Violation("scripts", 1, "script-global-class", str(error))], len(sources)
    authority_paths, errors = _authority_ancestry(sources, classes)

    def fail(path: str, pos: int, rule: str, detail: str) -> None:
        errors.append(Violation(path, code[path][:pos].count("\n") + 1, rule, detail))

    for path, text in code.items():
        if layer(path) not in ALLOWED:
            continue
        _inspect_identifiers(path, text, classes, authority_paths, fail)
        _inspect_loads(path, text, sources[path], authority_paths, fail)
        _inspect_presentation(path, text, fail)
    # Providers must declare actual dispatch hooks, never unrelated aggregate helpers.
    aggregate_path = "scripts/domain/race_sim.gd"
    contract_path = "scripts/domain/mechanics/race_hook_contract.gd"
    if aggregate_path in sources and contract_path in sources:
        dispatched = []
        try:
            aggregate_sources = aggregate_dispatch_sources(sources, aggregate_path)
        except ValueError as error:
            fail(aggregate_path, 0, "mechanic-hook-contract", str(error))
            aggregate_sources = []
        for _, source in aggregate_sources:
            for call in re.finditer(r"\bmechanics\s*\.\s*invoke\s*\(", mask(source)):
                literal = re.match(r'\s*"([^"\n]+)"', source[call.end() :])
                if literal:
                    dispatched.append(literal[1])
        block = re.search(r"const HOOKS: Array\[String\] = \[(.*?)\]", sources[contract_path], re.S)
        declared = re.findall(r'"([^"\n]+)"', block[1]) if block else []
        if (
            not declared
            or sorted(dispatched) != sorted(declared)
            or len(declared) != len(set(declared))
        ):
            fail(
                contract_path,
                0,
                "mechanic-hook-contract",
                "Declared hooks must match aggregate dispatch entry points exactly",
            )
    return errors, len(sources)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    errors, count = inspect(args.root.resolve())
    report = {
        "passed": not errors,
        "scripts_scanned": count,
        "violations": [v.__dict__ for v in errors],
        "scope": "Static architectural fitness rules; not a GDScript typechecker or proof against arbitrary reflection",
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return int(bool(errors))


if __name__ == "__main__":
    sys.exit(main())
