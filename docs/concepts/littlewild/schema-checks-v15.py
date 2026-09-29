"""Independent JSON Schema validation plus local authoring command checks."""
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
def invalid(validator, value):
    assert list(validator.iter_errors(value)), 'Expected invalid input'
schema = json.loads((CONTENT / 'scenario.schema.json').read_text())
validator = Draft202012Validator(schema)
check('Scenario schema validates its own structure', lambda: validator.check_schema(schema))
for name in ('littlewild', 'emberworks'):
    document = json.loads((CONTENT / (name + '.pack.json')).read_text())
    check(name + ' validates with independent JSON Schema', lambda: validator.validate(document))
    for field, value in [('schemaVersion', 99), ('script', 'execute'), ('worlds', []), ('scenes', []), ('tutorial', [])]:
        bad = copy.deepcopy(document); bad[field] = value
        check(name + ' rejects ' + field, lambda b=bad: invalid(validator,b))
    bad=copy.deepcopy(document);bad['worlds'][0]['placementPolicy']='invisible'
    check(name+' rejects unsupported site policy', lambda: invalid(validator,bad))
    source=CONTENT/(name+'.pack.json');before=source.read_bytes()
    result=subprocess.run(['node','source/tools/scenario-cli.cjs','validate',str(source)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    check(name+' CLI validates',lambda: equal(result.returncode,0))
    check(name+' CLI leaves input unchanged',lambda: equal(source.read_bytes(),before))
with tempfile.TemporaryDirectory() as temp:
    output=Path(temp)/'export.pack.json'
    result=subprocess.run(['node','source/tools/scenario-cli.cjs','export','littlewild',str(output)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    check('Export CLI creates a complete pack',lambda: (equal(result.returncode,0),validator.validate(json.loads(output.read_text()))))
    captured=Path(temp)/'captured.pack.json'
    result=subprocess.run(['node','source/tools/scenario-cli.cjs','capture','source/fixtures/actual-v13-story.json',str(captured)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    check('Capture CLI creates a valid template from an authentic legacy save',lambda: (equal(result.returncode,0),validator.validate(json.loads(captured.read_text()))))
report=dict(passed=sum(r['passed'] for r in results),total=len(results),results=results)
(ROOT/'source/v15-schema-results.json').write_text(json.dumps(report,indent=2))
print(str(report['passed'])+'/'+str(report['total']))
sys.exit(0 if report['passed']==report['total'] else 1)
