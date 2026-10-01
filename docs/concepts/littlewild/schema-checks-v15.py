"""Independent JSON Schema validation plus local M6 authoring and migration checks."""
from pathlib import Path
import copy, json, subprocess, tempfile, sys
from jsonschema import Draft202012Validator
ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / 'source/content'
results = []

def check(name, action):
    try:
        action(); results.append(dict(name=name, passed=True))
    except Exception as error:
        results.append(dict(name=name, passed=False, error=str(error)))

def equal(actual, expected):
    assert actual == expected, (actual, expected)

def true(value, message='Expected truthy value'):
    assert value, message

def invalid(validator, value):
    errors=list(validator.iter_errors(value))
    assert errors, 'Expected invalid input'

def run_json(args, timeout=45):
    result=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,timeout=timeout)
    payload=json.loads(result.stdout) if result.stdout.strip() else {}
    return result,payload

scenario_schema = json.loads((CONTENT / 'scenario.schema.json').read_text())
simulation_schema = json.loads((CONTENT / 'simulation.schema.json').read_text())
scenario_validator = Draft202012Validator(scenario_schema)
simulation_validator = Draft202012Validator(simulation_schema)
default_profile = json.loads((CONTENT / 'simulation-profile.json').read_text())

check('Scenario schema validates its own structure', lambda: Draft202012Validator.check_schema(scenario_schema))
check('Simulation profile schema validates its own structure', lambda: Draft202012Validator.check_schema(simulation_schema))
check('Default simulation profile validates independently', lambda: simulation_validator.validate(default_profile))
check('Compatibility profile embeds exact standalone actor and economy rules', lambda: (equal(default_profile['rules']['actor'],json.loads((CONTENT/'actor-rules.json').read_text())),equal(default_profile['rules']['economy'],json.loads((CONTENT/'economy-rules.json').read_text()))))
check('Scenario schema embeds the exact simulation profile definitions', lambda: equal(
    {k:scenario_schema['$defs'][k] for k in simulation_schema['$defs']}, simulation_schema['$defs']))

unsupported=copy.deepcopy(default_profile);unsupported['archetype']['actorDynamics'].append('run-imported-code')
check('Independent profile schema rejects unknown compiled systems', lambda: invalid(simulation_validator,unsupported))
reordered=copy.deepcopy(default_profile);reordered['archetype']['engineLayers'].reverse()
check('Independent profile schema rejects reordered engine layers', lambda: invalid(simulation_validator,reordered))
unknown=copy.deepcopy(default_profile);unknown['execute']='alert(1)'
check('Independent profile schema rejects unknown behavior-shaped fields', lambda: invalid(simulation_validator,unknown))

for name in ('littlewild', 'emberworks'):
    document = json.loads((CONTENT / (name + '.pack.json')).read_text())
    check(name + ' publishes scenario schema 2', lambda d=document: equal(d['schemaVersion'],2))
    check(name + ' embeds a valid simulation profile', lambda d=document: simulation_validator.validate(d['simulation']))
    check(name + ' validates with independent JSON Schema', lambda d=document: scenario_validator.validate(d))
    for field, value in [('schemaVersion', 99), ('script', 'execute'), ('worlds', []), ('scenes', []), ('tutorial', [])]:
        bad = copy.deepcopy(document); bad[field] = value
        check(name + ' rejects ' + field, lambda b=bad: invalid(scenario_validator,b))
    bad=copy.deepcopy(document);bad['worlds'][0]['placementPolicy']='invisible'
    check(name+' rejects unsupported site policy', lambda b=bad: invalid(scenario_validator,b))
    bad=copy.deepcopy(document);del bad['simulation']
    check(name+' schema 2 rejects a missing simulation profile', lambda b=bad: invalid(scenario_validator,b))
    bad=copy.deepcopy(document);bad['simulation']['archetype']['worldTransactions'].reverse()
    check(name+' rejects unsupported transaction ordering', lambda b=bad: invalid(scenario_validator,b))
    source=CONTENT/(name+'.pack.json');before=source.read_bytes()
    result,payload=run_json(['node','source/tools/scenario-cli.cjs','validate',str(source)])
    check(name+' CLI validates',lambda r=result,p=payload: (equal(r.returncode,0),true(p.get('ok')),equal(p.get('sourceSchemaVersion'),2)))
    check(name+' CLI reports its simulation profile',lambda p=payload,d=document: (equal(p.get('simulationProfile'),d['simulation']['id']),equal(p.get('compositionArchetype'),d['simulation']['archetype']['id'])))
    check(name+' CLI leaves input unchanged',lambda s=source,b=before: equal(s.read_bytes(),b))

