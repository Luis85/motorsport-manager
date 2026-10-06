/// <reference path="./rts-contracts.d.ts" />
/// <reference path="./rts-runtime-contracts.d.ts" />
/** Detached content inspection and bounded, explicit-clock RTS experiments. */
(function(inputRoot:unknown){
 'use strict';
 interface Runtime {create(catalog?:LWRTSData.Catalog,missionId?:string):LWRTSRuntime.Session;restore?(checkpoint:unknown):LWRTSRuntime.Session;}
 interface Scheduled {atTick:number;command:LWRTSRuntime.Command;}
 interface Recipe {missionId?:string;ticks:number;commands:Scheduled[];stopOnError:boolean;}
 const root=inputRoot as {LWRTS:Runtime;LWRTSCatalog:LWRTSData.CatalogApi;LWRTSTools?:unknown};
 const maxBytes=8*1024*1024,maxTicks=20000,maxCommands=256;
 const kinds:readonly LWRTSData.Kind[]=['resources','factions','units','buildings','items','technologies','abilities','terrain','missions'];
 const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function parse(input:unknown):unknown {
  if(typeof input!=='string'){
   let nodes=0;const active=new Set<object>();
   function visit(value:unknown,depth:number):void {
    if(++nodes>200000||depth>32)throw Error('RTS document structure exceeds limits.');
    if(value===null||typeof value==='string'||typeof value==='boolean')return;
    if(typeof value==='number'&&Number.isFinite(value))return;
    if(typeof value!=='object'||!value)throw Error('RTS documents contain only finite JSON values.');
    const prototype=Object.getPrototypeOf(value);
    if(active.has(value)||(Array.isArray(value)?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null))throw Error('RTS documents must be acyclic plain data.');
    active.add(value);
    const descriptors=Object.getOwnPropertyDescriptors(value);
    if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'))throw Error('RTS document keys must be strings.');
    for(const [key,descriptor]of Object.entries(descriptors)){
     if(Array.isArray(value)&&key==='length')continue;
     if(!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw Error('RTS documents cannot contain accessors or hidden values.');
     visit(descriptor.value,depth+1);
    }
    if(Array.isArray(value)&&Object.keys(value).length!==value.length)throw Error('RTS arrays must be dense.');
    active.delete(value);
   }
   visit(input,0);
   if(new TextEncoder().encode(JSON.stringify(input)).byteLength>maxBytes)throw Error('RTS document exceeds 8 MiB.');
   return input;
  }
  if(new TextEncoder().encode(input).byteLength>maxBytes)throw Error('RTS document exceeds 8 MiB.');
  return JSON.parse(input) as unknown;
 }
 function recipe(input:unknown):Recipe {
  const value=parse(input);
  if(!object(value)||Object.keys(value).some(key=>!['missionId','ticks','commands','stopOnError'].includes(key)))throw Error('Expected an RTS run recipe.');
  if(!Number.isInteger(value.ticks)||Number(value.ticks)<0||Number(value.ticks)>maxTicks)throw Error('ticks must be an integer from 0 to 20000.');
  if(value.missionId!==undefined&&(typeof value.missionId!=='string'||!value.missionId))throw Error('missionId must be a nonempty string.');
  if(value.stopOnError!==undefined&&typeof value.stopOnError!=='boolean')throw Error('stopOnError must be Boolean.');
  const commands=value.commands??[];
  if(!Array.isArray(commands)||commands.length>maxCommands)throw Error('commands must be an array of at most 256 entries.');
  let previous=-1;
  for(const scheduled of commands){
   if(!object(scheduled)||Object.keys(scheduled).some(key=>!['atTick','command'].includes(key))||!Number.isInteger(scheduled.atTick)||Number(scheduled.atTick)<previous||Number(scheduled.atTick)<0||Number(scheduled.atTick)>Number(value.ticks)||!object(scheduled.command))throw Error('Commands need ordered atTick values within the requested run and command objects.');
   previous=Number(scheduled.atTick);
  }
  return {ticks:Number(value.ticks),commands:copy(commands as Scheduled[]),stopOnError:value.stopOnError!==false,...(typeof value.missionId==='string'?{missionId:value.missionId}:{})};
 }
 function validate(input:unknown):{ok:boolean;errors:string[];catalog:LWRTSData.Catalog|null} {
  try{return {ok:true,errors:[],catalog:root.LWRTSCatalog.validate(parse(input))};}
  catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)],catalog:null};}
 }
 function checked(input?:unknown):LWRTSData.Catalog {
  return input===undefined?root.LWRTSCatalog.clone():root.LWRTSCatalog.validate(parse(input));
 }
 function inspect(missionId?:string,input?:unknown):unknown {
  const catalog=checked(input),mission=catalog.missions.find(value=>value.id===(missionId??catalog.missions[0]?.id));
  if(!mission)throw Error('Unknown RTS mission: '+missionId);
  return copy({catalogId:catalog.id,mission,counts:Object.fromEntries(kinds.map(kind=>[kind,catalog[kind].length])),startingEntities:mission.spawns.reduce((sum,spawn)=>sum+spawn.count,0),resourceDeposits:mission.deposits.length,itemDrops:mission.items.length});
 }
 function execute(session:LWRTSRuntime.Session,options:Recipe):unknown {
  const startTick=session.query().tick,results:{atTick:number;command:LWRTSRuntime.Command;result:LWRTSRuntime.Result}[]=[];
  let completed=0,index=0,reason='requested-ticks-completed';
  let observed=session.query();
  while(completed<=options.ticks){
   while(index<options.commands.length&&options.commands[index]!.atTick===completed){
    const scheduled=options.commands[index++]!,result=session.command(copy(scheduled.command));
    results.push({atTick:startTick+completed,command:copy(scheduled.command),result:copy(result)});
    if(!result.ok&&options.stopOnError){reason='command-rejected';break;}
   }
   if(reason==='command-rejected'||completed===options.ticks)break;
   if(observed.status!=='running'){reason='mission-ended';break;}
   const next=options.commands[index]?.atTick??options.ticks;
   session.step(next-completed);observed=session.query();
   const advanced=observed.tick-startTick;
   if(advanced<=completed){reason='clock-stopped';break;}
   completed=advanced;
   if(completed<next){reason='mission-ended';break;}
  }
  const snapshot=session.query();
  return {ok:results.every(entry=>entry.result.ok),requestedTicks:options.ticks,completedTicks:completed,startTick,endTick:snapshot.tick,stopReason:reason,skippedCommands:options.commands.length-index,commands:results,snapshot,checkpoint:session.checkpoint()};
 }
 function run(input:unknown,catalog?:unknown):unknown {
  const options=recipe(input),data=checked(catalog);
  return execute(root.LWRTS.create(data,options.missionId),options);
 }
 function restore(checkpoint:unknown,input:unknown):unknown {
  const options=recipe(input);
  if(options.missionId!==undefined)throw Error('Restored sessions retain their checkpoint mission.');
  if(!root.LWRTS.restore)throw Error('RTS checkpoint restoration is unavailable.');
  return execute(root.LWRTS.restore(parse(checkpoint)),options);
 }
 const api=Object.freeze({
  discover:()=>({format:'wildlands-rts-tools',version:1,operations:['catalog','validate','inspect','run',...(root.LWRTS.restore?['restore']:[])],limits:{documentBytes:maxBytes,ticks:maxTicks,commands:maxCommands},clock:'explicit fixed ticks; reads never advance time',commands:['move','attack','attackMove','stop','patrol','build','gather','return','repair','train','research','cancel','ability','interact','purchase'],denied:['unregistered actions','foreign entity control','out-of-bounds targets','executable content'],schedule:'atTick is relative to the initial checkpoint tick; equal values execute in array order'}),
  catalog:()=>root.LWRTSCatalog.clone(),validate,inspect,run,restore
 });
 root.LWRTSTools=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
