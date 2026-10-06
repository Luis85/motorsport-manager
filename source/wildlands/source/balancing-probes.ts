/// <reference path="./balancing-tools-contracts.d.ts" />
/// <reference path="./developer-contracts.d.ts" />
/* Bounded experiments use detached native engines under reversible catalog/profile scopes. */
(function(inputRoot:unknown){
 'use strict';
 interface Engine extends LWContentPorts.ScenarioEngine {s:Record<string,unknown>;step(dt:number):void;dispatchCommand(command:LittlewildDeveloper.Command):unknown;}
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWScenarios:LWContentPorts.ScenarioApi;LWSceneGraph:LWSceneGraph.Api;LWScenarioResources:{withResources<T>(resources:LWContentPorts.Resources|undefined,work:()=>T):T};LWWorldProfile:{withProfile<T>(world:LWContentPorts.WorldProfile,work:()=>T):T};LWDeveloperCommands:{validate(input:unknown,scope:'actor'|'world'):LittlewildDeveloper.Command};LWCommandRouter:{manifest:readonly LittlewildDeveloper.CommandDefinition[]};LWBalancingCore:LWBalancing.Core;LWBalancing?:LWBalancing.Api};
 const C=root.LWContent,X=root.LWScenarios,B=root.LWBalancingCore;
 const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const list=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.map(record):[];
 const numeric=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?value:0;
 const sum=(value:unknown):number=>Object.values(record(value)).reduce<number>((n,v)=>n+numeric(v),0);
 const mean=(actors:Record<string,unknown>[],key:string):number=>actors.reduce((n,a)=>n+numeric(record(a.needs)[key]),0)/Math.max(1,actors.length);
 function options(input:LWBalancing.ProbeOptions,sweep=false):LWBalancing.ProbeOptions{
  const checked=C.parse(input,64*1024) as LWBalancing.ProbeOptions;
  if(!checked||typeof checked!=='object'||Object.keys(checked).some(k=>!['sceneId','seed','steps','commands',...(sweep?['path','values']:[])].includes(k))||typeof checked.sceneId!=='string'||!checked.sceneId||!Number.isInteger(checked.seed)||checked.seed<1||checked.seed>2147483647||!Number.isInteger(checked.steps)||checked.steps<0||checked.steps>36000||checked.commands!==undefined&&(!Array.isArray(checked.commands)||checked.commands.length>64))throw Error('Probe requires a scene ID, integer seed 1..2147483647, 0..36000 steps and at most 64 typed commands.');
  if(checked.commands)for(const command of checked.commands){const definition=root.LWCommandRouter.manifest.find(d=>d.id===command.id);if(!definition)throw Error('Unknown probe command.');root.LWDeveloperCommands.validate(command,definition.scope);}
  return checked;
 }
 function metrics(engine:Engine):LWBalancing.Metrics{
  const state=record(engine.export().state),colony=record(state.colony),actors=list(colony.creatures),buildings=list(state.buildings),player=record(state.player);
  return {seconds:numeric(state.simTime),actors:actors.length,food:mean(actors,'food'),water:mean(actors,'water'),energy:mean(actors,'energy'),joy:mean(actors,'joy'),inventory:actors.reduce((n,a)=>n+sum(a.inventory),0),warehouse:sum(record(colony.warehouse).inventory),nodeStock:list(state.nodes).reduce((n,a)=>n+numeric(a.stock),0),produced:buildings.reduce((n,b)=>n+sum(record(b.storage).output),0),gathered:actors.reduce((n,a)=>n+numeric(record(a.stats).gathered),0),guideCoins:numeric(player.coins),research:numeric(state.rp),playerLevel:numeric(player.level),actorLevels:actors.reduce((n,a)=>n+numeric(record(a.creature).level),0),questSuccesses:actors.reduce((n,a)=>n+list(a.questHistory).filter(q=>!q.aborted&&numeric(q.successes)>=numeric(q.required)).length,0),duelRounds:list(record(state.creatureInteractions).active).reduce((n,d)=>n+list(d.rounds).length,0)+list(record(state.creatureInteractions).history).reduce((n,d)=>n+list(d.rounds).length,0)};
 }
 function run(inputPack:LWContentPorts.ScenarioPack,config:LWBalancing.ProbeOptions):LWBalancing.Metrics{
  const value=C.copy(inputPack),selected=value.scenes.find(s=>s.id===config.sceneId);if(!selected)throw Error('Unknown probe scene.');
  const scene=root.LWSceneGraph.owner(value,selected.id);
  scene.initialState.seed=config.seed;
  if(scene.initialState.colony){const colony=record(scene.initialState.colony);colony.rng=config.seed;for(const [index,actor]of list(colony.creatures).entries())record(actor.rpg).rng=(config.seed+index*1913)>>>0;}
  if(scene.initialState.creatureInteractions)record(scene.initialState.creatureInteractions).rng=config.seed;
  const preview=X.prepareScene(value,config.sceneId),engine=preview.engine as Engine;
  return root.LWScenarioResources.withResources(value.resources,()=>root.LWWorldProfile.withProfile(preview.context.world,()=>X.withRuntime(value.libraries,preview.context.simulation,()=>{
   for(const command of config.commands??[]){const result=engine.dispatchCommand(command);if(record(result).ok===false)throw Error(String(record(result).reason??'Probe command rejected.'));}
   engine.s.started=true;engine.s.paused=false;
   for(let i=0;i<config.steps;i++)engine.step(.1);
   return metrics(engine);
  })));
 }
 function probe(inputPack:unknown,input:unknown,inputOptions:LWBalancing.ProbeOptions):LWBalancing.Probe{
  const config=options(inputOptions),checked=X.validate(C.parse(inputPack,12*1024*1024));if(!checked.ok)throw Error(checked.errors.join('\n'));
  const candidate=B.candidate(checked.pack,input),baseline=run(checked.pack,config),after=run(candidate,config);
  const delta={...baseline};for(const key of Object.keys(delta) as (keyof LWBalancing.Metrics)[])delta[key]=after[key]-baseline[key];
  return {seed:config.seed,steps:config.steps,baseline,candidate:after,delta};
 }
 function sweep(inputPack:unknown,input:unknown,inputOptions:LWBalancing.SweepOptions):LWBalancing.SweepRow[]{
  const config=options(inputOptions,true) as LWBalancing.SweepOptions;
  if(typeof config.path!=='string'||!/^\/simulation\/rules\/gameplay\/[a-zA-Z]+\/[a-zA-Z]+$/.test(config.path)||!Array.isArray(config.values)||!config.values.length||config.values.length>16||config.values.some(v=>typeof v!=='number'||!Number.isFinite(v))||config.steps*config.values.length*2>72000)throw Error('Sweep needs one declared gameplay path, 1..16 finite values and at most 72000 total simulation steps.');
  const segments=config.path.slice(1).split('/');
  return config.values.map(value=>{
   try{
    const draft=C.parse(input,12*1024*1024),data=record(draft);let parent=data;
    for(const key of segments.slice(0,-1)){if(!Object.hasOwn(parent,key))throw Error('Unknown sweep path.');parent=record(parent[key]);}
    const key=segments.at(-1)!;if(!Object.hasOwn(parent,key)||typeof parent[key]!=='number')throw Error('Sweep path must be a declared numeric tuner.');parent[key]=value;
    return {value,probe:probe(inputPack,draft,{sceneId:config.sceneId,seed:config.seed,steps:config.steps,...(config.commands?{commands:config.commands}:{})}),errors:[]};
   }catch(error){return {value,probe:null,errors:[{path:config.path,code:'invalid-candidate',message:error instanceof Error?error.message:String(error)}]};}
  });
 }
 const {candidate,...core}=B;
 const api:LWBalancing.Api=Object.freeze({...core,probe,sweep});root.LWBalancing=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
