"""Independent Draft 2020-12 validation of shipped authoring documents."""
from pathlib import Path
import copy
import json
import sys
from jsonschema import Draft202012Validator
ROOT=Path(__file__).resolve().parent
CONTENT=ROOT/'source'/'content'
results=[]
def check(name,fn):
    try:
        fn()
        results.append(dict(name=name,passed=True))
    except Exception as exc:
        results.append(dict(name=name,passed=False,error=str(exc)))

def expect_invalid(validator,doc):
    assert list(validator.iter_errors(doc)), 'Invalid definition was accepted.'

for name,file,schema in [('Base','default-library.json','library.schema.json'),('Adventure','adventure-library.json','adventure.schema.json'),('World','world-library.json','world.schema.json'),('Growth','growth-library.json','growth.schema.json')]:
    doc=json.loads((CONTENT/file).read_text())
    spec=json.loads((CONTENT/schema).read_text())
    validator=Draft202012Validator(spec)
    check(name+' schema is well formed',lambda spec=spec:Draft202012Validator.check_schema(spec))
    check(name+' default library validates independently',lambda v=validator,d=doc:v.validate(d))
    bad=copy.deepcopy(doc)
    if name=='Adventure':
        bad['format']='not-an-adventure-library'
        label=' rejects an unsupported format'
    else:
        bad['unsupported_engine_field']=True
        label=' rejects unknown root properties'
    check(name+label,lambda v=validator,d=bad:expect_invalid(v,d))

v=Draft202012Validator(json.loads((CONTENT/'growth.schema.json').read_text()))
d=json.loads((CONTENT/'growth-library.json').read_text())
for key,value in [('maxSlots',0),('maxSlots',9),('maxIslands',0),('maxIslands',50),('landGrowth',1),('marketSeconds',0)]:
    bad=copy.deepcopy(d);bad['rules'][key]=value
    check(f'Growth rejects {key}={value}',lambda d=bad:expect_invalid(v,d))
check('Extra event/interaction example passes independent schema',lambda:v.validate(json.loads((ROOT/'examples'/'new-island-interaction.json').read_text())))
report=dict(passed=sum(r['passed'] for r in results),total=len(results),results=results)
(ROOT/'source'/'v10-schema-results.json').write_text(json.dumps(report,indent=2))
print(f"{report['passed']}/{report['total']} independent schema checks passed")
sys.exit(0 if report['passed']==report['total'] else 1)
