"""Rebuild and test v15; never reuse a previous suite's result as current evidence.
Use --no-browser for a clearly labeled partial run. Requires Python, Node.js,
jsonschema and (for full runs) Playwright plus a local Chromium installation.
"""
from pathlib import Path
import argparse, hashlib, json, subprocess, sys, time
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--no-browser',action='store_true')
args=parser.parse_args()
OUT=ROOT/'verification/v15';OUT.mkdir(parents=True,exist_ok=True)
source=lambda name:'source/'+name
suites=[
 ('ecs-core',['node',source('test-ecs.cjs')],source('ecs-results.json'),120),
 ('simulation-profile',['node',source('test-simulation-profile.cjs')],source('simulation-profile-results.json'),120),
 ('simulation-profile-integration',['node',source('test-simulation-profile-integration.cjs')],source('simulation-profile-integration-results.json'),180),
 ('engine-composition',['node',source('test-engine-composition.cjs')],source('engine-composition-results.json'),180),
 ('ecs-activity',['node',source('test-ecs-activity.cjs')],source('ecs-activity-results.json'),120),
 ('ecs-world',['node',source('test-ecs-world.cjs')],source('ecs-world-results.json'),120),
 ('ecs-economy',['node',source('test-economy-ecs.cjs')],source('economy-ecs-results.json'),120),
 ('ecs-integration',['node',source('test-ecs-integration.cjs')],source('ecs-integration-results.json'),180),
 ('ecs-world-integration',['node',source('test-ecs-world-integration.cjs')],source('ecs-world-integration-results.json'),180),
 ('ecs-economy-integration',['node',source('test-economy-integration.cjs')],source('economy-integration-results.json'),180),
 ('scenario-domain',['node',source('test-v15.cjs')],source('v15-domain-results.json'),120),
 ('presentation',['node',source('test-v15-presentation.cjs')],source('v15-presentation-results.json'),120),
 ('pause-policy',['node',source('test-v15-pause.cjs')],source('v15-pause-results.json'),120),
 ('cartography',['node',source('test-v11.cjs')],source('v11-domain-results.json'),180),
 ('domain',['node',source('test-v10.cjs')],source('v10-domain-results.json'),180),
 ('growth-stress',['node',source('test-growth-stress.cjs')],source('v10-stress-results.json'),300),
 ('earned-progression',['node',source('test-fresh-v10.cjs')],source('v10-fresh-results.json'),300),
 ('legacy-v5',['node',source('test-v10-regression-v5.cjs')],source('v10-regression-v5-test-results.json'),180),
 ('legacy-v6',['node',source('test-v10-regression-v6.cjs')],source('v10-regression-v6-test-results.json'),240),
 ('legacy-v8',['node',source('test-v10-regression-v8.cjs')],source('v10-regression-v8-test-results.json'),300),
 ('quality-v9',['node',source('test-v10-regression-quality-v9.cjs')],source('v10-regression-v9-quality-results.json'),180),
 ('foundation-v9',['node',source('test-v10-regression-foundation-v9.cjs')],source('v10-regression-v9-foundation-results.json'),240),
 ('legacy-schemas',[sys.executable,'schema-checks-v10.py'],source('v10-schema-results.json'),90),
 ('scenario-schema-cli',[sys.executable,'schema-checks-v15.py'],source('v15-schema-results.json'),90),
 ('release',['node',source('test-v15-release.cjs')],source('v15-release-results.json'),180),
]
if not args.no_browser:
 suites += [
  ('browser',[sys.executable,'browser-v15.py'],'verification/v15/browser-results.json',300),
  ('browser-contracts',[sys.executable,'browser-contracts-v15.py'],'verification/v15/browser-contract-results.json',240),
 ]
report=dict(status='running',passed=0,total=0,suites=[],browserIncluded=not args.no_browser)
def write():
 (OUT/'gate-results.json').write_text(json.dumps(report,indent=2)+'\n')
write()
try:
 subprocess.run([sys.executable,'source/build.py'],cwd=ROOT,check=True,timeout=60)
 artifact=ROOT/'littlewild.html'
 report['htmlSha256']=hashlib.sha256(artifact.read_bytes()).hexdigest()
 report['htmlBytes']=artifact.stat().st_size
 for name,command,result_path,timeout in suites:
  result_file=ROOT/result_path;result_file.unlink(missing_ok=True)
  print('RUN',name,flush=True);start=time.monotonic()
  run=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=timeout)
  (OUT/(name+'.log')).write_text(run.stdout+'\n'+run.stderr)
  entry=dict(name=name,command=command,exitCode=run.returncode,seconds=round(time.monotonic()-start,2),result=result_path)
  report['suites'].append(entry)
  if run.returncode:raise RuntimeError(name+' failed; see '+name+'.log')
  data=json.loads(result_file.read_text());passed=data['passed'];total=data.get('total',len(data.get('results',[])))
  if not isinstance(passed,int) or not isinstance(total,int) or total<=0 or passed!=total:
   raise RuntimeError(name+' returned incomplete counts')
  if data.get('failed',0):raise RuntimeError(name+' reports failures')
  if any(case.get('passed') is False for case in data.get('results',[])):
   raise RuntimeError(name+' contains a failed case despite its totals')
  entry.update(passed=passed,total=total);report['passed']+=passed;report['total']+=total
  write();print('PASS',name,passed,'/',total,flush=True)
 if hashlib.sha256(artifact.read_bytes()).hexdigest()!=report['htmlSha256']:
  raise RuntimeError('The artifact changed during verification')
 report['status']='partial-passed' if args.no_browser else 'passed'
except Exception as error:
 report['status']='failed';report['error']=str(error);print('FAILED',error,flush=True)
finally:
 write()
print(report['status'],str(report['passed'])+'/'+str(report['total']))
sys.exit(1 if report['status']=='failed' else 0)
