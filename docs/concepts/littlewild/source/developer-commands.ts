/// <reference path="./developer-contracts.d.ts" />
/* Developer argument contracts refine the central router without duplicating gameplay rules. */
(function(inputRoot:unknown){
 'use strict';
 type Command=LittlewildDeveloper.Command;
 interface DataApi {record(value:unknown):LittlewildDeveloper.Document;text(value:unknown,label:string):string;DeveloperError:new(code:LittlewildDeveloper.ErrorCode,message:string)=>LittlewildDeveloper.DeveloperError;}
 const root=inputRoot as {LWDeveloperData:DataApi;LWDeveloperCommands?:unknown};
 const D=root.LWDeveloperData;
 const contracts:Readonly<Record<LittlewildDeveloper.CommandId,readonly [number,string]>>={
  'seek-duel':[1,'sSS'],'cancel-duel-seek':[1,'s'],'stage-duel':[3,'sss'],'set-game-settings':[1,'j'],
  'request-interaction':[3,'ssj'],'respond-interaction':[2,'sb'],
  'cancel-interaction':[1,'s'],'set-interaction-library':[1,'j'],
  'select-creature':[1,'s'],'care':[1,'s'],'research-skill':[1,'s'],'teach-skill':[1,'s'],
  'practice-skill':[1,'sn'],'cancel-lesson':[1,'s'],'set-learning-style':[1,'s'],
  'pause-learning':[0,''],'choose-specialization':[2,'ss'],'start-study':[1,'s'],'pause-study':[0,''],
  'set-allowance':[1,'n'],'top-up':[0,''],'set-stock-target':[2,'sn'],
  'place-building':[3,'snn'],'upgrade-building':[1,'s'],'request-task':[1,'sSN'],
  'cancel-plan':[1,'s'],'pause-plan':[1,'s'],'prioritize-plan':[1,'s'],
  'request-equipment':[1,'s'],'unequip':[1,'s'],'cancel-equipment':[1,'s'],
  'accept-quest':[1,'s'],'cancel-quest-plan':[0,''],'abort-quest':[0,''],
  'suggest-social':[1,'s'],'request-unpack':[0,''],'spend-point':[1,'s'],
  'research-feature':[1,'s'],'configure-building':[2,'ssj'],'assign-home':[2,'ss'],
  'buy-island':[2,'nn'],'unlock-slot':[0,''],'create-sale':[2,'snS'],'control-sale':[2,'ssj']
 };
 function fail(message:string):never{throw new D.DeveloperError('invalid-input',message);}
 function validate(input:unknown,scope:'world'|'actor'):Command {
  const envelope=D.record(input);
  if(Object.keys(envelope).some(key=>!['id','actorId','args'].includes(key)))fail('Command has unknown fields.');
  const id=D.text(envelope.id,'Command ID');
  if(!Object.hasOwn(contracts,id))fail('Unknown command: '+id+'. Use toolbox.commands().');
  const contract=contracts[id as LittlewildDeveloper.CommandId];
  const args=envelope.args;
  if(!Array.isArray(args)||args.length<contract[0]||args.length>contract[1].length)fail(id+' has invalid argument count.');
  for(let index=0;index<args.length;index++){
   const value=args[index],type=contract[1][index];
   if(type==='s'||type==='S'){
    if(type==='S'&&value===null)continue;
    D.text(value,id+' argument '+index);
   }else if(type==='n'||type==='N'){
    if(type==='N'&&value===null)continue;
    if(typeof value!=='number'||!Number.isFinite(value))fail(id+' argument '+index+' must be finite.');
   }else if(type==='b'&&typeof value!=='boolean')fail(id+' argument '+index+' must be Boolean.');
  }
  if(scope==='actor'){
   const actorId=D.text(envelope.actorId,'Actor ID');
   if(!/^c[1-9][0-9]*$/.test(actorId))fail('Actor ID must be a stable c1, c2, … identity.');
  }else if(envelope.actorId!==undefined)fail(id+' does not accept actorId.');
  if(id==='request-interaction'){
   const target=D.record(args[2]);
   if(Object.keys(target).length!==2||!Object.hasOwn(target,'scope')||!Object.hasOwn(target,'id')||!['creature','building','node'].includes(String(target.scope)))fail('Expected an interaction target {scope, id}.');
   D.text(target.id,'Interaction target ID');
  }
  if(id==='set-game-settings'){
   const patch=D.record(args[0]);
   if(Object.entries(patch).some(([key,value])=>!['duels','quests'].includes(key)||typeof value!=='boolean'))fail('Game settings require duels/quests Boolean fields.');
  }
  if(id==='set-interaction-library')D.record(args[0]);
  if(id==='configure-building'){
   const action=args[1],value=args[2];
   if(['flush','reclaim','clear'].includes(String(action))){if(args.length!==2)fail('This building action takes no value.');}
   else if(action==='enabled'){if(args.length!==3||typeof value!=='boolean')fail('enabled requires a Boolean value.');}
   else if(action==='priority'){if(args.length!==3||!Number.isInteger(value)||Number(value)<0||Number(value)>2)fail('priority requires 0, 1 or 2.');}
   else if(action==='batch'||action==='target'){
    const recipe=D.record(value);
    if(Object.keys(recipe).length!==2||!Object.hasOwn(recipe,'recipe')||!Object.hasOwn(recipe,'amount'))fail('Expected {recipe, amount}.');
    D.text(recipe.recipe,'Recipe ID');
    if(!Number.isInteger(recipe.amount)||Number(recipe.amount)<(action==='batch'?1:0)||Number(recipe.amount)>(action==='batch'?12:48))fail('Recipe quantity is outside the supported range.');
   }else fail('Unknown building action.');
  }
  if(id==='control-sale'){
   const action=args[1],value=args[2];
   if(['cancel','pause','stop','resume'].includes(String(action))){if(args.length!==2)fail('This sale action takes no value.');}
   else if(action==='priority'){if(args.length!==3||!Number.isInteger(value)||Number(value)<0||Number(value)>2)fail('priority requires 0, 1 or 2.');}
   else if(action==='assign'){if(args.length!==3||(value!==null&&typeof value!=='string'))fail('assign requires an actor ID or null.');}
   else fail('Unknown sale action.');
  }
  return envelope as unknown as Command;
 }
 const api=Object.freeze({validate});root.LWDeveloperCommands=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
