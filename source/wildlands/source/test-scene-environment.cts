/* Indoor stage adapters preserve authored geometry and presentation-only state. */
/// <reference path="./scene-environment-ports.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
interface Result {name:string;passed:boolean;error?:string;}
interface CanvasApi {draw(c:CanvasRenderingContext2D,category:string,id:string,x:number,y:number,tw:number,th:number):boolean;actor(c:CanvasRenderingContext2D,actor:{archetype:string},x:number,y:number,tw:number,th:number):boolean;}
interface Loaded {LWSceneEnvironment:LWEnvironmentPorts.Api;LWCanvasAssets:CanvasApi;LWCanvasGround:{create(make:()=>HTMLCanvasElement):{ground:HTMLCanvasElement;environmentKey:string;decor:unknown[]}};}
const results:Result[]=[];
function test(name:string,work:()=>void){try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const indoor:LWEnvironmentPorts.Environment={mode:'indoor',background:'#dce3e8',floor:'#e4e2d9',alternateFloor:'#d6dadd',wall:'#b8c7cf',trim:'#577588',camera:{center:[9,9],zoom:1}};
function load(input:object,names:string[]):Loaded{const root=input as Record<string,unknown>;root.window=root;const context=vm.createContext(root);for(const name of names)vm.runInContext(fs.readFileSync(__dirname+'/'+name+'.js','utf8'),context,{filename:name});return root as unknown as Loaded;}
const profile={current:{environment:indoor,materialColors:{}},hash:'office-profile'};
const root=load({LWWorldProfile:profile},['workflow-venues','scene-environment']);
test('Indoor profile is detached and outdoor profiles retain their default renderer',()=>{
 const before=JSON.stringify(profile),copy=root.LWSceneEnvironment.read()!;(copy.camera!.center as [number,number])[0]=2;copy.wall='#000000';
 assert.equal(JSON.stringify(profile),before);assert.equal(root.LWSceneEnvironment.read({}),null);assert.equal(root.LWSceneEnvironment.key(),'office-profile');
});
test('3D room uses authored floor, wall and trim data at each island origin',()=>{
 const calls:unknown[][]=[],kit={box(...args:unknown[]){calls.push(['box',...args]);},piece(...args:unknown[]){calls.push(['piece',...args]);}};
 root.LWSceneEnvironment.populate3D(kit,null,indoor,[{x:0,y:0},{x:23,y:0}]);
 const floor=calls.filter(c=>c[0]==='piece');assert.equal(floor.length,19*19*2);assert.equal(floor[0]![3],0);assert.equal(floor[361]![3],23);
 assert(floor.some(c=>c.includes(indoor.floor)));assert(floor.some(c=>c.includes(indoor.alternateFloor)));
 assert(calls.some(c=>c[0]==='box'&&c.includes(indoor.wall)));assert(calls.some(c=>c.includes(indoor.background)));
 assert(calls.every(c=>c[0]==='box'||c[2]==='ground'),'Indoor geometry must not create forest primitives.');
});
test('Canvas room has the same tile coverage, authored walls and background',()=>{
 const calls:unknown[][]=[],context={fillStyle:'',fillRect(...a:unknown[]){calls.push(['backdrop',this.fillStyle,...a]);}},art={diamond(...a:unknown[]){calls.push(['tile',...a.slice(1)]);},poly(...a:unknown[]){calls.push(['wall',...a.slice(1)]);}};
 root.LWSceneEnvironment.groundCanvas(context as unknown as CanvasRenderingContext2D,art,indoor,19,44,22);root.LWSceneEnvironment.backdropCanvas(context as unknown as CanvasRenderingContext2D,900,700,indoor);
 assert.equal(calls.filter(c=>c[0]==='tile').length,361);assert(calls.some(c=>c[0]==='wall'&&c[2]===indoor.wall));
 assert.deepEqual(calls.at(-1),['backdrop',indoor.background,0,0,900,700]);
});
test('Onsite calls keep only the matching authored role and quest visible',()=>{
 const state:LWEnvironmentPorts.RoleState={scenarioWorkflow:{roles:[{id:'sales',label:'Sales Rep',actorId:'c2'}],deals:[{questId:'deal-q',salesRole:'sales',venueBuildingId:'desk'}]}};
 const before=JSON.stringify(state);assert.equal(root.LWSceneEnvironment.role(state,'c2'),'Sales Rep');
 assert.equal(root.LWSceneEnvironment.onsite(state,{id:'c2',activeQuest:{questId:'deal-q'}}),true);
 assert.equal(root.LWSceneEnvironment.onsite(state,{id:'c1',activeQuest:{questId:'deal-q'}}),false);
 assert.equal(root.LWSceneEnvironment.onsite(state,{id:'c2',activeQuest:{questId:'other'}}),false);
 state.scenarioWorkflow!.deals![0]!.venueBuildingId=null;assert.equal(root.LWSceneEnvironment.onsite(state,{id:'c2',activeQuest:{questId:'deal-q'}}),false);
 state.scenarioWorkflow!.deals![0]!.venueBuildingId='desk';assert.equal(JSON.stringify(state),before);
});
test('Canvas fixtures use installed model hierarchies, profile material colors and actor assets',()=>{
 const calls:unknown[][]=[],asset={materials:{desk:'#112233'},models:{world:{nodes:[{primitive:'group',position:[2,0,0],children:[{primitive:'box',material:'desk',position:[0,.5,0],scale:[2,1,1]}]}]}}};
 const assets=load({LWWorldProfile:{current:{materialColors:{'#112233':'#abcdef'}}},LWAssets:{get(category:string,id:string){calls.push(['asset',category,id]);return asset;}},LWCreatures:{get(){return {visualAsset:'staff-rig'};}}},['canvas-assets']);
 const paths:number[][][]=[],context={globalAlpha:1,fillStyle:'',save(){},restore(){},beginPath(){paths.push([]);},moveTo(x:number,y:number){paths.at(-1)!.push([x,y]);},lineTo(x:number,y:number){paths.at(-1)!.push([x,y]);},closePath(){},fill(){calls.push(['fill',this.fillStyle]);}};
 const before=JSON.stringify(asset);assert.equal(assets.LWCanvasAssets.draw(context as unknown as CanvasRenderingContext2D,'building','desk',100,100,44,22),true);
 assert(paths.some(points=>points.some(p=>p[0]!>140)),'Nested authored position must move the projected fixture.');
 assert(calls.some(c=>c[0]==='fill'&&c[1]==='#abcdef'),'Authored top surface must use the installed palette.');
 assert.equal(assets.LWCanvasAssets.actor(context as unknown as CanvasRenderingContext2D,{archetype:'staff'},0,0,44,22),true);assert(calls.some(c=>c[0]==='asset'&&c[1]==='actor'&&c[2]==='staff-rig'));
 assert.equal(JSON.stringify(asset),before);
});
test('Indoor cached Canvas ground never invokes outdoor terrain or random decoration',()=>{
 const calls:unknown[][]=[],canvas={getContext(){return {translate(){},set imageSmoothingEnabled(value:boolean){}};}};
 const ground=load({LW:{SIZE:19,terrain(){throw Error('Outdoor terrain invoked');},seeded(){throw Error('Random decoration invoked');}},LWCanvasArt:{TW:44,TH:22},LWSceneEnvironment:{read(){return indoor;},key(){return 'room-v2';},groundCanvas(...a:unknown[]){calls.push(a);}}},['canvas-ground']);
 const result=ground.LWCanvasGround.create(()=>canvas as unknown as HTMLCanvasElement);assert.equal(result.ground,canvas);assert.equal(result.environmentKey,'room-v2');assert.equal(result.decor.length,0);assert.equal(calls.length,1);
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/scene-environment-results.json',JSON.stringify({passed,total:results.length,results},null,2)+'\n');
console.log(passed+'/'+results.length+' scene environment checks passed');if(passed!==results.length)process.exitCode=1;
