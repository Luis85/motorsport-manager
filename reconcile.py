"""Reconcile exactly the already reviewed main/content source trees; no source upload proxy."""
from pathlib import Path
import json
import re
import subprocess
import tempfile

BASE = 'def854b699a17632ff48d58bb49182b22e2477c9'
OURS = '712b6071412fae89671deb1ceca5d690c9f02c04'
MAIN = '52415ed3c2afa3b89b182e3e7cb25a477ab20f6a'
EXPECTED = '9683b423280d05f7298de97cb807f7c7069f4dcb'

def git(*args):
    return subprocess.check_output(['git', *args])

def entries(ref):
    result = {}
    for row in git('ls-tree', '-rz', '--full-tree', ref).split(b'\0'):
        if not row:
            continue
        metadata, path = row.split(b'\t', 1)
        mode, kind, sha = metadata.decode().split()
        if kind != 'blob':
            raise ValueError('Only ordinary source files are accepted')
        result[path.decode()] = (mode, sha)
    return result

base, ours, main = map(entries, [BASE, OURS, MAIN])
subprocess.run(['git', 'checkout', '--detach', OURS], check=True)
for name in sorted(set(base) | set(ours) | set(main)):
    b, o, t = base.get(name), ours.get(name), main.get(name)
    if t == b or t == o:
        continue
    path = Path(name)
    if o == b:
        if t is None:
            path.unlink()
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(git('cat-file', 'blob', t[1]))
        continue
    if name == 'export_presets.cfg' and b is None and o and t:
        # Both branches introduced this file; the explicit union below retains all presets.
        continue
    if None in [b, o, t]:
        raise ValueError('Unexpected add/delete conflict: ' + name)
    with tempfile.TemporaryDirectory() as directory:
        files = [Path(directory) / str(i) for i in range(3)]
        for item, entry in zip(files, [o, b, t]):
            item.write_bytes(git('cat-file', 'blob', entry[1]))
        merged = subprocess.run(['git', 'merge-file', '-p', *map(str, files)], capture_output=True)
        if merged.returncode > 127:
            raise ValueError('Cannot merge ' + name)
        path.write_bytes(merged.stdout)
    if merged.returncode and name not in ['scripts/domain/race_sim.gd', 'scripts/verification_suites.json', 'export_presets.cfg']:
        raise ValueError('Unexpected content conflict: ' + name)

p = Path('scripts/domain/race_sim.gd')
s = re.sub(r'<<<<<<<[^\n]*\n.*?=======\n(.*?)>>>>>>>[^\n]*\n', r'\1', p.read_text(), flags=re.S)
s = s.replace('return fail("You manage the two Obsidian drivers only.")', 'return fail("You manage the two %s drivers only." % player_team_label())')
s = s.replace('func player_ids() -> Array:', 'func player_team_label() -> String:\n\tfor car in cars:\n\t\tif car.player:\n\t\t\treturn str(car.entry_definition.values().team) if car.entry_definition != null else car.team\n\treturn "player-team"\n\nfunc player_ids() -> Array:')
p.write_text(s)
p = Path('scripts/domain/mechanics/strategy_mechanic.gd')
p.write_text(p.read_text().replace('sim.fail("Only a running player-team driver can receive this command.")', 'sim.fail("Only a running %s driver can receive this command." % sim.player_team_label())'))
p = Path('scripts/domain/commands/race_session_orders.gd')
p.write_text(p.read_text().replace('"I" if simulation.average(simulation.water) > 0.25 else "S"', 'simulation.tyre_rules.qualifying_start(simulation.average(simulation.water))'))
p = Path('scripts/domain/commands/race_driver_orders.gd')
s = p.read_text().replace('payload.get("value", 5)', 'payload.get("value", simulation.setup_definition.defaults().wing)').replace('CarSetup.SPECS', 'simulation.setup_definition.specs()').replace('payload.get("value"), 52, 62', 'payload.get("value"), simulation.setup_definition.specs().bias[0], simulation.setup_definition.specs().bias[1]').replace('Brake bias must be 52–62% front.', 'Brake bias is outside the selected setup profile.')
p.write_text(s)
p = Path('scripts/domain/commands/race_pit_orders.gd')
s = p.read_text().replace('TrackGeometry.PRESETS[simulation.track.preset].brake', 'simulation.track.vehicle_definition.braking_mps2').replace('payload.get("value", "M")', 'payload.get("value", simulation.tyre_rules.initial("dry"))').replace('not RaceSim.TYRES.has(value)', 'simulation.tyre_rules.spec(value).is_empty()')
p.write_text(s)
old = json.loads(git('show', OURS + ':scripts/verification_suites.json'))
added = json.loads(git('show', MAIN + ':scripts/verification_suites.json'))
seen = {item['id'] for item in old}
old.extend(item for item in added if item['id'] not in seen)
Path('scripts/verification_suites.json').write_text('[\n' + ',\n'.join('  ' + json.dumps(item, separators=(',', ':')) for item in old) + '\n]\n')
old = git('show', OURS + ':export_presets.cfg').decode().replace('[preset.0', '[preset.2').replace('runnable=true', 'runnable=false')
s = git('show', MAIN + ':export_presets.cfg').decode().replace('data/**/*.json,build-identity.json', 'data/**/*.json,content/packs/**/*.json,build-identity.json').replace('tests/*,docs/*,reports/*,builds/*,scripts/*.py,*.md', 'tests/*,docs/*,reports/*,builds/*,scripts/*.py,*.md,content/examples/*,content/schemas/*')
Path('export_presets.cfg').write_text(s + '\n' + old)
p = Path('scripts/build_standalone.py')
p.write_text(p.read_text().replace('("scripts", "scenes", "data")', '("scripts", "scenes", "data", "content")'))
subprocess.run(['git', 'add', '-A'], check=True)
actual = git('write-tree').decode().strip()
if actual != EXPECTED:
    subprocess.run(['git', 'diff', '--cached', '--stat'], check=True)
    raise ValueError('Reconstructed tree differs: ' + actual)
print('Verified exact reconciled tree:', actual)