legacy=json.loads((CONTENT/'littlewild.pack.json').read_text());legacy['schemaVersion']=1;legacy.pop('simulation')
check('Independent schema accepts a legacy schema 1 pack without simulation',lambda:scenario_validator.validate(legacy))
legacy_with_profile=copy.deepcopy(legacy);legacy_with_profile['simulation']=copy.deepcopy(default_profile)
check('Independent schema rejects ambiguous schema 1 packs with simulation',lambda:invalid(scenario_validator,legacy_with_profile))
with tempfile.TemporaryDirectory() as temp:
    temp=Path(temp)
    legacy_path=temp/'legacy.pack.json';legacy_path.write_text(json.dumps(legacy))
    result,payload=run_json(['node','source/tools/scenario-cli.cjs','validate',str(legacy_path)])
    check('Scenario CLI explicitly migrates schema 1 to schema 2',lambda:(equal(result.returncode,0),true(payload.get('ok')),equal(payload.get('sourceSchemaVersion'),1),equal(payload.get('simulationProfile'),'classic-v1'),true(payload.get('migrationNotes'))))

    output=temp/'export.pack.json'
    result=subprocess.run(['node','source/tools/scenario-cli.cjs','export','littlewild',str(output)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    exported=json.loads(output.read_text()) if output.exists() else {}
    check('Export CLI creates a complete schema 2 pack',lambda: (equal(result.returncode,0),equal(exported.get('schemaVersion'),2),scenario_validator.validate(exported),simulation_validator.validate(exported['simulation'])))

    captured=temp/'captured.pack.json'
    result=subprocess.run(['node','source/tools/scenario-cli.cjs','capture','source/fixtures/actual-v13-story.json',str(captured)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    capture=json.loads(captured.read_text()) if captured.exists() else {}
    check('Capture CLI creates a schema 2 template from an authentic legacy save',lambda: (equal(result.returncode,0),equal(capture.get('schemaVersion'),2),scenario_validator.validate(capture),simulation_validator.validate(capture['simulation'])))

    profile_export=temp/'profile.json'
    result,payload=run_json(['node','source/tools/simulation-profile-cli.cjs','export',str(profile_export)])
    emitted=json.loads(profile_export.read_text()) if profile_export.exists() else {}
    check('Simulation profile CLI exports the validated compatibility profile',lambda:(equal(result.returncode,0),true(payload.get('ok')),simulation_validator.validate(emitted),equal(emitted['id'],'classic-v1')))

for command in ('validate','fingerprint'):
    source=CONTENT/'simulation-profile.json';before=source.read_bytes()
    result,payload=run_json(['node','source/tools/simulation-profile-cli.cjs',command,str(source)])
    check('Simulation profile CLI '+command+' succeeds',lambda r=result,p=payload:(equal(r.returncode,0),true(p.get('ok')),equal(p.get('profile'),'classic-v1'),equal(p.get('archetype'),'living-world-v1'),true(p.get('fingerprint'))))
    check('Simulation profile CLI '+command+' leaves input unchanged',lambda s=source,b=before:equal(s.read_bytes(),b))
result,payload=run_json(['node','source/tools/simulation-profile-cli.cjs','schema'])
check('Simulation profile CLI exposes the canonical schema',lambda:(equal(result.returncode,0),equal(payload['$id'],simulation_schema['$id']),equal(payload['$defs'],simulation_schema['$defs'])))

report=dict(passed=sum(r['passed'] for r in results),total=len(results),results=results)
(ROOT/'source/v15-schema-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(str(report['passed'])+'/'+str(report['total']))
sys.exit(0 if report['passed']==report['total'] else 1)
