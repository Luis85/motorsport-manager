"""Independent current/legacy JSON Schema validation plus local authoring checks."""
from pathlib import Path
import copy, json, subprocess, tempfile, sys
from jsonschema import Draft202012Validator
ROOT=Path(__file__).resolve().parent
CONTENT=ROOT/'source/content'
results=[]
def check(name,action):
    try: action();results.append(dict(name=name,passed=True))
    except Exception as error: results.append(dict(name=name,passed=False,error=str(error)))
def equal(actual,expected): assert actual==expected,(actual,expected)
def invalid(validator,value): assert list(validator.iter_errors(value)),'Expected invalid input'
def assert_notes(value): assert value.get('migrationNotes'),'Expected migration notes'
current=json.loads((CONTENT/'scenario.schema.json').read_text())
legacy=json.loads((CONTENT/'scenario-v1.schema.json').read_text())
current_validator=Draft202012Validator(current)
legacy_validator=Draft202012Validator(legacy)
check('Current scenario schema validates its own structure',lambda:current_validator.check_schema(current))
check('Legacy scenario schema validates its own structure',lambda:legacy_validator.check_schema(legacy))
for name in ('littlewild','emberworks'):
    document=json.loads((CONTENT/(name+'.pack.json')).read_text())
    check(name+' validates with current independent JSON Schema',lambda d=document:current_validator.validate(d))
    check(name+' is not silently valid under legacy schema',lambda d=document:invalid(legacy_validator,d))
    for field,value in [('schemaVersion',99),('script','execute'),('worlds',[]),('scenes',[]),('tutorial',[])]:
        bad=copy.deepcopy(document);bad[field]=value
        check(name+' rejects '+field,lambda b=bad:invalid(current_validator,b))
    bad=copy.deepcopy(document);bad['worlds'][0]['placementPolicy']='invisible'
    check(name+' rejects unsupported site policy',lambda b=bad:invalid(current_validator,b))
    bad=copy.deepcopy(document);bad['scenes'][0]['ruleProfileId']='missing'
    check(name+' schema retains profile reference shape',lambda b=bad:current_validator.validate(b))
    bad=copy.deepcopy(document);bad['simulation']['ruleProfiles'][0]['system']='eval'
    check(name+' rejects executable profile fields',lambda b=bad:invalid(current_validator,b))
    bad=copy.deepcopy(document);bad['simulation']['compositionArchetypes'][0]['transientComponents']=['Activity','Task','Renderer']
    check(name+' rejects unknown component types',lambda b=bad:invalid(current_validator,b))
    source=CONTENT/(name+'.pack.json');before=source.read_bytes()
    result=subprocess.run(['node','source/tools/scenario-cli.cjs','validate',str(source)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    check(name+' CLI validates current schema',lambda r=result:equal(r.returncode,0))
    check(name+' CLI reports current source version',lambda r=result:equal(json.loads(r.stdout)['sourceSchemaVersion'],2))
    check(name+' CLI leaves input unchanged',lambda s=source,b=before:equal(s.read_bytes(),b))
with tempfile.TemporaryDirectory() as temp:
    temp=Path(temp)
    current_doc=json.loads((CONTENT/'littlewild.pack.json').read_text())
    legacy_doc=copy.deepcopy(current_doc);legacy_doc['schemaVersion']=1;legacy_doc.pop('simulation')
    for scene in legacy_doc['scenes']:
        scene.pop('ruleProfileId');scene.pop('actorArchetypeId')
    legacy_path=temp/'legacy.pack.json';legacy_path.write_text(json.dumps(legacy_doc,indent=2)+'\n')
    check('Derived schema-1 pack validates only through retained legacy schema',lambda:legacy_validator.validate(legacy_doc))
    check('Derived schema-1 pack is rejected by current schema',lambda:invalid(current_validator,legacy_doc))
    before=legacy_path.read_bytes();result=subprocess.run(['node','source/tools/scenario-cli.cjs','validate',str(legacy_path)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    check('CLI migrates schema-1 packs in memory',lambda:equal(result.returncode,0))
    check('CLI reports explicit schema-1 migration',lambda:equal(json.loads(result.stdout)['sourceSchemaVersion'],1))
    check('CLI reports migration notes',lambda:assert_notes(json.loads(result.stdout)))
    check('Schema-1 validation leaves source unchanged',lambda:equal(legacy_path.read_bytes(),before))
    output=temp/'export.pack.json';result=subprocess.run(['node','source/tools/scenario-cli.cjs','export','littlewild',str(output)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    check('Export CLI creates a complete current pack',lambda:(equal(result.returncode,0),current_validator.validate(json.loads(output.read_text()))))
    captured=temp/'captured.pack.json';result=subprocess.run(['node','source/tools/scenario-cli.cjs','capture','source/fixtures/actual-v13-story.json',str(captured)],cwd=ROOT,capture_output=True,text=True,timeout=45)
    check('Capture CLI creates a current template from an authentic legacy save',lambda:(equal(result.returncode,0),current_validator.validate(json.loads(captured.read_text()))))
report=dict(passed=sum(result['passed'] for result in results),total=len(results),results=results)
(ROOT/'source/v15-schema-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(str(report['passed'])+'/'+str(report['total']))
sys.exit(0 if report['passed']==report['total'] else 1)
