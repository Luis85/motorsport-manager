/// <reference path="./skill-tree-contracts.d.ts" />
/* Pure skill-tree rules. Inputs and outputs are detached; callers own publication. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWSkillTrees?:LWSkillTrees.Api};
 type RecordValue=Record<string,unknown>;
 const effects=['workSpeed','learningSpeed'] as const;
 const MAX_XP=1_000_000_000;
 function record(input:unknown,keys:readonly string[]):RecordValue{
  if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype||Object.getOwnPropertySymbols(input).length)throw Error('Skill trees require ordinary data records.');
  const fields=Object.getOwnPropertyDescriptors(input);
  if(Object.keys(fields).some(key=>!keys.includes(key))||Object.values(fields).some(field=>!field.enumerable||field.get||field.set))throw Error('Unknown or non-data skill-tree field.');
  return input as RecordValue;
 }
 function list(input:unknown,max:number):unknown[]{
  if(!Array.isArray(input)||input.length>max||Object.getOwnPropertySymbols(input).length)throw Error('Invalid skill-tree list.');
  if(Object.getOwnPropertyNames(input).length!==input.length+1)throw Error('Invalid skill-tree list fields.');
  for(let i=0;i<input.length;i++){
   const field=Object.getOwnPropertyDescriptor(input,String(i));
   if(!field||field.get||field.set||!field.enumerable)throw Error('Skill-tree lists require ordinary data values.');
  }
  return input;
 }
 function integer(input:unknown,min:number,max:number):number{
  if(typeof input!=='number'||!Number.isSafeInteger(input)||input<min||input>max)throw Error('Skill-tree number is outside its supported range.');
  return input;
 }
 function text(input:unknown,max=240):string{
  if(typeof input!=='string'||!input.trim()||input.length>max)throw Error('Invalid skill-tree text.');
  return input;
 }
 function id(input:unknown):string{
  const value=text(input,64);
  if(!/^[a-z][a-z0-9._-]*$/.test(value)||['constructor','prototype','__proto__'].includes(value))throw Error('Invalid skill-tree identity.');
  return value;
 }
 function validate(input:unknown):LWSkillTrees.Definition{
  const data=record(input,['version','id','name','description','xpPerPoint','nodes']);
  if(data.version!==1)throw Error('Unsupported skill-tree version.');
  const nodes=list(data.nodes,64).map(input=>{
   const n=record(input,['id','name','description','cost','maxRank','minimumLevel','requires','exclusiveGroup','effects']);
   const values=record(n.effects,effects),out:Partial<Record<LWSkillTrees.Effect,number>>={};
   for(const key of effects)if(Object.hasOwn(values,key)){
    const value=values[key];if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>.25)throw Error('Skill-tree effects must be positive bonuses up to 25% per rank.');out[key]=value;
   }
   const requires=list(n.requires,16).map(input=>{const r=record(input,['nodeId','rank']);return {nodeId:id(r.nodeId),rank:integer(r.rank,1,5)};});
   if(new Set(requires.map(r=>r.nodeId)).size!==requires.length)throw Error('Duplicate skill-tree prerequisite.');
   return {id:id(n.id),name:text(n.name,80),description:text(n.description),cost:integer(n.cost,1,100),maxRank:integer(n.maxRank,1,5),minimumLevel:integer(n.minimumLevel,1,1000),requires,effects:out,...(n.exclusiveGroup===undefined?{}:{exclusiveGroup:id(n.exclusiveGroup)})};
  });
  if(!nodes.length||new Set(nodes.map(n=>n.id)).size!==nodes.length)throw Error('Skill-tree nodes need unique identities.');
  const byId=new Map(nodes.map(n=>[n.id,n])),visited=new Set<string>(),active=new Set<string>();
  function visit(node:LWSkillTrees.Node):void{
   if(active.has(node.id))throw Error('Skill-tree prerequisites contain a cycle.');
   if(visited.has(node.id))return;active.add(node.id);
   for(const r of node.requires){const parent=byId.get(r.nodeId);if(!parent||r.rank>parent.maxRank)throw Error('Unknown or impossible skill-tree prerequisite.');visit(parent);}
   active.delete(node.id);visited.add(node.id);
  }
  for(const node of nodes)visit(node);
  return {version:1,id:id(data.id),name:text(data.name,80),description:text(data.description),xpPerPoint:integer(data.xpPerPoint,1,1_000_000),nodes};
 }
 const spent=(progress:LWSkillTrees.Progress):number=>progress.definition.nodes.reduce((sum,node)=>sum+(progress.ranks[node.id]??0)*node.cost,0);
 function validateProgress(input:unknown,level?:number):LWSkillTrees.Progress[]{
  const values=list(input===undefined?[]:input,8).map(input=>{
   const data=record(input,['definition','xp','ranks']),definition=validate(data.definition),xp=integer(data.xp,0,MAX_XP);
   const raw=record(data.ranks,definition.nodes.map(n=>n.id)),ranks:Record<string,number>={};
   for(const node of definition.nodes)if(Object.hasOwn(raw,node.id))ranks[node.id]=integer(raw[node.id],1,node.maxRank);
   const progress={definition,xp,ranks},groups=new Set<string>();
   for(const node of definition.nodes)if(ranks[node.id]){
    if(node.requires.some(r=>(ranks[r.nodeId]??0)<r.rank))throw Error('Saved skill-tree rank is missing prerequisites.');
    if(level!==undefined&&node.minimumLevel>level)throw Error('Saved skill-tree rank exceeds the owner level.');
    if(node.exclusiveGroup){if(groups.has(node.exclusiveGroup))throw Error('Saved skill-tree choices conflict.');groups.add(node.exclusiveGroup);}
   }
   if(spent(progress)>Math.floor(xp/definition.xpPerPoint))throw Error('Saved skill-tree points exceed earned points.');
   return progress;
  });
  if(new Set(values.map(p=>p.definition.id)).size!==values.length)throw Error('Duplicate attached skill tree.');
  return values;
 }
 function attach(input:unknown,definition:unknown):LWSkillTrees.Progress[]{
  const values=validateProgress(input),data=validate(definition);
  if(values.length===8||values.some(p=>p.definition.id===data.id))throw Error('This skill tree is already attached or the owner has eight trees.');
  return [...values,{definition:data,xp:0,ranks:{}}];
 }
 function award(input:unknown,amount:number):LWSkillTrees.Progress[]{
  integer(amount,0,MAX_XP);
  return validateProgress(input).map(p=>({...p,xp:Math.min(MAX_XP,p.xp+amount)}));
 }
 function reason(progress:LWSkillTrees.Progress,node:LWSkillTrees.Node,level:number):string|null{
  if((progress.ranks[node.id]??0)>=node.maxRank)return 'Fully learned.';
  if(level<node.minimumLevel)return 'Reach level '+node.minimumLevel+'.';
  const missing=node.requires.filter(r=>(progress.ranks[r.nodeId]??0)<r.rank);
  if(missing.length)return 'First learn '+missing.map(r=>progress.definition.nodes.find(n=>n.id===r.nodeId)!.name+' rank '+r.rank).join(' and ')+'.';
  if(node.exclusiveGroup&&progress.definition.nodes.some(n=>n.id!==node.id&&n.exclusiveGroup===node.exclusiveGroup&&progress.ranks[n.id]))return 'Another path in this branch is already chosen.';
  if(Math.floor(progress.xp/progress.definition.xpPerPoint)-spent(progress)<node.cost)return 'Earn '+node.cost+' available skill '+(node.cost===1?'point.':'points.');
  return null;
 }
 function unlock(input:unknown,treeId:string,nodeId:string,level:number):LWSkillTrees.Progress[]{
  integer(level,1,1000);const values=validateProgress(input,level),progress=values.find(p=>p.definition.id===treeId),node=progress?.definition.nodes.find(n=>n.id===nodeId);
  if(!progress||!node)throw Error('Unknown attached skill-tree node.');
  const issue=reason(progress,node,level);if(issue)throw Error(issue);
  progress.ranks[node.id]=(progress.ranks[node.id]??0)+1;return values;
 }
 function inspect(input:unknown,level:number):LWSkillTrees.View[]{
  integer(level,1,1000);
  return validateProgress(input,level).map(p=>({id:p.definition.id,name:p.definition.name,description:p.definition.description,xp:p.xp,xpPerPoint:p.definition.xpPerPoint,points:Math.floor(p.xp/p.definition.xpPerPoint)-spent(p),spent:spent(p),nodes:p.definition.nodes.map(n=>({...n,rank:p.ranks[n.id]??0,reason:reason(p,n,level)}))}));
 }
 function bonus(input:unknown,effect:LWSkillTrees.Effect):number{
  return Math.min(1,validateProgress(input).reduce((sum,p)=>sum+p.definition.nodes.reduce((n,node)=>n+(p.ranks[node.id]??0)*(node.effects[effect]??0),0),0));
 }
 const api:LWSkillTrees.Api=Object.freeze({validate,validateProgress,attach,award,unlock,inspect,bonus});
 root.LWSkillTrees=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
