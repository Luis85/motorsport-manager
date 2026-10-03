#!/usr/bin/env python3
"""Inspect rule contracts or scaffold a no-op mechanic and its registered regression.

Generated providers are NOT enabled in any production profile. Inspection and
scaffolding read explicit source contracts; validate delegates actual execution
to the existing isolated verification runner and its single suite registry.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

from gdscript_contracts import inheritance_sources, mask

ROOT = Path(__file__).resolve().parents[1]
MECHANICS = Path("scripts/domain/mechanics")
REGISTRY = Path("scripts/verification_suites.json")
IDENTITY = re.compile(r"[a-z][a-z0-9_]{0,47}\Z")


def profiles(root: Path) -> list[str]:
    text = (root / MECHANICS / "race_mechanic_profiles.gd").read_text(encoding="utf-8")
    match = re.search(r"const ORDER:\s*Array\[String\]\s*=\s*(\[[^\]]+\])", text)
    if not match:
        raise ValueError("Cannot read the explicit production profile order")
    return json.loads(match[1])


def _source_hook_contracts(text: str) -> dict[str, tuple[str, str]]:
    result = {}
    code = mask(text)
    headers = list(re.finditer(r"^func (\w+)\([\s\S]*?\)\s*->\s*[^:\n]+:", code, re.M))
    for index, header in enumerate(headers):
        end = headers[index + 1].start() if index + 1 < len(headers) else len(code)
        calls = list(re.finditer(r"\bmechanics\s*\.\s*invoke\s*\(", code[header.end() : end]))
        if not calls:
            continue
        if len(calls) != 1:
            raise ValueError(f"{header[1]}: expected one explicit aggregate dispatch")
        position = header.end() + calls[0].end()
        literal = re.match(r'\s*([\'"])([^\'"\n]+)\1', text[position:])
        if not literal or header[1] != literal[2]:
            raise ValueError("Aggregate dispatch identity differs from its method name")
        signature = re.match(r"func \w+\(([\s\S]*?)\)\s*->\s*([^:\n]+):", text[header.start() :])
        arguments = " ".join(signature[1].split()).rstrip(",")
        result[header[1]] = (arguments, signature[2].strip())
    return result


def hook_contracts(root: Path) -> dict[str, tuple[str, str]]:
    sources = {
        path.relative_to(root).as_posix(): path.read_text(encoding="utf-8")
        for path in (root / "scripts").rglob("*.gd")
    }
    result = {}
    for path, source in inheritance_sources(sources, "scripts/domain/race_sim.gd"):
        declarations = _source_hook_contracts(source)
        duplicates = result.keys() & declarations.keys()
        if duplicates:
            raise ValueError(f"{path}: repeated aggregate hook dispatch: {sorted(duplicates)}")
        result.update(declarations)
    if not result:
        raise ValueError("No typed aggregate hook contracts found")
    return result


def _validate_provider(item: dict, known: set[str], order: list[str], contracts: dict) -> None:
    where = item["source"] + ": "
    if item["id"].strip() != item["id"] or any(c.isspace() for c in item["id"]):
        raise ValueError(where + "identity must not contain whitespace")
    if type(item.get("version")) is not int or item["version"] < 1:
        raise ValueError(where + "version must be a positive integer")
    for field in ["requires", "hooks"]:
        values = item.get(field)
        if not isinstance(values, list) or any(not isinstance(x, str) or not x for x in values):
            raise ValueError(where + field + " must contain non-empty string names")
        if len(values) != len(set(values)):
            raise ValueError(where + "duplicate " + field)
    for dependency in item["requires"]:
        if dependency not in known or dependency == item["id"]:
            raise ValueError(where + "unknown or self prerequisite: " + dependency)
        if item["id"] in order and dependency not in order[: order.index(item["id"])]:
            raise ValueError(where + "requires an earlier production provider: " + dependency)
    for hook in item["hooks"]:
        if hook not in contracts:
            raise ValueError(where + "unsupported hook: " + hook)


def validate_definitions(providers: list[dict], order: list[str], contracts: dict) -> None:
    """Early author feedback; runtime reflection and behavior suites remain authoritative."""
    known = {item["id"] for item in providers}
    if len(order) != len(set(order)) or set(order) - known:
        raise ValueError("Production profile order must name unique, declared providers")
    if len(known) != len(providers):
        raise ValueError("Mechanic provider identities must be unique")
    for item in providers:
        _validate_provider(item, known, order, contracts)
    visiting, visited = set(), set()
    by_id = {item["id"]: item for item in providers}

    def visit(identity: str) -> None:
        if identity in visiting:
            raise ValueError(by_id[identity]["source"] + ": cyclic mechanic prerequisites")
        if identity in visited:
            return
        visiting.add(identity)
        for dependency in by_id[identity]["requires"]:
            visit(dependency)
        visiting.remove(identity)
        visited.add(identity)

    for identity in by_id:
        visit(identity)


def validate_predecessors(text: str, item: dict) -> None:
    """Check literal predecessor assumptions, including calls from owned helpers.

    Dynamic aliases/arguments cannot establish correctness and need real runtime
    behavior tests. Comments and string examples must not masquerade as calls.
    """
    code = mask(text)
    for call in re.finditer(r"\b\w+\s*\.\s*mechanics\s*\.\s*before\s*\(", code):
        literals = re.match(
            r'\s*([\'"])([^\'"\n]+)\1\s*,\s*([\'"])([^\'"\n]+)\3', text[call.end() :]
        )
        if not literals:
            continue
        where = f"{item['source']}:{text[: call.start()].count(chr(10)) + 1}: "
        if literals[2] != item["id"]:
            raise ValueError(where + "predecessor identity must be " + item["id"])
        if literals[4] not in item["hooks"]:
            raise ValueError(where + "undeclared predecessor hook: " + literals[4])


def catalog(root: Path) -> list[dict]:
    result = []
    order = profiles(root)
    for path in sorted((root / MECHANICS).glob("*_mechanic.gd")):
        text = path.read_text(encoding="utf-8")
        match = re.search(
            r"^func definition\(\)\s*->\s*Dictionary:\s+return\s+(?=\{)", mask(text), re.M
        )
        if path.name == "race_mechanic.gd":
            continue  # The interface intentionally returns no definition.
        if not match:
            raise ValueError(
                f"{path.relative_to(root)}: expected a literal definition() record; cannot silently omit a provider"
            )
        try:
            item, end = json.JSONDecoder().raw_decode(text[match.end() :])
            trailing = text[match.end() + end :].split("\n", 1)[0].strip()
            if trailing and not trailing.startswith("#"):
                raise ValueError("definition must return only a literal JSON record")
        except ValueError as error:
            raise ValueError(
                f"{path.relative_to(root)}: invalid definition JSON: {error}"
            ) from error
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
            raise ValueError(f"{path.relative_to(root)}: definition requires a non-empty identity")
        if any(existing["id"] == item["id"] for existing in result):
            raise ValueError(f"{path.relative_to(root)}: duplicate mechanic identity {item['id']}")
        item["source"] = path.relative_to(root).as_posix()
        item["profiles"] = order[order.index(item["id"]) :] if item["id"] in order else []
        result.append(item)
    validate_definitions(result, order, hook_contracts(root))
    for item in result:
        validate_predecessors((root / item["source"]).read_text(encoding="utf-8"), item)
    return result


def validation_suites(root: Path, identities: list[str] | None = None) -> list[str]:
    """Select registered runtime contracts, never discover or enable runtime scripts."""
    providers = catalog(root)
    known = {item["id"]: item for item in providers}
    selected = list(known) if not identities else list(dict.fromkeys(identities))
    unknown = set(selected) - set(known)
    if unknown:
        raise ValueError(
            "Unknown mechanics: " + ", ".join(sorted(unknown)) + "; run the list command"
        )
    registered = json.loads((root / REGISTRY).read_text(encoding="utf-8"))
    available = {item["id"] for item in registered}
    suites = ["mechanics_tests"]
    for identity in selected:
        if not known[identity]["profiles"]:
            suites.append("extension_" + identity)
    missing = set(suites) - available
    if missing:
        raise ValueError("Register behavior tests before validating: " + ", ".join(sorted(missing)))
    return suites


def run_validation(suites: list[str], godot: str | None) -> int:
    """Use the normal import, preflight, timeout, error and evidence policy in-process."""
    from verification_run import main as verify_main

    arguments = ["verify.py"]
    if godot:
        arguments += ["--godot", godot]
    for suite in suites:
        arguments += ["--suite", suite]
    previous = sys.argv
    try:
        sys.argv = arguments
        return verify_main()
    finally:
        sys.argv = previous


def scaffold(root: Path, identity: str, hooks: list[str], profile: str) -> dict[Path, str]:
    if not IDENTITY.fullmatch(identity):
        raise ValueError("Use a lowercase snake_case identity, at most 48 characters")
    if identity in {item["id"] for item in catalog(root)}:
        raise ValueError("A mechanic already declares that identity")
    if profile not in profiles(root):
        raise ValueError("Choose a supported predecessor profile")
    contracts = hook_contracts(root)
    if not hooks or len(set(hooks)) != len(hooks) or any(hook not in contracts for hook in hooks):
        raise ValueError("Choose unique hooks from the hooks command")
    class_name = "".join(part.capitalize() for part in identity.split("_")) + "Mechanic"
    for path in (root / "scripts").rglob("*.gd"):
        if re.search(
            r"^class_name\s+" + re.escape(class_name) + r"\s*$",
            path.read_text(encoding="utf-8"),
            re.M,
        ):
            raise ValueError("The generated global class name already exists")
    definition = {"id": identity, "version": 1, "requires": [profile], "hooks": hooks}
    source = (
        f"class_name {class_name}\nextends RaceMechanic\n"
        "## No-op extension: review and enable explicitly in a NEW session profile.\n"
        "## Keep state in the aggregate; never retain sim, own time, or read a view.\n\n"
        "func definition() -> Dictionary:\n\treturn " + json.dumps(definition) + "\n"
    )
    for hook in hooks:
        parameters, returns = contracts[hook]
        names = [p.split(":")[0].strip() for p in parameters.split(",")] if parameters else []
        if any(not re.fullmatch(r"\w+", name) for name in names):
            raise ValueError(f"Complex signature for {hook}; write this provider manually")
        source += (
            f"\nfunc {hook}(sim: RaceSim"
            + (", " + parameters if parameters else "")
            + f") -> {returns}:\n"
            "\t# Preserve the predecessor until a separately tested rule is implemented.\n\t"
            + ("return " if returns != "void" else "")
            + f'sim.mechanics.before("{identity}", "{hook}", ['
            + ", ".join(names)
            + "])\n"
        )
    probes = ""
    # Explicit safe observations exercise both scalar and typed-car signatures.
    # Other hooks still require author-written behavior tests, not guessed inputs.
    for hook, arguments in [
        ("forecast_parameters", "3"),
        ("weather_advice", "3"),
        ("neutral", "{owner}.cars[3]"),
    ]:
        if hook in hooks:
            candidate = arguments.format(owner="candidate")
            reference = arguments.format(owner="reference")
            probes += (
                f"\tcheck(candidate.{hook}({candidate}) == reference.{hook}({reference}), "
                f'"Generated {hook} dispatch preserves its predecessor observation")\n'
            )
    profile_class = profile.capitalize() + "RaceSim"
    test_path = Path(f"tests/extensions/{identity}_tests.gd")
    report_name = f"extension-{identity}.json"
    test = f'''extends SceneTree
## Generated registration/equivalence smoke test. Add rule-specific invariants before enabling.
var checks: int = 0
var failures: Array[String] = []

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var track = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
	var reference = {profile_class}.new(track)
	var candidate = RaceSim.new(track)
	var providers = RaceMechanicProfiles.build("{profile}")
	providers.append({class_name}.new())
	check(candidate.mechanics.configure(providers), "Generated provider satisfies its construction contract: " + candidate.mechanics.last_error)
	check(candidate.mechanics.install(track, {{}}), "Generated profile installs once: " + candidate.mechanics.last_error)
	check(candidate.has_mechanic("{identity}"), "The explicit composition contains the extension")
	check(RaceStateValue.fingerprint(reference.snapshot()) == RaceStateValue.fingerprint(candidate.snapshot()), "No-op installation preserves full state and RNG")
	var action = "practice_start" if reference.has_mechanic("practice") else "qualify"
	check(candidate.command(action) and reference.command(action), "Both profiles enter an actual active session")
{probes}	for index in range(40):
		reference.step()
		candidate.step()
	check(RaceStateValue.fingerprint(reference.snapshot()) == RaceStateValue.fingerprint(candidate.snapshot()), "Pass-through hooks preserve authoritative progression")
	var report = {{"passed": failures.is_empty(), "checks": checks, "failures": failures}}
	Storage.write_json("res://reports/{report_name}", report)
	print("EXTENSION_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
'''
    records = json.loads((root / REGISTRY).read_text(encoding="utf-8"))
    suite_id = f"extension_{identity}"
    if any(item["id"] == suite_id for item in records):
        raise ValueError("The generated verification suite already exists")
    records.append(
        {
            "id": suite_id,
            "script": test_path.as_posix(),
            "native": False,
            "layout": "minimal",
            "timeout": 360,
            "reports": [report_name],
        }
    )
    return {
        MECHANICS / f"{identity}_mechanic.gd": source,
        test_path: test,
        REGISTRY: json.dumps(records, indent=2) + "\n",
    }


def publish(root: Path, files: dict[Path, str]) -> None:
    """Validate all targets first; rollback completed writes if a later write fails."""
    previous: dict[Path, bytes | None] = {}
    for relative in files:
        path = root / relative
        if not path.resolve().is_relative_to(root.resolve()) or path.is_symlink():
            raise ValueError("Refusing a path outside the project or through a symlink")
        if path.exists() and relative != REGISTRY:
            raise ValueError(f"Refusing to overwrite {relative}")
        previous[path] = path.read_bytes() if path.exists() else None
    written: list[Path] = []
    try:
        for relative, content in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(content.encode("utf-8"))
            try:
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)
            written.append(path)
    except OSError:
        for path in reversed(written):
            old = previous[path]
            if old is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(old)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="Print declared providers and production profiles as JSON")
    sub.add_parser("hooks", help="Print authoritative extension signatures as JSON")
    validate = sub.add_parser(
        "validate", help="Run registered construction and extension tests in isolated Godot"
    )
    validate.add_argument(
        "--mechanic",
        action="append",
        dest="identities",
        help="Limit inactive extension tests; production construction tests always run",
    )
    validate.add_argument(
        "--godot", help="Pinned Godot executable; otherwise use GODOT_BINARY or PATH"
    )
    validate.add_argument(
        "--dry-run",
        action="store_true",
        help="Show selection without claiming validation or executing Godot",
    )
    create = sub.add_parser(
        "scaffold", help="Create an inactive no-op provider and registered test"
    )
    create.add_argument("identity")
    create.add_argument("--hook", action="append", dest="hooks")
    create.add_argument("--profile", default="practice")
    create.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "list":
            result = catalog(ROOT)
        elif args.command == "hooks":
            result = {
                name: f"({params}) -> {returns}"
                for name, (params, returns) in hook_contracts(ROOT).items()
            }
        elif args.command == "validate":
            selected = validation_suites(ROOT, args.identities)
            if not args.dry_run:
                return run_validation(selected, args.godot)
            result = {
                "status": "planned",
                "suites": selected,
                "engine_executed": False,
                "scope": "Registered construction and behavior tests; not proof of arbitrary new rules",
            }
        else:
            files = scaffold(
                ROOT, args.identity, args.hooks or ["forecast_parameters"], args.profile
            )
            if not args.dry_run:
                publish(ROOT, files)
            result = {
                "created": not args.dry_run,
                "files": [p.as_posix() for p in files],
                "enabled_in_game": False,
                "verify": f"python3 scripts/verify.py --suite extension_{args.identity}",
                "next": "Implement rule-specific tests, then explicitly add the provider to the intended new-session profile. Version and migrate any saved state.",
            }
        print(json.dumps(result, indent=2))
        return 0
    except (ValueError, OSError, KeyError) as error:
        print(f"mechanics: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
