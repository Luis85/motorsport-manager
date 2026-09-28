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
from pathlib import Path
import re
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MECHANICS = Path('scripts/domain/mechanics')
REGISTRY = Path('scripts/verification_suites.json')
IDENTITY = re.compile(r'[a-z][a-z0-9_]{0,47}\Z')


def profiles(root: Path) -> list[str]:
    text = (root / MECHANICS / 'race_mechanic_profiles.gd').read_text(encoding='utf-8')
    match = re.search(r'const ORDER: Array\[String\] = (\[[^\n]+\])', text)
    if not match:
        raise ValueError('Cannot read the explicit production profile order')
    return json.loads(match[1])


def hook_contracts(root: Path) -> dict[str, tuple[str, str]]:
    text = (root / 'scripts/domain/race_sim.gd').read_text(encoding='utf-8')
    result = {}
    for match in re.finditer(r'^func (\w+)\(([^\n]*)\) -> ([^:\n]+):\n\t(?:return )?mechanics\.invoke\("([^"]+)"', text, re.M):
        if match[1] != match[4]:
            raise ValueError('Aggregate dispatch identity differs from its method name')
        result[match[1]] = (match[2], match[3])
    if not result:
        raise ValueError('No typed aggregate hook contracts found')
    return result


def catalog(root: Path) -> list[dict]:
    result = []
    order = profiles(root)
    for path in sorted((root / MECHANICS).glob('*_mechanic.gd')):
        text = path.read_text(encoding='utf-8')
        match = re.search(r'^func definition\(\) -> Dictionary:\n\treturn (\{[^\n]+\})', text, re.M)
        if path.name == 'race_mechanic.gd':
            continue  # The interface intentionally returns no definition.
        if not match:
            raise ValueError(f'{path.relative_to(root)}: expected a literal definition() record; cannot silently omit a provider')
        try:
            item = json.loads(match[1])
        except ValueError as error:
            raise ValueError(f'{path.relative_to(root)}: invalid definition JSON: {error}') from error
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not item['id']:
            raise ValueError(f'{path.relative_to(root)}: definition requires a non-empty identity')
        if any(existing['id'] == item['id'] for existing in result):
            raise ValueError(f'{path.relative_to(root)}: duplicate mechanic identity {item["id"]}')
        item['source'] = path.relative_to(root).as_posix()
        item['profiles'] = order[order.index(item['id']):] if item['id'] in order else []
        result.append(item)
    return result


def validation_suites(root: Path, identities: list[str] | None = None) -> list[str]:
    """Select registered runtime contracts, never discover or enable runtime scripts."""
    providers = catalog(root)
    known = {item['id']: item for item in providers}
    selected = list(known) if not identities else list(dict.fromkeys(identities))
    unknown = set(selected) - set(known)
    if unknown:
        raise ValueError('Unknown mechanics: ' + ', '.join(sorted(unknown)) + '; run the list command')
    registered = json.loads((root / REGISTRY).read_text(encoding='utf-8'))
    available = {item['id'] for item in registered}
    suites = ['mechanics_tests']
    for identity in selected:
        if not known[identity]['profiles']:
            suites.append('extension_' + identity)
    missing = set(suites) - available
    if missing:
        raise ValueError('Register behavior tests before validating: ' + ', '.join(sorted(missing)))
    return suites


def run_validation(suites: list[str], godot: str | None) -> int:
    """Use the normal import, preflight, timeout, error and evidence policy in-process."""
    from verification_run import main as verify_main
    arguments = ['verify.py']
    if godot:
        arguments += ['--godot', godot]
    for suite in suites:
        arguments += ['--suite', suite]
    previous = sys.argv
    try:
        sys.argv = arguments
        return verify_main()
    finally:
        sys.argv = previous


