/// <reference path="./renderer-scene-2d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
interface Result {name:string;passed:boolean;error?:string;}
const results:Result[]=[];
function test(name:string,work:()=>void):void {try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const painter=require('./renderer-scene-2d.js') as LittlewildRenderer2D.Api;
function freeze<T>(value:T):T {if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
const littlewild=(require('./tools/game-folder.cjs') as typeof import('./tools/game-folder.cjs')).gameDirectory('littlewild');
const asset=freeze(JSON.parse(fs.readFileSync(path.join(littlewild,'assets/creatures/sproutling/definition.json'),'utf8')).visual as LittlewildDeveloper.Document);
const bench=freeze(JSON.parse(fs.readFileSync(path.join(littlewild,'assets/buildings/bench/definition.json'),'utf8')).visual as LittlewildDeveloper.Document);
const satchel=freeze(JSON.parse(fs.readFileSync(path.join(littlewild,'assets/items/field_satchel/definition.json'),'utf8')).visual as LittlewildDeveloper.Document);
const frame=freeze({version:1,time:2,delta:.016,simTime:7,running:true,alpha:1,camera:{x:0,y:0,z:1},viewport:{width:800,height:600,pixelRatio:1},
 actors:[{id:'onsite',name:'Onsite',archetype:'sproutling',visualAsset:'sproutling',personality:'curious',equipment:{back:'field_satchel'},away:false,selected:true,x:9,y:9,height:0},{id:'away',name:'Away',archetype:'sproutling',visualAsset:'sproutling',personality:'curious',equipment:{},away:true,selected:false,x:10,y:9,height:0}],
 nodes:[],buildings:[{id:'bench',kind:'bench',x:8,y:8,height:0,details:{id:'bench',kind:'bench',x:8,y:8}}],props:[{id:'prop',name:'Authored bench',category:'building',assetId:'bench',model:'world',x:7,y:7}],
 tiles:[{x:8,y:8,ground:'grass',height:0},{x:9,y:9,ground:'grass',height:0}],terrain:{},construction:{},interiors:{},environment:null,presentation:{},interiorView:null,room:null}) as LittlewildRenderer.Frame;
const assetsRequested:string[]=[];
const context:LittlewildRenderer.Context={canvas:null as unknown as HTMLCanvasElement,signal:new AbortController().signal,
 query:{frame(){throw Error('Painter must use its supplied detached frame.');},buildingInterior(){throw Error('Painter must use its supplied detached room.');},creatureDefinition(){throw Error('Actor visual binding is in the frame.');},asset(category,id){assetsRequested.push(category+':'+id);return id==='sproutling'?asset:id==='bench'?bench:id==='field_satchel'?satchel:null;}},
 commands:{submit(){throw Error('Rendering must never emit authoritative intent.');}},onDispose(){throw Error('Pure geometry owns no lifecycle resources.');}};
function capture(){
 const polygons:{points:readonly LittlewildRenderer.Point[];color:string;opacity:number}[]=[],texts:string[]=[],labels:{value:string;x:number;y:number}[]=[],circles:LittlewildRenderer.Point[]=[];
 const output:LittlewildRenderer2D.Painter={polygon(points,color,opacity=1){assert(points.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));polygons.push({points,color,opacity});},circle(x,y){circles.push({x,y});},text(value,x,y){texts.push(value);labels.push({value,x,y});}};
 return{polygons,texts,labels,circles,output};
}
test('Canonical detached creature, building and authored prop geometry uses only the asset observation port',()=>{
 const before=JSON.stringify({frame,asset,bench}),drawing=capture();painter.draw(frame,context,drawing.output);
 assert(drawing.polygons.length>100,'Authored rounded creature primitives must be projected.');
 assert(drawing.texts.includes('Onsite'));assert(drawing.texts.includes('Authored bench'));assert(!drawing.texts.includes('Away'));
 assert(assetsRequested.includes('building:bench'));assert(assetsRequested.includes('actor:sproutling'));assert(assetsRequested.includes('item:field_satchel'));assert.equal(drawing.circles.length,0,'Canonical actor cannot be replaced by a fallback marker.');
 assert.equal(JSON.stringify({frame,asset,bench}),before);
});
test('Scene bounds clip source objects while camera projection remains invertible',()=>{
 const scoped=freeze({...frame,scene:{id:'scoped',name:'Scoped',dimension:'2d' as const,bounds:{x:7,y:7,width:2,height:2}}}),drawing=capture();painter.draw(scoped,context,drawing.output);
 assert(!drawing.texts.includes('Onsite'));assert(drawing.texts.includes('Authored bench'));
 for(const tile of [{x:7,y:7},{x:8,y:8}])assert.deepEqual(painter.toTile(painter.project(tile,scoped),scoped),tile);
 assert.equal(painter.hitTest(painter.project({x:9,y:9},frame),frame)?.actorId,'onsite');
 assert.equal(painter.hitTest(painter.project({x:9,y:9},scoped),scoped)?.actorId,undefined);
});
test('Interior painting uses only the requested native floor and workers actual room coordinates',()=>{
 const floors=[{id:'ground',label:'Ground',width:3,height:3,door:{x:0,y:0},stairs:[],stations:[]},{id:'upper',label:'Upper',width:3,height:3,door:{x:0,y:0},stairs:[],stations:[{id:'station',label:'Upper workbench',kind:'workbench' as const,production:true,x:1,y:1}]}];
 const worker={id:'worker',name:'Upper worker',archetype:'sproutling',visualAsset:'sproutling',floorId:'upper',stationId:'station',action:'Making planks',mood:'content',progress:.4,remainingSeconds:4,moving:false,direction:0,cargo:'',transfer:false,x:1,y:1};
 const room={fixtureAsset:'bench',fixtureModel:'world',buildingId:'b1',buildingName:'Workshop',kind:'bench',floors,actors:[worker,{...worker,id:'ground-worker',name:'Ground worker',floorId:'ground'}],time:7,status:{label:'Working',kind:'work',detail:''},input:{},output:{},recipes:[],transfers:[]};
 const interior=freeze({...frame,room,interiorView:{buildingId:'b1',floorId:'upper',surface:{x:70,y:90,width:500,height:300}}}),before=JSON.stringify(interior),drawing=capture();painter.draw(interior,context,drawing.output);
 assert(drawing.texts.includes('Workshop · Upper'));assert(drawing.texts.includes('Upper worker'));assert(!drawing.texts.includes('Making planks'),'Station actions remain in the live activity panel instead of overlapping the fixture label.');assert(drawing.texts.includes('Upper workbench'));
 assert(!drawing.texts.includes('Ground worker'));assert(!drawing.texts.includes('Onsite'));assert.equal(drawing.circles.length,0);assert(drawing.polygons.length>100);
 assert.equal(JSON.stringify(interior),before);
 const walking=capture();painter.draw({...interior,room:{...room,actors:[{...worker,stationId:null,action:'Walking'}]}},context,walking.output);assert(walking.texts.includes('Walking'));
});
test('Asset transforms and material opacity are applied without modifying the authored definition',()=>{
 const authored=freeze({materials:{ink:{color:'#806040',opacity:.25}},models:{world:{nodes:[{primitive:'group',position:[2,0,0],children:[{primitive:'box',scale:[1,2,1],material:'ink'}]}]}}}) as unknown as LittlewildDeveloper.Document;
 const port={...context,query:{...context.query,asset(){return authored;}}},drawing=capture(),before=JSON.stringify(authored);
 assert(painter.drawAsset(port,drawing.output,'building','fixture',100,100,40,{rotation:Math.PI/2,scale:2}));assert(drawing.polygons.length>=3);assert(drawing.polygons.every(poly=>poly.opacity===.25));
 assert(drawing.polygons.every(poly=>poly.points.every(point=>point.x>100)));assert.equal(JSON.stringify(authored),before);
 assert.equal(painter.drawAsset(context,drawing.output,'item','missing',0,0,40),false);
});
test('Raised and lowered native tiles share exactly one height-aware draw, projection and inverse under pan and zoom',()=>{
 for(const height of [2,-1])for(const camera of [{x:0,y:0,z:1},{x:83,y:-41,z:.7},{x:-27,y:65,z:1.6}]){
  const tiles=Array.from({length:361},(_,index)=>({x:index%19,y:Math.floor(index/19),height:index===180?height:0,ground:'grass'}));
  const raised=freeze({...frame,camera,tiles,actors:[],buildings:[],props:[]}),before=JSON.stringify(raised),drawing=capture();painter.draw(raised,context,drawing.output);
  const expected={x:400+camera.x,y:300+camera.y-height*12*camera.z},projected=painter.project({x:9,y:9},raised);
  assert.deepEqual(projected,expected);assert.deepEqual(painter.toTile(expected,raised),{x:9,y:9});assert.deepEqual(painter.hitTest(expected,raised),{x:9,y:9});
  const visible=drawing.polygons.filter(poly=>poly.color==='#bed0a9').some(poly=>Math.abs(poly.points.reduce((sum,p)=>sum+p.x,0)/poly.points.length-expected.x)<1e-8&&Math.abs(poly.points.reduce((sum,p)=>sum+p.y,0)/poly.points.length-expected.y)<1e-8);
  assert(visible,'Picked center must be the center actually painted for this native tile.');assert.equal(JSON.stringify(raised),before);
 }
});
test('Actors, canonical props and terrain previews use native or proposed height without double displacement',()=>{
 const raised=freeze({...frame,tiles:[{x:9,y:9,ground:'grass',height:2}],actors:[{...frame.actors[0]!,height:2,selected:false}],buildings:[],props:[{...frame.props[0]!,x:9,y:9}],presentation:{terraformPreview:{tiles:[{x:9,y:9,height:3}]}}}),drawing=capture();painter.draw(raised,context,drawing.output);
 const actorLabel=drawing.labels.find(label=>label.value==='Onsite')!,propLabel=drawing.labels.find(label=>label.value==='Authored bench')!,preview=drawing.polygons.find(poly=>poly.opacity===.6)!;
 assert.deepEqual({x:actorLabel.x,y:actorLabel.y},{x:400,y:240});assert.equal(propLabel.x,400);assert(Math.abs(propLabel.y-292.8)<1e-8);
 assert.equal(preview.points.reduce((sum,p)=>sum+p.y,0)/preview.points.length,264);
 assert.equal(painter.hitTest({x:400,y:264},raised)?.actorId,'onsite');
});
test('Room-local projection and picking select only workers on the visible native floor',()=>{
 const floor={id:'upper',label:'Upper',width:4,height:3,door:{x:0,y:0},stairs:[],stations:[]},worker={id:'upper-worker',name:'Upper worker',archetype:'sproutling',visualAsset:'sproutling',floorId:'upper',stationId:null,action:'Working',mood:'content',progress:null,remainingSeconds:null,moving:false,direction:0,cargo:'',transfer:false,x:1,y:1};
 const room={fixtureAsset:'bench',fixtureModel:'world',buildingId:'b1',buildingName:'Workshop',kind:'bench',floors:[floor,{...floor,id:'lower'}],actors:[worker,{...worker,id:'lower-worker',floorId:'lower'}],time:7,status:{label:'Working',kind:'work',detail:''},input:{},output:{},recipes:[],transfers:[]};
 const interior=freeze({...frame,room,interiorView:{buildingId:'b1',floorId:'upper',surface:{x:70,y:90,width:500,height:300}},camera:{x:400,y:-300,z:2}}),drawing=capture();painter.draw(interior,context,drawing.output);
 const label=drawing.labels.find(value=>value.value==='Upper worker')!,p=painter.project({x:1,y:1},interior),unit=72;
 assert.deepEqual({x:label.x,y:label.y},{x:p.x,y:p.y-unit*.8});assert.deepEqual(painter.toTile(p,interior),{x:1,y:1});
 assert.deepEqual(painter.hitTest({x:p.x,y:p.y-unit*.2},interior),{x:1,y:1,actorId:'upper-worker',objectType:'pip'});
 assert.equal(painter.hitTest({x:0,y:0},interior),null);assert.equal(painter.hitTest(painter.project({x:9,y:9},interior),interior),null);
});
test('Office cutaway consumes detached authored background, floor, trim and window colors within its native scene footprint',()=>{
 const pack=JSON.parse(fs.readFileSync(path.resolve('source/content/office.pack.json'),'utf8')) as {worlds:{id:string;environment:LittlewildDeveloper.Document}[]},environment=pack.worlds.find(world=>world.id==='office-floor')!.environment;
 const indoor=freeze({...frame,environment,scene:{id:'office',name:'Office',dimension:'2d' as const,bounds:{x:5,y:5,width:4,height:3}},tiles:Array.from({length:361},(_,index)=>({x:index%19,y:Math.floor(index/19),height:0,ground:'grass'})),actors:[],buildings:[],props:[]}),drawing=capture(),before=JSON.stringify(indoor);
 painter.draw(indoor,context,drawing.output);assert.equal(drawing.polygons[0]!.color,environment.background);
 const floors=drawing.polygons.filter(poly=>poly.color===environment.floor||poly.color===environment.alternateFloor);assert.equal(floors.length,12);assert(floors.some(poly=>poly.color===environment.floor));assert(floors.some(poly=>poly.color===environment.alternateFloor));
 assert(drawing.polygons.some(poly=>poly.color===environment.wall));assert(drawing.polygons.some(poly=>poly.color===environment.trim));assert(!drawing.polygons.some(poly=>poly.color==='#bed0a9'||poly.color==='#b6c8a0'));assert.equal(JSON.stringify(indoor),before);
 const invalid=capture();painter.draw({...indoor,environment:{...environment,floor:{unsafe:'paint'},background:'url(https://example.invalid)'}},context,invalid.output);assert.equal(invalid.polygons[0]!.color,'#dce3e8');assert(invalid.polygons.some(poly=>poly.color==='#e4e2d9'));
});
test('Terrain and construction previews remain within the active scene bounds and preserve detached drafts',()=>{
 const scoped=freeze({...frame,scene:{id:'scoped',name:'Scoped',dimension:'2d' as const,bounds:{x:8,y:8,width:2,height:2}},actors:[],buildings:[],props:[],presentation:{terraformPreview:{tiles:[{x:9,y:9,height:2},{x:10,y:9,height:2}],plants:[]},constructionPreview:{x:8,y:8,design:{footprint:[{x:0,y:0},{x:2,y:0}]}},placement:'bench',hover:{x:11,y:11}}}),drawing=capture(),before=JSON.stringify(scoped);
 painter.draw(scoped,context,drawing.output);assert.equal(drawing.polygons.filter(poly=>poly.opacity===.6).length,1);assert.equal(drawing.polygons.filter(poly=>poly.opacity===.5).length,1);assert.equal(drawing.polygons.filter(poly=>poly.opacity===.65).length,0);assert.equal(JSON.stringify(scoped),before);
});
test('Compact embedded rooms fill their scoped canvas without duplicate titles or piled workstation labels',()=>{
 const floor={id:'upper',label:'Upper',width:8,height:8,door:{x:0,y:0},stairs:[],stations:[{id:'bench',label:'Manufacturing workstation',kind:'workbench' as const,production:true,x:3,y:3}]},room={fixtureAsset:'bench',fixtureModel:'world',buildingId:'b1',buildingName:'Workshop',kind:'bench',floors:[floor],actors:[],time:7,status:{label:'Idle',kind:'idle',detail:''},input:{},output:{},recipes:[],transfers:[]};
 const compact=freeze({...frame,viewport:{width:280,height:220,pixelRatio:1},room,interiorView:{buildingId:'b1',floorId:'upper',surface:null},presentation:{embedded:true},scene:{id:'room',name:'Upper workshop',kind:'interior' as const,dimension:'2d' as const,bounds:null}}),drawing=capture(),before=JSON.stringify(compact);painter.draw(compact,context,drawing.output);
 const floors=drawing.polygons.filter(poly=>poly.color==='#ddd1ad'||poly.color==='#e6d9b6'),xs=floors.flatMap(poly=>poly.points.map(point=>point.x));assert.equal(floors.length,64);assert(Math.max(...xs)-Math.min(...xs)>240);assert(!drawing.labels.some(label=>label.value.includes('Workshop')||label.value.includes('workstation')));assert.equal(JSON.stringify(compact),before);
});
const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
fs.writeFileSync(__dirname+'/renderer-scene-2d-results.json',JSON.stringify(report,null,2)+'\n');console.log(report.passed+'/'+report.total+' renderer scene geometry checks passed');if(report.passed!==report.total)process.exitCode=1;
