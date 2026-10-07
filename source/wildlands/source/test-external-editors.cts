/// <reference path="./external-editor-contracts.d.ts" />
/// <reference path="./building-interior-data-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
const X=require('./scenario-runtime.js') as LWContentPorts.ScenarioApi,E=require('./external-editors.js') as LWExternalEditors.Api,D=require('./scene-editor.js') as LWSceneEditor.Api;
const C=(globalThis as unknown as {LWContent:LWContentPorts.ContentApi}).LWContent;
type Data=Record<string,unknown>;
const record=(v:unknown):Data=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Data:{},rows=(v:unknown):Data[]=>v as Data[];
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,fn:()=>void):void{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,String(error));}}
const base=():LWContentPorts.ScenarioPack=>C.copy(X.builtins().find(p=>p.id==='office')!);
const state=(p:LWContentPorts.ScenarioPack):Data=>p.scenes[0]!.initialState;
const actor=(p:LWContentPorts.ScenarioPack):Data=>rows(record(state(p).colony).creatures)[0]!;
const accepted=(result:LWExternalEditors.Import):Extract<LWExternalEditors.Import,{ok:true}>=>{assert(result.ok,result.ok?'':result.errors.join('\n'));return result;};
const formats:LWExternalEditors.Format[]=['tiled','ldtk','gltf'];
function exported(format:LWExternalEditors.Format,pack=base()):Data{return E.export(pack,pack.scenes[0]!.id,format).document;}
function objectRows(doc:Data,format:LWExternalEditors.Format):Data[]{if(format==='tiled')return rows(rows(doc.layers).find(l=>l.name==='Canonical entities')!.objects);if(format==='ldtk')return rows(rows(rows(doc.levels)[0]!.layerInstances).find(l=>l.__type==='Entities')!.entityInstances);return rows(doc.nodes).filter(v=>record(v.extras).entityId!==undefined);}
function setField(obj:Data,format:LWExternalEditors.Format,name:string,value:unknown):void{
 if(format==='gltf'){record(obj.extras)[name]=value;return;}
 const list=rows(format==='tiled'?obj.properties:obj.fieldInstances),field=list.find(f=>(format==='tiled'?f.name:f.__identifier)===name);
 if(field)field[format==='tiled'?'value':'__value']=value;else list.push(format==='tiled'?{name,type:typeof value==='number'?'float':'string',value}:{__identifier:name,__type:typeof value==='number'?'Int':'String',__value:value,defUid:12,realEditorValues:[]});
}
function glb(doc:Data):Uint8Array{
 const data=C.copy(doc),buffer=rows(data.buffers)[0]!,binary=Buffer.from(String(buffer.uri).split(',')[1]!,'base64');delete buffer.uri;
 const text=Buffer.from(JSON.stringify(data),'utf8'),jsonSize=Math.ceil(text.length/4)*4,binSize=Math.ceil(binary.length/4)*4,output=new Uint8Array(28+jsonSize+binSize),view=new DataView(output.buffer);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,output.length,true);view.setUint32(12,jsonSize,true);view.setUint32(16,0x4e4f534a,true);output.fill(32,20,20+jsonSize);output.set(text,20);view.setUint32(20+jsonSize,binSize,true);view.setUint32(24+jsonSize,0x004e4942,true);output.set(binary,28+jsonSize);return output;
}
for(const format of formats){
 test(format+' supported format is an actual standard document and retains complete Office pack',()=>{
  const p=base(),draft=D.create(p),engine=X.commitScene(X.prepareScene(p,p.scenes[0]!.id)),before=engine.export(),result=E.export(draft.export(),p.scenes[0]!.id,format);
  assert.equal(E.detect(JSON.stringify(result.document)),format);const back=accepted(E.import(JSON.stringify(result.document)));assert.deepEqual(back.pack,p);assert.equal(back.sceneId,p.scenes[0]!.id);assert(back.warnings.length);assert.deepEqual(engine.export(),before);assert.deepEqual(draft.snapshot(),p);assert.equal(draft.revision,0);
  if(format==='tiled'){assert(rows(result.document.layers).some(l=>l.type==='tilelayer'));assert(rows(result.document.tilesets).length);}
  if(format==='ldtk'){assert(rows(record(result.document.defs).entities).length);assert(rows(result.document.levels).length);}
  if(format==='gltf'){assert(rows(result.document.meshes).length);assert(rows(result.document.buffers).length);}
 });
 test(format+' actual coordinate, creature inventory, finite node stock and terrain edits patch native authority',()=>{
  const doc=exported(format),objects=objectRows(doc,format),creature=objects.find(v=>format==='gltf'?record(v.extras).category==='creatures':rows(format==='tiled'?v.properties:v.fieldInstances).some(f=>(format==='tiled'?f.name:f.__identifier)===(format==='tiled'?'category':'Category')&&(format==='tiled'?f.value:f.__value)==='creatures'))!;
  if(format==='tiled'){creature.x=9*32;creature.y=10*32;setField(creature,format,'inventory',JSON.stringify({...record(actor(base()).inventory),berries:7}));}
  if(format==='ldtk'){creature.px=[9*32,10*32];setField(creature,format,'Inventory',JSON.stringify({...record(actor(base()).inventory),berries:7}));}
  if(format==='gltf'){creature.translation=[9,0,10];setField(creature,format,'inventory',{...record(actor(base()).inventory),berries:7});}
  const node=objects.find(v=>format==='gltf'?record(v.extras).category==='nodes':rows(format==='tiled'?v.properties:v.fieldInstances).some(f=>(format==='tiled'?f.name:f.__identifier)===(format==='tiled'?'category':'Category')&&(format==='tiled'?f.value:f.__value)==='nodes'))!;setField(node,format,format==='ldtk'?'Stock':'stock',8);
  if(format==='tiled'){const tile=rows(doc.layers).find(l=>l.type==='tilelayer')!;(tile.data as number[])[0]=(tile.data as number[])[0]===1?2:1;}
  if(format==='ldtk'){const layer=rows(rows(doc.levels)[0]!.layerInstances).find(l=>l.__type==='IntGrid')!;(layer.intGridCsv as number[])[0]=(layer.intGridCsv as number[])[0]===1?2:1;}
  if(format==='gltf'){const tile=rows(doc.nodes).find(v=>record(v.extras).terrain)!;const t=record(record(tile.extras).terrain);t.ground=t.ground==='grass'?'water':'grass';}
  const p=accepted(E.import(doc)).pack;assert.equal(record(actor(p).creature).x,9);assert.equal(record(actor(p).creature).y,10);assert.equal(record(actor(p).inventory).berries,7);assert.equal(rows(state(p).nodes)[0]!.stock,8);assert(record(record(state(p).terraform).tiles)['0,0']);assert(X.validate(p).ok);
 });
 test(format+' unsafe geometry and unknown identities reject without changing source or draft',()=>{
  const p=base(),draft=D.create(p),doc=exported(format),obj=objectRows(doc,format)[0]!;
  if(format==='tiled')obj.x=99999;if(format==='ldtk')obj.px=[99999,99999];if(format==='gltf')obj.translation=[99999,0,99999];
  const saved=C.copy(doc);assert.equal(E.import(doc).ok,false);assert.deepEqual(doc,saved);assert.deepEqual(draft.snapshot(),p);assert.equal(draft.revision,0);
  const added=exported(format);objectRows(added,format)[0]!.name='new-entity';setField(objectRows(added,format)[0]!,format,format==='tiled'?'entityId':format==='ldtk'?'EntityId':'entityId','absent');assert.equal(E.import(added).ok,false);
 });
}
for(const format of formats)test(format+' moved canonical buildings and props retain all worlds, child scenes and settings',()=>{
 const editor=D.create(base()),pack=editor.snapshot(),scene=pack.scenes[0]!;
 editor.addProp(scene.id,{id:'external-prop',name:'Wood proxy',category:'item',assetId:'wood',model:'world',x:2,y:1});
 editor.addWorld(pack.worlds[0]!,'remote-office','Remote office');editor.addScene(scene,'remote-shift','remote-office');
 const before=editor.export(),doc=exported(format,before),objects=objectRows(doc,format);
 const id=(v:Data):unknown=>format==='gltf'?record(v.extras).entityId:rows(format==='tiled'?v.properties:v.fieldInstances).find(f=>(format==='tiled'?f.name:f.__identifier)===(format==='ldtk'?'EntityId':'entityId'))?.[format==='tiled'?'value':'__value'];
 for(const [entityId,x,y] of [['office-break',3,10],['external-prop',4,4]] as const){const obj=objects.find(v=>id(v)===entityId)!;if(format==='tiled'){obj.x=x*32;obj.y=y*32;}else if(format==='ldtk')obj.px=[x*32,y*32];else obj.translation=[x,0,y];}
 const after=accepted(E.import(doc)).pack;assert.equal(rows(after.scenes[0]!.initialState.buildings).find(b=>b.id==='office-break')!.x,3);assert.equal(after.scenes[0]!.graph!.props![0]!.x,4);assert.deepEqual(after.worlds,before.worlds);assert.deepEqual(after.scenes[1],before.scenes[1]);assert.deepEqual(after.libraries,before.libraries);assert.deepEqual(after.scenes[0]!.initialState.settings,before.scenes[0]!.initialState.settings);
});
test('All external formats preserve actual progressed paid work, fractional physical positions and continued native state',()=>{
 const pack=base(),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0]!.id)) as LWContentPorts.ScenarioEngine&{advance(seconds:number):void};let paid=false;for(let i=0;i<1000;i++){engine.advance(.1);if(rows(engine.export().state.buildings).some(b=>Number(record(record(b.storage).job).progress)>0)){paid=true;break;}}assert(paid);const before=engine.export(),captured=X.capture(engine);assert.notDeepEqual(captured.scenes[0]!.initialState,pack.scenes[0]!.initialState);
 const restoredPacks:LWContentPorts.ScenarioPack[]=[];for(const format of formats){const external=E.export(captured,captured.scenes[0]!.id,format),back=accepted(E.import(external.document));assert.deepEqual(back.pack,captured);assert.deepEqual(engine.export(),before);restoredPacks.push(back.pack);}
 engine.advance(1);const continued=engine.export();for(const restoredPack of restoredPacks){const next=X.commitScene(X.prepareScene(restoredPack,restoredPack.scenes[0]!.id)) as LWContentPorts.ScenarioEngine&{advance(seconds:number):void};next.advance(1);assert.deepEqual(next.export(),continued);}
});
test('Bound interior exchange sizes use the actual canonical floor and preserve its source authority',()=>{
 const p=base(),source=p.scenes[0]!,building=rows(source.initialState.buildings).find(b=>b.kind==='bench')!,interiors=(globalThis as unknown as {LWInteriors:LWInterior.CatalogApi}).LWInteriors;
 const floor=interiors.forBuilding(source.initialState as LWInterior.CatalogWorld,building as unknown as LWInterior.CatalogBuilding).floors[0]!;source.graph={kind:'level'};p.scenes.push({id:'floor-exchange',name:'Canonical room',description:'Bound native floor',worldId:source.worldId,initialState:{},graph:{kind:'interior',parentId:source.id,binding:{type:'interior',sourceSceneId:source.id,buildingId:String(building.id),floorId:floor.id}}});
 for(const format of formats){const result=E.export(p,'floor-exchange',format),back=accepted(E.import(result.document));assert.deepEqual(back.pack,p);assert.equal(back.sceneId,'floor-exchange');if(format==='tiled'){assert.equal(result.document.width,floor.width);assert.equal(result.document.height,floor.height);}if(format==='ldtk'){const level=rows(result.document.levels)[0]!;assert.equal(level.pxWid,floor.width*32);assert.equal(level.pxHei,floor.height*32);}}
});
test('LDtk export conforms to the official 1.5.3 complete project schema',()=>{
 const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/external-ldtk.schema.json'),'utf8')) as Data;delete schema.$schema;
 const validate=new Ajv({strict:false,allErrors:true}).compile(schema);assert(validate(exported('ldtk')),JSON.stringify(validate.errors));
});
test('glTF export conforms to the official glTF 2.0 schema including real indexed proxy geometry',()=>{
 const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/external-gltf.schema.json'),'utf8')) as Data;
 const validate=new Ajv2020({strict:false,allErrors:true,formats:{'iri-reference':true}}).compile(schema);assert(validate(exported('gltf')),JSON.stringify(validate.errors));
});
test('Generic Tiled types require explicit canonical maps and can add multiple native template instances',()=>{
 const p=base(),generic={type:'map',orientation:'orthogonal',infinite:false,tilewidth:32,tileheight:32,tilesets:[],layers:[{type:'objectgroup',objects:[{name:'c4',type:'Worker',x:9*32,y:10*32},{name:'c5',type:'Worker',x:8*32,y:10*32}]}]};
 assert.equal(E.import(generic).ok,false);assert.equal(E.import(generic,{pack:p,sceneId:p.scenes[0]!.id}).ok,false);
 generic.layers[0]!.objects[0]!.type='';Object.assign(generic.layers[0]!.objects[0]!,{class:'Worker'});
 const next=accepted(E.import(generic,{pack:p,sceneId:p.scenes[0]!.id,mappings:[{externalType:'Worker',category:'creatures',templateId:'c1'}]})).pack;
 const creatures=rows(record(state(next).colony).creatures);assert.equal(creatures.length,5);assert(creatures.some(c=>c.id==='c4'));assert(creatures.some(c=>c.id==='c5'));assert.deepEqual(creatures.slice(0,3),rows(record(state(p).colony).creatures));assert.equal(rows(record(state(p).colony).creatures).length,3);
});
test('Generic LDtk definitions and instances map multiple stable IDs to canonical templates',()=>{
 const p=base(),doc=exported('ldtk');const level=rows(doc.levels)[0]!;level.fieldInstances=[];const layer=rows(level.layerInstances).find(l=>l.__type==='Entities')!;level.layerInstances=[layer];const definitions=rows(record(doc.defs).entities);definitions[0]!.identifier='Worker';layer.entityInstances=[{__identifier:'Worker',iid:'c4',defUid:definitions[0]!.uid,px:[288,320],fieldInstances:[]},{__identifier:'Worker',iid:'c5',defUid:definitions[0]!.uid,px:[256,320],fieldInstances:[]}];
 const back=accepted(E.import(doc,{pack:p,sceneId:p.scenes[0]!.id,mappings:[{externalType:'Worker',category:'creatures',templateId:'c1'}]}));assert.equal(rows(record(state(back.pack).colony).creatures).length,5);
});
test('Generic mappings preserve original finite stock unless explicitly edited and reject duplicate targets',()=>{
 const p=base(),doc={type:'map',orientation:'orthogonal',tilewidth:32,tileheight:32,layers:[{type:'objectgroup',objects:[{type:'Supply',name:'supply',x:4*32,y:6*32}]}]};const mapping:LWExternalEditors.Mapping={externalType:'Supply',category:'nodes',entityId:'receiving-blanks'};
 const next=accepted(E.import(doc,{pack:p,sceneId:p.scenes[0]!.id,mappings:[mapping]})).pack;assert.deepEqual(rows(state(next).nodes),rows(state(p).nodes));
 doc.layers[0]!.objects.push({...doc.layers[0]!.objects[0]!});assert.equal(E.import(doc,{pack:p,sceneId:p.scenes[0]!.id,mappings:[mapping]}).ok,false);
});
test('Binary GLB from standard glTF JSON and BIN chunks admits real changed placements and preserves catalog metadata',()=>{
 const p=base(),doc=exported('gltf'),obj=objectRows(doc,'gltf')[0]!;obj.translation=[9,0,10];const input=glb(doc);assert.equal(E.detect(input),'gltf');const result=accepted(E.import(input));assert.equal(record(actor(result.pack).creature).x,9);assert.deepEqual(result.pack.resources,p.resources);assert(result.warnings.some(w=>w.includes('binary')));
 for(const bad of [input.subarray(0,input.length-1),new Uint8Array([1,2,3])])assert.equal(E.import(bad).ok,false);
 const invalid=glb(doc);new DataView(invalid.buffer).setUint32(8,invalid.length+4,true);assert.equal(E.import(invalid).ok,false);
});
test('glTF nested translations preserve world height and reject elevated native entities',()=>{
 const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{translation:[0,3,0],children:[1]},{name:'Worker',translation:[2,0,2],extras:{externalType:'Worker'}}]};const p=base(),options:LWExternalEditors.Options={pack:p,sceneId:p.scenes[0]!.id,mappings:[{externalType:'Worker',category:'creatures',entityId:'c1'}]};assert.equal(E.import(doc,options).ok,false);
 const terrain={asset:{version:'2.0'},scenes:[{nodes:[0]}],nodes:[{translation:[0,3,0],children:[1]},{translation:[0,1,0],extras:{terrain:{ground:'grass'}}}]};const codec=require('./external-editor-gltf.js') as LWExternalEditors.Codec;assert.equal(codec.read(terrain).tiles[0]!.height,4);assert.equal(E.import(terrain,{pack:p,sceneId:p.scenes[0]!.id}).ok,false);
});
test('glTF metadata survives root extras loss and rejects conflicting copies',()=>{
 const p=base(),doc=exported('gltf');delete doc.extras;assert.deepEqual(accepted(E.import(doc)).pack,p);
 const conflicting=C.copy(doc);conflicting.extras={littlewild:{version:1,pack:p,sceneId:'absent'}};assert.equal(E.import(conflicting).ok,false);
});
test('External URIs, unsafe keys, sparse arrays, bad accessors, transforms and malformed refs fail atomically',()=>{
 const docs:unknown[]=[JSON.parse('{"type":"map","__proto__":{}}'),{type:'map',orientation:'orthogonal',tilewidth:32,tileheight:32,layers:new Array(1)},'{"type":"map","type":"map"}'];
 docs.push(new Uint8Array(8*1024*1024));
 const tiled=exported('tiled');rows(tiled.tilesets)[0]!.source='https://evil.test/source.tsx';docs.push(tiled);const gid=exported('tiled');(rows(gid.layers)[0]!.data as number[])[0]=0x80000001;docs.push(gid);
 const ldtk=exported('ldtk');rows(rows(rows(ldtk.levels)[0]!.layerInstances)[0]!.entityInstances)[0]!.defUid=999;docs.push(ldtk);
 for(const mutate of [(d:Data)=>rows(d.buffers)[0]!.uri='https://evil.test/model.bin',(d:Data)=>rows(d.accessors)[0]!.count=1e9,(d:Data)=>rows(d.nodes)[0]!.scale=[2,1,1],(d:Data)=>rows(d.nodes)[0]!.rotation=[0,1,0,0],(d:Data)=>record(objectRows(d,'gltf')[0]!.extras).inventory=[],(d:Data)=>rows(d.scenes)[0]!.nodes=[999999]]){const doc=exported('gltf');mutate(doc);docs.push(doc);}
 const p=base(),draft=D.create(p);for(const doc of docs)assert.equal(E.import(doc).ok,false);assert.deepEqual(draft.snapshot(),p);assert.equal(draft.revision,0);
});
test('GLB typed byte inputs cannot execute subclass or own accessors',()=>{
 let calls=0;const bytes=glb(exported('gltf'));Object.defineProperty(bytes,'byteLength',{get(){calls++;throw Error('must not execute');}});assert.equal(E.import(bytes).ok,false);assert.equal(calls,0);
 class CustomBytes extends Uint8Array{override subarray():Uint8Array<ArrayBuffer>{calls++;throw Error('must not execute');}}
 assert.equal(E.import(new CustomBytes(glb(exported('gltf')))).ok,false);assert.equal(calls,0);
});
const report={suite:'external-editors',passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'external-editors-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(r=>!r.passed))process.exitCode=1;