def scaffold(root: Path, identity: str, hooks: list[str], profile: str) -> dict[Path, str]:
    if not IDENTITY.fullmatch(identity):
        raise ValueError('Use a lowercase snake_case identity, at most 48 characters')
    if identity in {item['id'] for item in catalog(root)}:
        raise ValueError('A mechanic already declares that identity')
    if profile not in profiles(root):
        raise ValueError('Choose a supported predecessor profile')
    contracts = hook_contracts(root)
    if not hooks or len(set(hooks)) != len(hooks) or any(hook not in contracts for hook in hooks):
        raise ValueError('Choose unique hooks from the hooks command')
    class_name = ''.join(part.capitalize() for part in identity.split('_')) + 'Mechanic'
    for path in (root / 'scripts').rglob('*.gd'):
        if re.search(r'^class_name\s+' + re.escape(class_name) + r'\s*$', path.read_text(encoding='utf-8'), re.M):
            raise ValueError('The generated global class name already exists')
    definition = {'id': identity, 'version': 1, 'requires': [profile], 'hooks': hooks}
    source = (f'class_name {class_name}\nextends RaceMechanic\n'
              '## No-op extension: review and enable explicitly in a NEW session profile.\n'
              '## Keep state in the aggregate; never retain sim, own time, or read a view.\n\n'
              'func definition() -> Dictionary:\n\treturn ' + json.dumps(definition) + '\n')
    for hook in hooks:
        parameters, returns = contracts[hook]
        names = [p.split(':')[0].strip() for p in parameters.split(',')] if parameters else []
        if any(not re.fullmatch(r'\w+', name) for name in names):
            raise ValueError(f'Complex signature for {hook}; write this provider manually')
        source += (f'\nfunc {hook}(sim: RaceSim' + (', ' + parameters if parameters else '') + f') -> {returns}:\n'
                   '\t# Preserve the predecessor until a separately tested rule is implemented.\n\t'
                   + ('return ' if returns != 'void' else '')
                   + f'sim.mechanics.before("{identity}", "{hook}", [' + ', '.join(names) + '])\n')
    probes = ''
    # Explicit safe observations exercise both scalar and typed-car signatures.
    # Other hooks still require author-written behavior tests, not guessed inputs.
    for hook, arguments in [('forecast_parameters', '3'), ('weather_advice', '3'),
                            ('neutral', '{owner}.cars[3]')]:
        if hook in hooks:
            candidate = arguments.format(owner='candidate')
            reference = arguments.format(owner='reference')
            probes += (f'\tcheck(candidate.{hook}({candidate}) == reference.{hook}({reference}), '
                       f'"Generated {hook} dispatch preserves its predecessor observation")\n')
    profile_class = profile.capitalize() + 'RaceSim'
    test_path = Path(f'tests/extensions/{identity}_tests.gd')
    report_name = f'extension-{identity}.json'
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
    records = json.loads((root / REGISTRY).read_text(encoding='utf-8'))
    suite_id = f'extension_{identity}'
    if any(item['id'] == suite_id for item in records):
        raise ValueError('The generated verification suite already exists')
    records.append({'id': suite_id, 'script': test_path.as_posix(), 'native': False,
                    'layout': 'minimal', 'timeout': 360, 'reports': [report_name]})
    return {MECHANICS / f'{identity}_mechanic.gd': source, test_path: test,
            REGISTRY: json.dumps(records, indent=2) + '\n'}


def publish(root: Path, files: dict[Path, str]) -> None:
    """Validate all targets first; rollback completed writes if a later write fails."""
    previous: dict[Path, bytes | None] = {}
    for relative in files:
        path = root / relative
        if not path.resolve().is_relative_to(root.resolve()) or path.is_symlink():
            raise ValueError('Refusing a path outside the project or through a symlink')
        if path.exists() and relative != REGISTRY:
            raise ValueError(f'Refusing to overwrite {relative}')
        previous[path] = path.read_bytes() if path.exists() else None
    written: list[Path] = []
    try:
        for relative, content in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(content.encode('utf-8'))
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
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('list', help='Print declared providers and production profiles as JSON')
    sub.add_parser('hooks', help='Print authoritative extension signatures as JSON')
    validate = sub.add_parser('validate', help='Run registered construction and extension tests in isolated Godot')
    validate.add_argument('--mechanic', action='append', dest='identities', help='Limit inactive extension tests; production construction tests always run')
    validate.add_argument('--godot', help='Pinned Godot executable; otherwise use GODOT_BINARY or PATH')
    validate.add_argument('--dry-run', action='store_true', help='Show selection without claiming validation or executing Godot')
    create = sub.add_parser('scaffold', help='Create an inactive no-op provider and registered test')
    create.add_argument('identity')
    create.add_argument('--hook', action='append', dest='hooks')
    create.add_argument('--profile', default='practice')
    create.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        if args.command == 'list':
            result = catalog(ROOT)
        elif args.command == 'hooks':
            result = {name: f'({params}) -> {returns}' for name, (params, returns) in hook_contracts(ROOT).items()}
        elif args.command == 'validate':
            selected = validation_suites(ROOT, args.identities)
            if not args.dry_run:
                return run_validation(selected, args.godot)
            result = {'status': 'planned', 'suites': selected, 'engine_executed': False,
                      'scope': 'Registered construction and behavior tests; not proof of arbitrary new rules'}
        else:
            files = scaffold(ROOT, args.identity, args.hooks or ['forecast_parameters'], args.profile)
            if not args.dry_run:
                publish(ROOT, files)
            result = {'created': not args.dry_run, 'files': [p.as_posix() for p in files],
                      'enabled_in_game': False, 'verify': f'python3 scripts/verify.py --suite extension_{args.identity}',
                      'next': 'Implement rule-specific tests, then explicitly add the provider to the intended new-session profile. Version and migrate any saved state.'}
        print(json.dumps(result, indent=2))
        return 0
    except (ValueError, OSError, KeyError) as error:
        print(f'mechanics: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
