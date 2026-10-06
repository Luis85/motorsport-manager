/// <reference path="./external-editor-canvas-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const X=require('./scenario-runtime.js') as LWContentPorts.ScenarioApi,E=require('./external-editors.js') as LWExternalEditors.Api,D=require('./scene-editor.js') as LWSceneEditor.Api,A=require('./canvas-authoring.js') as LWCanvasAuthoring.Api;
type Data=Record<string,unknown>;
const data=(v:unknown):Data=>v as Data,rows=(v:unknown):Data[]=>v as Data[];
const copy=<T,>(v:T):T=>structuredClone(v);
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const base=():LWContentPorts.ScenarioPack=>copy(X.builtins().find(p=>p.id==='office')!);
function graph():LWContentPorts.ScenarioPack{
 const p=base(),first=p.scenes[0]!;first.graph={kind:'level',bounds:{x:0,y:0,width:19,height:19},rendering:{dimension:'3d',rendererId:'basic'},connections:[{id:'to-remote',targetSceneId:'remote-shift',label:'Visit remote',requirements:[{type:'player-level',minimum:1}],events:[{type:'message',text:'Welcome'}]}]};
 p.worlds.push({...copy(p.worlds[0]!),id:'remote-office',name:'Remote Office'});
 p.scenes.push({...copy(first),id:'remote-shift',name:'Remote Shift',worldId:'remote-office',graph:{kind:'level',bounds:{x:0,y:0,width:19,height:19},connections:[{id:'return-office',targetSceneId:first.id,label:'Return'}]}});
 p.scenes.push({id:'child-shift',name:'Child Shift',description:'A nested level.',worldId:first.worldId,initialState:copy(first.initialState),graph:{kind:'level',parentId:first.id,bounds:{x:0,y:0,width:19,height:19}}});
 for(const scene of p.scenes)delete scene.initialState.scenarioResources;
 const validation=X.validate(p);assert(validation.ok,validation.ok?'':validation.errors.join('\n'));return p;
}
function accepted(result:LWExternalEditors.Import):Extract<LWExternalEditors.Import,{ok:true}>{assert(result.ok,result.ok?'':result.errors.join('\n'));return result;}
const exported=(p=base(),format:LWExternalEditors.Format='canvas'):Data=>E.export(p,p.scenes[0]!.id,format).document;
const node=(doc:Data,id:string):Data=>rows(doc.nodes).find(n=>n.id===id)!;
function config(doc:Data,id:string,work:(p:Data)=>void):void{const value=node(doc,id),prefix=String(value.text).split('\n')[0]!,p=data(JSON.parse(String(value.text).slice(prefix.length+1)));work(p);value.text=prefix+'\n'+JSON.stringify(p,null,2);}
function translated(doc:Data,id:string,x:number,y:number):void{const value=node(doc,id),dx=x-Number(value.x),dy=y-Number(value.y);value.x=x;value.y=y;const configNode=node(doc,String(id).replace('scene:','scene-config:'));if(configNode){configNode.x=Number(configNode.x)+dx;configNode.y=Number(configNode.y)+dy;}}
for(const format of ['canvas','advanced-canvas'] as const){
 test(format+' standard full graph retains complete native worlds/states/catalogs in bounded ordinary text nodes',()=>{
  const p=graph(),doc=exported(p,format),back=accepted(E.import(JSON.stringify(doc)));assert.equal(back.format,format);assert.equal(back.sceneId,p.scenes[0]!.id);assert(rows(doc.nodes).some(n=>String(n.id).startsWith('exchange-part:')));assert(rows(doc.nodes).every(n=>typeof n.text!=='string'||n.text.length<=10000));
  const native=copy(back.pack);delete native.canvasAuthoring;
  // Empty optional arrays from the explicit connection editor carry no new rules.
  for(const s of native.scenes)for(const c of s.graph?.connections??[]){if(!c.requirements?.length)delete c.requirements;if(!c.events?.length)delete c.events;}
  assert.deepEqual(native,p);assert.deepEqual(back.pack.libraries,p.libraries);assert(back.pack.canvasAuthoring);A.validate(back.pack);
 });
 test(format+' group renames, reparenting and directed cross-world edges edit actual canonical topology',()=>{
  const p=graph(),doc=exported(p,format),first=p.scenes[0]!;node(doc,'world:remote-office').label='Renamed remote world';node(doc,'scene:child-shift').label='Moved level';
  const remote=node(doc,'scene:remote-shift');remote.height=800;remote.width=640;const world=node(doc,'world:remote-office');world.height=1300;world.width=800;
  translated(doc,'scene:child-shift',Number(remote.x)+40,Number(remote.y)+350);
  const edge=rows(doc.edges).find(e=>e.id==='connection:'+first.id+':to-remote')!;edge.label='Travel renamed';edge.toNode='scene:child-shift';
  const p2=accepted(E.import(doc)).pack;assert.equal(p2.worlds.find(w=>w.id==='remote-office')!.name,'Renamed remote world');const child=p2.scenes.find(s=>s.id==='child-shift')!;
  assert.equal(child.graph!.parentId,'remote-shift');assert.equal(child.worldId,'remote-office');assert.equal(child.name,'Moved level');assert.equal(p2.scenes[0]!.graph!.connections![0]!.targetSceneId,'child-shift');assert.equal(p2.scenes[0]!.graph!.connections![0]!.label,'Travel renamed');
  assert.deepEqual(child.graph!.bounds,p.scenes.find(s=>s.id==='child-shift')!.graph!.bounds);assert.deepEqual(child.initialState,p.scenes.find(s=>s.id==='child-shift')!.initialState);assert(X.validate(p2).ok);
 });
 test(format+' add world and scene from named native templates then add actual directed connections',()=>{
  const p=base(),doc=exported(p,format),first=p.scenes[0]!;
  rows(doc.nodes).push({id:'new-world',type:'group',label:'New World',x:2000,y:0,width:1000,height:1000},{id:'new-scene',type:'group',label:'New Scene',x:2040,y:300,width:540,height:400},{id:'new-world-config',type:'text',x:2040,y:50,width:460,height:220,text:'Littlewild world\n'+JSON.stringify({groupId:'new-world',id:'new-world',templateId:p.worlds[0]!.id,properties:{}})},{id:'new-scene-config',type:'text',x:2080,y:350,width:460,height:220,text:'Littlewild scene\n'+JSON.stringify({groupId:'new-scene',id:'new-scene',templateId:first.id,properties:{description:'New canonical native scene.',graph:{kind:'dungeon',rendering:{dimension:'2d',rendererId:'pixi-2d'}}}})});
  rows(doc.edges).push({id:'new-journey',fromNode:'scene:'+first.id,toNode:'new-scene',label:'Enter dungeon'});
  const p2=accepted(E.import(doc)).pack;assert.equal(p2.worlds.length,p.worlds.length+1);const added=p2.scenes.find(s=>s.id==='new-scene')!;assert.equal(added.worldId,'new-world');assert.equal(added.graph!.kind,'dungeon');assert.deepEqual(added.initialState,first.initialState);assert.equal(p2.scenes[0]!.graph!.connections![0]!.targetSceneId,'new-scene');assert(X.validate(p2).ok);
 });
 test(format+' scene config edits compiled rendering/embeds, rules, events and canonical settings without game pixel changes',()=>{
  const p=graph(),doc=exported(p,format),first=p.scenes[0]!;config(doc,'scene-config:remote-shift',p=>{data(p.properties).graph={kind:'level',bounds:{x:0,y:0,width:19,height:19},rendering:{dimension:'2d',rendererId:'excalibur-2d'}};});
  config(doc,'scene-config:'+first.id,p=>{data(data(p.properties).graph).rendering={dimension:'3d',rendererId:'basic',embeds:[{id:'remote-map',sceneId:'remote-shift',role:'minimap',bounds:{anchor:'top-left',width:240,height:180}}]};data(data(p.properties).graph).events=[{type:'pause',paused:true}];data(data(p.properties).settings).sound=true;});
  config(doc,'connection-config:'+first.id+':to-remote',p=>{p.requirements=[{type:'player-level',minimum:2}];p.events=[{type:'message',text:'Edited greeting'}];});
  const p2=accepted(E.import(doc)).pack;assert.equal(p2.scenes[0]!.graph!.rendering!.embeds![0]!.sceneId,'remote-shift');assert.equal(p2.scenes[0]!.graph!.connections![0]!.requirements![0]!.type,'player-level');const expected=copy(p.scenes[0]!.initialState);data(expected.settings).sound=true;assert.deepEqual(p2.scenes[0]!.initialState,expected);assert(X.validate(p2).ok);
 });
}
test('Generic Canvas explicit template/entity mappings create native scenes and world edges from real graph nodes',()=>{
 const p=base(),first=p.scenes[0]!,doc={nodes:[{id:'world',type:'group',label:'Mapped World',x:0,y:0,width:1300,height:600},{id:'a',type:'text',text:'First level',x:40,y:100,width:400,height:200},{id:'b',type:'text',text:'Second level',x:500,y:100,width:400,height:200}],edges:[{id:'walk-second',fromNode:'a',toNode:'b',toEnd:'arrow',label:'Walk to second'}]};
 assert.equal(E.import(doc).ok,false);const options:LWExternalEditors.Options={pack:p,sceneId:first.id,canvasMappings:[{nodeId:'world',kind:'world',entityId:p.worlds[0]!.id},{nodeId:'a',kind:'scene',entityId:first.id},{nodeId:'b',kind:'scene',templateId:first.id,id:'second-level'}]};
 const back=accepted(E.import(doc,options));assert.equal(back.pack.scenes.find(s=>s.id==='second-level')!.name,'Second level');assert.equal(back.pack.scenes[0]!.graph!.connections![0]!.targetSceneId,'second-level');assert(X.validate(back.pack).ok);assert.deepEqual(p,base());
 const output=exported(back.pack);assert(node(output,'scene:second-level'));assert.equal(accepted(E.import(output)).pack.scenes.length,2);
});
test('Advanced Canvas shapes, edge path/arrow styles, floating ends and frontmatter survive native export and reimport',()=>{
 const p=graph(),doc=exported(p,'advanced-canvas'),first=p.scenes[0]!;node(doc,'scene:'+first.id).styleAttributes={shape:'diamond',border:'dotted',textAlign:'center',customInk:'plum'};node(doc,'scene:'+first.id).zIndex=4;node(doc,'world:'+p.worlds[0]!.id).collapsed=true;
 const edge=rows(doc.edges)[0]!;edge.styleAttributes={path:'long-dashed',arrow:'diamond',pathfindingMethod:'square'};edge.fromFloating=true;edge.toFloating=true;doc.metadata={version:'1.0-1.0',frontmatter:{title:'Graph authoring',status:'draft'},startNode:'scene:'+first.id};
 const back=accepted(E.import(doc));assert(back.warnings.some(w=>w.includes('customInk')));const native=D.create(back.pack).export(),out=exported(native,'advanced-canvas');assert.deepEqual(node(out,'scene:'+first.id).styleAttributes,node(doc,'scene:'+first.id).styleAttributes);assert.deepEqual(rows(out.edges)[0]!.styleAttributes,edge.styleAttributes);assert.equal(rows(out.edges)[0]!.fromFloating,true);assert.deepEqual(out.metadata,doc.metadata);assert.deepEqual(accepted(E.import(out)).pack.canvasAuthoring,native.canvasAuthoring);
});
test('Canvas arrows respect source orientation and reject undirected/bidirectional graph edges',()=>{
 const p=graph(),doc=exported(p),edge=rows(doc.edges)[0]!;edge.id='reversed-path';edge.fromEnd='arrow';edge.toEnd='none';
 doc.nodes=rows(doc.nodes).filter(n=>!String(n.id).startsWith('connection-config:'));const out=accepted(E.import(doc));assert(out.pack.scenes.find(s=>s.id==='remote-shift')!.graph!.connections!.some(c=>c.id==='reversed-path'&&c.targetSceneId===p.scenes[0]!.id));
 for(const ends of [{fromEnd:'none',toEnd:'none'},{fromEnd:'arrow',toEnd:'arrow'}]){const invalid=exported(p);Object.assign(rows(invalid.edges)[0]!,ends);assert.equal(E.import(invalid).ok,false);}
});
test('Unsupported backgrounds/custom plugin fields produce visible conversion warnings; files/URLs/portals reject',()=>{
 const doc=exported();node(doc,'world:'+base().worlds[0]!.id).background='private/vault.png';node(doc,'world:'+base().worlds[0]!.id).pluginCallback='alert(1)';const back=accepted(E.import(doc));assert(back.warnings.some(w=>w.includes('background')));assert(back.warnings.some(w=>w.includes('pluginCallback')));
 for(const value of [{type:'file',file:'../secret'},{type:'link',url:'https://example.invalid/private'},{type:'file',file:'remote.canvas',portal:true}]){const bad=exported();rows(bad.nodes).push({id:'unsafe',x:0,y:0,width:50,height:50,...value});assert.equal(E.import(bad).ok,false);}
});
test('Malformed graph/config metadata and ambiguous references reject before input, draft or active engine mutation',()=>{
 const p=graph(),draft=D.create(p),engine=X.commitScene(X.prepareScene(p,p.scenes[0]!.id)),before=engine.export(),first=p.scenes[0]!;
 const changes:((doc:Data)=>void)[]=[
  d=>{rows(d.nodes).push(copy(rows(d.nodes)[0]!));},d=>{rows(d.edges)[0]!.toNode='missing';},d=>{rows(d.edges).push(copy(rows(d.edges)[0]!));},
  d=>{node(d,'scene:child-shift').x=Number(node(d,'scene:'+first.id).x);node(d,'scene:child-shift').y=Number(node(d,'scene:'+first.id).y);node(d,'scene:child-shift').width=node(d,'scene:'+first.id).width;node(d,'scene:child-shift').height=node(d,'scene:'+first.id).height;},
  d=>{config(d,'scene-config:'+first.id,p=>{data(data(p.properties).graph).rendererModule='https://example.invalid/code.js';});},
  d=>{config(d,'scene-config:'+first.id,p=>{data(data(p.properties).graph).rendering={dimension:'2d',rendererId:'javascript:eval'};});},
  d=>{config(d,'scene-config:child-shift',p=>{data(data(p.properties).graph).binding={type:'island',sourceSceneId:'missing',ix:0,iy:0};});},
  d=>{config(d,'scene-config:child-shift',p=>{p.id=first.id;});},d=>{node(d,'scene-config:'+first.id).text='Littlewild scene\n(()=> alert(1))()';},
  d=>{d.nodes=rows(d.nodes).filter(n=>n.id!=='exchange-part:0');},d=>{node(d,'scene:'+first.id).width=NaN;},
  d=>{config(d,'scene-config:'+first.id,p=>{data(data(p.properties).graph).rendering={dimension:'3d',rendererId:'basic',embeds:[{id:'loop',sceneId:first.id,role:'minimap'}]};});}
 ];
 for(const mutate of changes){const invalid=exported(p);mutate(invalid);const snapshot=copy(invalid);assert.equal(E.import(invalid).ok,false);assert.deepEqual(invalid,snapshot);assert.deepEqual(draft.snapshot(),p);assert.equal(draft.revision,0);assert.deepEqual(engine.export(),before);}
});
test('Canvas preserves an unavailable stable renderer identity as inert portable data',()=>{
 const p=graph(),first=p.scenes[0]!,doc=exported(p);
 config(doc,'scene-config:'+first.id,value=>{data(data(value.properties).graph).rendering={dimension:'2d',rendererId:'eval'};});
 const before=copy(doc),back=accepted(E.import(doc));
 assert.equal(back.pack.scenes[0]!.graph!.rendering!.rendererId,'eval');assert.deepEqual(back.pack.scenes[0]!.initialState,first.initialState);assert.deepEqual(doc,before);assert(X.validate(back.pack).ok);
});
test('Bounded portable Canvas authoring rejects unknown canonical refs, behavior fields and excessive metadata',()=>{
 const p=base();p.canvasAuthoring={version:1,nodes:{'scene:unknown':{x:0,y:0,width:50,height:50}},edges:{}};assert.throws(()=>A.validate(p));
 p.canvasAuthoring={version:1,nodes:{},edges:{},metadata:{version:'1.0-1.0',frontmatter:{script:{callback:'alert(1)'}}}};assert.throws(()=>A.validate(p));
 p.canvasAuthoring={version:1,nodes:{},edges:{'connection:unknown':{fromSide:'top'}}};assert.throws(()=>A.validate(p));
 p.canvasAuthoring={version:1,nodes:{['scene:'+p.scenes[0]!.id]:{x:0,y:0,width:50,height:50,callback:'execute'}},edges:{}};assert.throws(()=>A.validate(p));
});
test('Native draft deletion reconciles inert Canvas references and exports a valid remaining graph',()=>{
 const p=graph(),doc=exported(p,'advanced-canvas');doc.metadata={version:'1.0-1.0',frontmatter:{title:'Native edits'},startNode:'scene:child-shift'};
 const back=accepted(E.import(doc)),editor=D.create(back.pack),first=back.pack.scenes[0]!;
 editor.removeScene('child-shift');assert.equal(editor.export().canvasAuthoring!.nodes['scene:child-shift'],undefined);assert.equal(editor.export().canvasAuthoring!.metadata!.startNode,undefined);
 editor.updateScene(first.id,{graph:{...first.graph!,connections:[]}});editor.removeScene('remote-shift');editor.removeWorld('remote-office');
 const native=editor.export();assert.equal(native.canvasAuthoring!.edges['connection:'+first.id+':to-remote'],undefined);assert.equal(native.canvasAuthoring!.nodes['world:remote-office'],undefined);assert(X.validate(native).ok);assert.equal(accepted(E.import(exported(native,'advanced-canvas'))).pack.scenes.length,1);
 const invalid=copy(native);invalid.canvasAuthoring!.nodes['scene:unknown']={x:0,y:0,width:100,height:100};assert.equal(X.validate(invalid).ok,false);
});
test('Native topology additions and reparenting regenerate geometry while retaining Advanced Canvas node styles',()=>{
 const p=graph(),doc=exported(p,'advanced-canvas');node(doc,'scene:child-shift').styleAttributes={shape:'diamond'};
 const imported=accepted(E.import(doc)),editor=D.create(imported.pack),child=imported.pack.scenes.find(s=>s.id==='child-shift')!;
 editor.updateScene(child.id,{worldId:'remote-office',graph:{...child.graph!,parentId:'remote-shift'}});
 const native=editor.export(),out=exported(native,'advanced-canvas'),back=accepted(E.import(out));assert.equal(back.pack.scenes.find(s=>s.id===child.id)!.graph!.parentId,'remote-shift');assert.deepEqual(node(out,'scene:child-shift').styleAttributes,{shape:'diamond'});assert(back.warnings.some(w=>w.includes('layout-notice')));
});
test('Multiple connection rule config nodes have independent visible graph positions and reserved scene header space',()=>{
 const p=graph(),first=p.scenes[0]!;first.graph!.connections!.push({id:'second-gate',targetSceneId:'child-shift',label:'Second gate',requirements:[{type:'player-level',minimum:2}]});
 const doc=exported(p),a=node(doc,'connection-config:'+first.id+':to-remote'),b=node(doc,'connection-config:'+first.id+':second-gate'),group=node(doc,'scene:'+first.id),child=node(doc,'scene:child-shift');assert(Number(b.y)>=Number(a.y)+Number(a.height));assert(Number(child.y)>=Number(b.y)+Number(b.height));assert(Number(group.height)>Number(child.height));assert(E.import(doc).ok);
});
test('Flipping existing arrows and generic opaque edge IDs retain stable native connection direction after reexport',()=>{
 const p=graph(),doc=exported(p),edge=rows(doc.edges)[0]!;edge.fromEnd='arrow';edge.toEnd='none';edge.fromSide='bottom';edge.toSide='top';const back=accepted(E.import(doc));
 const source=back.pack.scenes.find(s=>s.id==='remote-shift')!;assert(source.graph!.connections!.some(c=>c.id==='to-remote'&&c.targetSceneId===p.scenes[0]!.id));const next=accepted(E.import(exported(back.pack)));assert.deepEqual(next.pack.scenes.find(s=>s.id==='remote-shift')!.graph!.connections,source.graph!.connections);
 const generic=exported(p);rows(generic.edges)[0]!.id='0f3819ac-ff99';generic.nodes=rows(generic.nodes).filter(n=>!String(n.id).startsWith('connection-config:'));const imported=accepted(E.import(generic));const id=imported.pack.scenes[0]!.graph!.connections![0]!.id;assert(id.startsWith('canvas-'));assert.equal(accepted(E.import(exported(imported.pack))).pack.scenes[0]!.graph!.connections![0]!.id,id);
});
test('Canvas storytelling config preserves and edits cinematic timelines, cross-world storyboards and scene events',()=>{
 const p=graph(),first=p.scenes[0]!,remote=p.scenes.find(s=>s.id==='remote-shift')!,actor=data(rows(data(first.initialState.colony).creatures)[0]!),x=Number(data(actor.creature).x);
 p.storytelling={version:1,cutscenes:[{id:'office-pan',name:'Office arrival',sceneId:first.id,duration:5,skipPolicy:'finish',tracks:[{id:'guide-move',target:{category:'creatures',id:String(actor.id)},property:'x',keyframes:[{time:0,value:x},{time:5,value:x+1}]}],onFinish:[{type:'scene-switch',connectionId:'to-remote'}]},{id:'remote-pan',name:'Remote arrival',sceneId:remote.id,duration:5,skipPolicy:'finish',tracks:[]}],storyboards:[{id:'office-journey',name:'Across two worlds',shots:[{id:'opening',name:'Office opens',sceneId:first.id,cutsceneId:'office-pan',narrative:'Meet the guide.'},{id:'arrival',name:'Remote arrival',sceneId:remote.id,cutsceneId:'remote-pan',narrative:'The story continues across worlds.'}]}]};
 first.graph!.events=[{type:'play-cutscene',cutsceneId:'office-pan',once:true}];assert(X.validate(p).ok);
 for(const format of ['canvas','advanced-canvas'] as const){const doc=exported(p,format),initial=accepted(E.import(doc));assert.deepEqual(initial.pack.storytelling,p.storytelling);assert.deepEqual(initial.pack.scenes[0]!.graph!.events,first.graph!.events);
  config(doc,'storytelling',value=>{rows(value.cutscenes)[0]!.name='Edited arrival';rows(rows(value.storyboards)[0]!.shots)[1]!.narrative='Edited cross-world story note.';});const back=accepted(E.import(doc));assert.equal(back.pack.storytelling!.cutscenes[0]!.name,'Edited arrival');assert.equal(back.pack.storytelling!.storyboards[0]!.shots[1]!.narrative,'Edited cross-world story note.');assert.deepEqual(back.pack.scenes[0]!.initialState,first.initialState);
  const bad=exported(p,format);config(bad,'storytelling',value=>{rows(value.cutscenes)[0]!.callback='https://example.invalid/script.js';});assert.equal(E.import(bad).ok,false);
 }
});
test('Real CLI exports both .canvas dialects and imports edited graph fixtures as canonical validated whole packs',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-canvas-cli-')),p=graph(),source=path.join(folder,'native.json');fs.writeFileSync(source,JSON.stringify(p));
 const cli=path.join(__dirname,'tools/scenario-cli.cjs');
 for(const format of ['canvas','advanced-canvas']){
  const canvasPath=path.join(folder,format+'.canvas'),out=path.join(folder,format+'.pack.json');
  const exported=spawnSync(process.execPath,[cli,'external-export',source,p.scenes[0]!.id,format,canvasPath],{encoding:'utf8'});assert.equal(exported.status,0,exported.stderr+exported.stdout);
  const doc=data(JSON.parse(fs.readFileSync(canvasPath,'utf8')));node(doc,'scene:child-shift').label='Edited through CLI graph';fs.writeFileSync(canvasPath,JSON.stringify(doc));
  const imported=spawnSync(process.execPath,[cli,'external-import',canvasPath,out],{encoding:'utf8'});assert.equal(imported.status,0,imported.stderr+imported.stdout);const pack=data(JSON.parse(fs.readFileSync(out,'utf8'))) as unknown as LWContentPorts.ScenarioPack;assert.equal(pack.scenes.find(s=>s.id==='child-shift')!.name,'Edited through CLI graph');assert(X.validate(pack).ok);
  rows(doc.edges)[0]!.toNode='dangling';fs.writeFileSync(canvasPath,JSON.stringify(doc));const saved=fs.readFileSync(out,'utf8'),bad=spawnSync(process.execPath,[cli,'external-import',canvasPath,out],{encoding:'utf8'});assert.notEqual(bad.status,0);assert.equal(fs.readFileSync(out,'utf8'),saved);
 }
 fs.rmSync(folder,{recursive:true,force:true});
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(path.join(__dirname,'external-canvas-results.json'),JSON.stringify({passed,total:results.length,results},null,2)+'\n');console.log(`External Canvas: ${passed}/${results.length} passed.`);if(passed!==results.length)process.exitCode=1;
