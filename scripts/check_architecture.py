#!/usr/bin/env python3
"""Executable layer rules for the race runtime (not a full GDScript parser).

Resolve global class names as well as literal load/preload/extends paths. Ignore
comments and strings when checking identifiers. Explicitly reject dynamic script
loads in inward layers so they cannot silently bypass the dependency graph.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
TOKEN = re.compile(r'(?P<comment>\#[^\n]*)|(?P<string>"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')')
ALLOWED = {
    'domain': {'domain'},
    'application': {'domain', 'application'},
    'services': {'domain', 'application', 'services'},
    'ui': {'domain', 'application', 'ui'},
    'composition': {'domain', 'application', 'services', 'ui', 'composition'},
}
ENGINE_AUTHORITY = {'Node', 'Node2D', 'Node3D', 'Control', 'SceneTree', 'Timer',
                    'Input', 'DisplayServer', 'RenderingServer', 'AudioServer',
                    'FileAccess', 'DirAccess', 'OS', 'ProjectSettings', 'ResourceLoader', 'App'}


@dataclass(frozen=True)
class Violation:
    path: str
    line: int
    rule: str
    detail: str


def mask(source: str) -> str:
    return TOKEN.sub(lambda m: ''.join('\n' if c == '\n' else ' ' for c in m[0]), source)


def layer(path: str) -> str:
    parts = path.split('/')
    return parts[1] if len(parts) > 2 and parts[0] == 'scripts' else ''


def inspect(root: Path) -> tuple[list[Violation], int]:
    sources = {p.relative_to(root).as_posix(): p.read_text(encoding='utf-8')
               for p in sorted((root / 'scripts').rglob('*.gd'))}
    code = {path: mask(text) for path, text in sources.items()}
    classes: dict[str, str] = {}
    for path, text in code.items():
        match = re.search(r'^class_name\s+(\w+)', text, re.M)
        if match:
            classes[match[1]] = path
    errors: list[Violation] = []
    def fail(path: str, pos: int, rule: str, detail: str) -> None:
        errors.append(Violation(path, code[path][:pos].count('\n') + 1, rule, detail))
    for path, text in code.items():
        own = layer(path)
        if own not in ALLOWED:
            continue
        for match in re.finditer(r'\b[A-Za-z_]\w*\b', text):
            name = match[0]
            target = classes.get(name)
            if target and layer(target) not in ALLOWED[own]:
                fail(path, match.start(), 'dependency-direction', f'{name} -> {target}')
            if own == 'domain' and name in ENGINE_AUTHORITY:
                fail(path, match.start(), 'domain-engine-authority', name)
            if own == 'domain' and name == 'Time':
                fail(path, match.start(), 'domain-wall-clock', name)
            if own == 'ui' and (name in {'TrackReferencePreview', 'RaceSessionRunner', 'ReplayPlayback', 'RaceViewSession', 'MinimalRaceSession', 'ReplaySessionBinding', 'RaceCar', 'RaceSim', 'PracticeRaceSim', 'StrategyRaceSim', 'RecoveryRaceSim', 'WeatherRaceSim', 'App', 'Storage', 'FileAccess', 'DirAccess', 'ReplayStorage', 'RaceReplay', 'CircuitNotebook', 'ResultReceipts', 'RaceMomentDirector'}):
                fail(path, match.start(), 'detached-renderer', name)
        # Positions are preserved by mask(), so literals can be recovered without
        # matching "load(...)" inside comments or documentation strings.
        for match in re.finditer(r'\b(load|preload)\s*\(|\bextends\b', text):
            literal = re.match(r'\s*([\'\"])([^\'\"]+)\1', sources[path][match.end():])
            if literal:
                target = literal[2].removeprefix('res://')
                if target.endswith('.gd') and layer(target) not in ALLOWED[own]:
                    fail(path, match.start(), 'literal-dependency', target)
            elif own in {'domain', 'application'} and match[1]:
                fail(path, match.start(), 'dynamic-load', 'Inward layers require explicit dependencies')
        if path in {'scripts/ui/editor.gd', 'scripts/ui/track_canvas.gd'}:
            for match in re.finditer(r'\bTrackGeometry\s*\.\s*new\s*\(', text):
                fail(path, match.start(), 'editor-owns-compilation', 'Inject an application draft compiler')
        if own == 'ui':
            for match in re.finditer(r'\.\s*source\s*\.\s*get_ref\s*\(', text):
                fail(path, match.start(), 'presentation-private-authority', 'record source aggregate')
            for match in re.finditer(r'\.\s*(_source|_simulation|_director|_player|_runner|_playback)\b', text):
                fail(path, match.start(), 'presentation-private-authority', match[1])
            for match in re.finditer(r'\.\s*(advance|advance_preview|step|tick)\s*\(', text):
                fail(path, match.start(), 'ui-drives-simulation', match[1])
    # Providers must declare actual dispatch hooks, never unrelated aggregate helpers.
    aggregate_path = 'scripts/domain/race_sim.gd'
    contract_path = 'scripts/domain/mechanics/race_hook_contract.gd'
    if aggregate_path in sources and contract_path in sources:
        dispatched = re.findall(r'mechanics\.invoke\("([^"\n]+)"', sources[aggregate_path])
        block = re.search(r'const HOOKS: Array\[String\] = \[(.*?)\]', sources[contract_path], re.S)
        declared = re.findall(r'"([^"\n]+)"', block[1]) if block else []
        if sorted(dispatched) != sorted(declared) or len(declared) != len(set(declared)):
            fail(contract_path, 0, 'mechanic-hook-contract', 'Declared hooks must match aggregate dispatch entry points exactly')
    return errors, len(sources)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    errors, count = inspect(args.root.resolve())
    report = {'passed': not errors, 'scripts_scanned': count,
              'violations': [v.__dict__ for v in errors],
              'scope': 'Static architectural fitness rules; not a GDScript typechecker or proof against arbitrary reflection'}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return int(bool(errors))

if __name__ == '__main__':
    sys.exit(main())
