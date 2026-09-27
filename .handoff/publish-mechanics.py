"""One-off characterized migration from behavior inheritance to explicit mechanic composition."""
import re
from pathlib import Path
ROOT=Path.cwd()
DOMAIN=ROOT/'scripts/domain'
ids=['strategy','weather','recovery','practice']
paths=[DOMAIN/'weekend'/f'{i}_race_sim.gd' for i in ids]
base=DOMAIN/'race_sim.gd'
original={p:p.read_text() for p in [base]+paths}
# Preserve comments, string contents, layout and arithmetic order during extraction.
lex=re.compile(r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|#[^\n]*|[A-Za-z_]\w*|\s+|.',re.M)
def chunks(text):
 matches=list(re.finditer(r'^(?:static )?func (\w+)\(([^\n]*)\)([^\n]*):\n',text,re.M))
 return [(m.group(1),m.group(2),m.group(3),m.group(0),text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)],m.group(0).startswith('static')) for i,m in enumerate(matches)]
all_vars=set(re.findall(r'^var (\w+)', '\n'.join(original.values()),re.M))
all_methods=set(n for s in original.values() for n,_,_,_,_,static in chunks(s) if not static)
base_consts=set(re.findall(r'^const (\w+)',original[base],re.M))
base_static=set(n for n,_,_,_,_,st in chunks(original[base]) if st)
extra_vars=[]; signals=[]
for p in paths:
 extra_vars += re.findall(r'^var [^\n]+', original[p], re.M)
 signals += re.findall(r'^signal [^\n]+', original[p], re.M)
registry={};facades={}

def replace_super(body, owner):
 # Rewrite a super invocation to an explicit call to the preceding installed provider.
 tokens=lex.findall(body); out=[];i=0
 while i<len(tokens):
  if tokens[i]!='super':out.append(tokens[i]);i+=1;continue
  if tokens[i+1]=='(':
   depth=1;j=i+2
   while depth:
    if tokens[j]=='(':depth+=1
    elif tokens[j]==')':depth-=1
    j+=1
   i=j;continue
  assert tokens[i+1]=='.'
  name=tokens[i+2];assert tokens[i+3]=='(';depth=1;j=i+4;args=[]
  while depth:
   t=tokens[j]
   if t=='(':depth+=1
   elif t==')':depth-=1
   if depth:args.append(t)
   j+=1
  out.append('sim.mechanics.before("'+owner+'", "'+name+'", ['+''.join(args)+'])');i=j
 return ''.join(out)

def qualify(body,params,owner,ownstatic,ownconst):
 body=replace_super(body,owner)
 locals_=set(re.findall(r'(?:^|,)\s*(\w+)\s*(?::|=|,|$)',params))
 locals_.update(re.findall(r'\bvar\s+(\w+)',body))
 locals_.update(re.findall(r'\bfor\s+(\w+)\s+in\b',body))
 for args in re.findall(r'func\(([^)]*)\)',body):locals_.update(a.split(':')[0].strip() for a in args.split(','))
 shadow=locals_ & (all_vars | all_methods | base_consts)
 if shadow:print(owner,'SHADOW',shadow)
 tokens=lex.findall(body);out=[];prev=''
 for t in tokens:
  replacement=t
  if re.fullmatch(r'[A-Za-z_]\w*',t) and prev!='.' and t not in locals_:
   if t=='self':replacement='sim'
   elif t in ownstatic:replacement=owner.capitalize()+'RaceSim.'+t
   elif t in ownconst:replacement=t
   elif t in all_vars|all_methods or t in ['input_accepted','fixed_step_completed']:replacement='sim.'+t
   elif t in base_consts|base_static:replacement='RaceSim.'+t
  out.append(replacement)
  if not t.isspace():prev=t
 return ''.join(out)

