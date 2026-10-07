/// <reference path="../renderer-data-contracts.d.ts" />
/// <reference path="../scene-navigation-contracts.d.ts" />
/// <reference path="../building-interior-contracts.d.ts" />
/**
 * Shared, read-only fixtures of the scene-navigation and scene-journeys suites: the composite
 * showcase profile is installed before any engine module loads, and every helper builds fresh values.
 */
import './install-games.cjs';
import fs from 'node:fs';
export const sdk=require('../developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};
require('../scene-navigation.js');
export interface Native extends LWInterior.Engine {
 scenarioContext?:LWContentPorts.ExperienceContext;
 s:LWInterior.World & {scenarioResources?:LWContentPorts.Resources;settings:Record<string,boolean>;player:{coins:number};paused:boolean};
 advance(seconds:number):void;step(dt:number):void;export():{version:number;state:LWInterior.World & Record<string,unknown>};
 buildingInterior(id:string):{floors:{id:string}[]}|null;
 orderBuildingProduction(b:string,f:string,s:string,r:string,n:number):{ok:boolean};
}
export const root=globalThis as unknown as {
 LW:{createWorldDemo():Native;Engine:{import(input:unknown):Native}};LWScenarios:LWContentPorts.ScenarioApi;LWSceneNavigation:LWSceneNavigation.NavigationApi;
 LWContent:LWContentPorts.ContentApi;LWWorldProfile:{current:unknown};LWSimulationProfile:{current:unknown};
 LWStory:{encode(e:Native):Record<string,unknown>;inspect(input:unknown):unknown;commit(input:unknown):Native};
};
export const X=root.LWScenarios,N=root.LWSceneNavigation,C=root.LWContent;

/** Named-check harness: each suite records its checks and writes its pinned result file once. */
export function checks(resultFile:string):{test(name:string,work:()=>void):void;finish():void}{
 const results:{name:string;passed:boolean;error?:string}[]=[];
 return {
  test(name,work){
   const started=Date.now();console.log('START '+name);
   try{work();results.push({name,passed:true});console.log('PASS '+name+' ('+(Date.now()-started)+' ms)');}
   catch(error){results.push({name,passed:false,error:String(error)});console.error('FAIL '+name+' ('+(Date.now()-started)+' ms)',error);}
  },
  finish(){
   const report={passed:results.filter(r=>r.passed).length,total:results.length,results};
   fs.writeFileSync(resultFile,JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
  }
 };
}
export const native=(e:LWContentPorts.ScenarioEngine):Native=>e as Native;
export const launch=(pack:LWContentPorts.ScenarioPack,id='home'):Native=>native(X.commitScene(X.prepareScene(pack,id)));
export const move=(engine:Native,id:string):Native=>native(N.commit(engine,N.prepare(engine,id)));
export function active():string{return C.stable({library:C.registry.export(),world:root.LWWorldProfile.current,simulation:root.LWSimulationProfile.current});}
export function pack():LWContentPorts.ScenarioPack{
 X.commitScene(X.prepareScene(X.builtins()[0]!,'charted-home'));
 const p=X.capture(root.LW.createWorldDemo()),initial=C.copy(p.scenes[0]!.initialState),homeWorld=p.worlds[0]!;
 p.id='scene-journey-test';p.name='Journey tests';p.scenes=[];
 const farWorld=C.copy(homeWorld);farWorld.id='far-world';farWorld.name='Far world';
 farWorld.environment={mode:'indoor',background:'#eeeeee',floor:'#dddddd',alternateFloor:'#cccccc',wall:'#bbbbbb',trim:'#aaaaaa',camera:{center:[9,9],zoom:1}};
 p.worlds.push(farWorld);
 const home:LWContentPorts.Scene={id:'home',name:'Home',description:'Native shared home',worldId:homeWorld.id,initialState:initial,
  graph:{kind:'level',connections:[{id:'far',label:'Far world',targetSceneId:'far'},{id:'room',label:'Upper workshop',targetSceneId:'room'},{id:'island',label:'Home shore',targetSceneId:'shore'}]}};
 const building=(initial.buildings as {id:string;kind:string}[]).find(b=>b.kind==='bench')!;
 const farState=C.copy(initial);(farState.player as {coins:number}).coins=333;
 p.scenes.push(home,{id:'far',name:'Far world',description:'Separate native checkpoint',worldId:farWorld.id,initialState:farState,graph:{kind:'dungeon',connections:[{id:'home',label:'Return home',targetSceneId:'home'}]}},
  {id:'room',name:'Upper workshop',description:'Same workers and paid jobs',worldId:homeWorld.id,initialState:{},graph:{kind:'interior',parentId:'home',binding:{type:'interior',sourceSceneId:'home',buildingId:building.id,floorId:'upper'},connections:[{id:'home',label:'Back to map',targetSceneId:'home'}]}},
  {id:'shore',name:'Home shore',description:'Owned home island',worldId:homeWorld.id,initialState:{},graph:{kind:'island',parentId:'home',binding:{type:'island',sourceSceneId:'home',ix:0,iy:0},connections:[{id:'home',label:'Back to home',targetSceneId:'home'}]}});
 return p;
}
export function until(engine:Native,condition:()=>boolean):void{for(let i=0;i<2400;i++){engine.step(.1);if(condition())return;}throw Error('Physical worker did not reach the paid job.');}