for index,(owner,path) in enumerate(zip(ids,paths)):
 s=original[path];parts=chunks(s)
 ownstatic={n for n,_,_,_,_,st in parts if st}
 constants=re.findall(r'^const [^\n]+',s,re.M)
 ownconst={c.split()[1] for c in constants}
 hooks=[n for n,_,_,_,_,st in parts if not st and n!='_init']
 definition={'id':owner,'version':1,'requires':ids[:index],'hooks':hooks}
 import json
 module=f'class_name {owner.capitalize()}Mechanic\nextends RefCounted\n## Authoritative {owner} rules; caller supplies state, never a view or singleton.\n'+'\n'.join(constants)+'\n\n'
 module+='func definition() -> Dictionary:\n\treturn '+json.dumps(definition)+'\n\n'
 for name,params,ret,decl,body,static in parts:
  if static:continue
  if name=='_init':name='install'
  transformed=qualify(body,params,owner,ownstatic,ownconst)
  transformed=transformed.replace('\n\t\n','\n')
  module+=f'func {name}(sim: RaceSim'+(', '+params if params else '')+')'+ret+':\n'+transformed
  if name!='install':facades.setdefault(name,(params,ret))
 folder=DOMAIN/'mechanics';folder.mkdir(exist_ok=True)
 (folder/(owner+'_mechanic.gd')).write_text(module)
 # Former classes become direct aggregate profiles plus their existing validated loaders.
 profile=f'class_name {owner.capitalize()}RaceSim\nextends RaceSim\n## Compatibility construction/restore profile. Runtime rules live in composed mechanics.\n'+'\n'.join(constants)+'\n\n'
 profile+='func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:\n\tsuper(geometry, options)\n\tmechanics.configure(['+', '.join(i.capitalize()+'Mechanic.new()' for i in ids[:index+1])+'])\n\tmechanics.install(geometry, options)\n\n'
 for name,params,ret,decl,body,static in parts:
  if static:profile+=decl+body
 path.write_text(profile)

s=original[base]
start=s.index('func _init(')
s=s[:start]+ '\n'.join(signals+extra_vars)+'\nvar mechanics: RaceMechanics\n\n'+s[start:]
s=s.replace('func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:\n', 'func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:\n\tmechanics = RaceMechanics.new(self)\n')
base_methods={n for n,_,_,_,_,st in chunks(s) if not st}
wrappers=[]
for name,(params,ret) in facades.items():
 if name in base_methods:
  # Keep base parameters to avoid renaming arguments expected by old callers.
  for n,ps,rt,_,_,st in chunks(s):
   if n==name and not st:params,ret=ps,rt;break
  s=re.sub(r'^func '+name+r'\(', 'func _base_'+name+'(',s,flags=re.M)
 args=[v.split(':')[0].split('=')[0].strip() for v in params.split(',')] if params else []
 args=[v for v in args if v]
 wrapper=f'func {name}({params}){ret}:\n\t'+('return ' if 'void' not in ret else '')+'mechanics.invoke("'+name+'", ['+', '.join(args)+'])\n\n'
 wrappers.append(wrapper)
s+='\n## Stable aggregate entry points; providers are resolved once at construction.\n'+''.join(wrappers)
s+='func has_mechanic(identity: String) -> bool:\n\treturn mechanics != null and mechanics.has_mechanic(identity)\n\nfunc mechanic_catalog() -> Array:\n\treturn mechanics.describe()\n'
base.write_text(s)
# Use capabilities, not ancestry, for optional systems. Keep constructor names/save schemas.
for path in (ROOT/'scripts').rglob('*.gd'):
 text=path.read_text()
 for owner in ids:
  cls=owner.capitalize()+'RaceSim'
  text=re.sub(r':\s*'+cls+r'\b', ': RaceSim',text)
  text=re.sub(r'\bas '+cls+r'\b', 'as RaceSim',text)
  text=re.sub(r'\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*) is '+cls+r'\b',r'(\1 is RaceSim and \1.has_mechanic("'+owner+'"))',text)
 path.write_text(text)

# Normalize generated whitespace without touching the copied arithmetic.
for path in (DOMAIN/'mechanics').glob('*.gd'):
 path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()).rstrip()+'\n')
for path in paths:
 path.write_text(path.read_text().rstrip()+'\n')
import base64, zlib
addons=json.loads(zlib.decompress(base64.b64decode((ROOT/'.handoff/mechanics-addons.b64').read_bytes(),validate=True)))
for name,content in addons.items():
 target=ROOT/name
 assert target.resolve().is_relative_to(ROOT.resolve())
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(content)
