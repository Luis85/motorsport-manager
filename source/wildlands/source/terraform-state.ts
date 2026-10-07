/// <reference path="./terraform-contracts.d.ts" />
/* Strict data boundary; local edits never install global terrain or executable handlers. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWGeography:LWTerraform.Geography;LWWorldContent:LWContentPorts.WorldApi;LWAssets:{item(id:string):{models:Record<string,unknown>}|null};LWTerraformState?:LWTerraform.StateApi};
 const kinds=['wood','fiber','berries','herbs','grain'];
 const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const integer=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
 const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
 function bad(message:string):never{throw Error('Terraform: '+message);}
 function dataOnly(value:unknown):void{
  const ancestors=new Set<object>();let count=0;
  function visit(v:unknown,depth:number):void{
   if(++count>100000||depth>12)bad('data exceeds supported bounds');
   if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
   if(!Array.isArray(v)&&!plain(v))bad('expected JSON data');
   const object=v as object;if(ancestors.has(object)||Object.getOwnPropertySymbols(object).length)bad('invalid JSON data');ancestors.add(object);
   const descriptors=Object.getOwnPropertyDescriptors(object);
   if(Array.isArray(v)){
    if(Object.getPrototypeOf(v)!==Array.prototype||Object.keys(descriptors).length!==v.length+1)bad('expected an ordinary dense list');
    for(let i=0;i<v.length;i++)if(!Object.hasOwn(descriptors,String(i)))bad('expected every own list index');
   }
   for(const [key,d]of Object.entries(descriptors)){
    if(Array.isArray(v)&&key==='length')continue;
    if(d.get||d.set||!d.enumerable||['__proto__','prototype','constructor'].includes(key))bad('invalid data field');visit(d.value,depth+1);
   }
   ancestors.delete(object);
  }
  visit(value,0);
 }
 function fields(v:unknown,allowed:string[],required=allowed):asserts v is Record<string,unknown>{
  if(!plain(v)||Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(v,k)))bad('invalid fields');
 }
 function point(v:Record<string,unknown>,world:LWTerraform.World):void{
  if(!integer(v.x,-1200,1200)||!integer(v.y,-1200,1200)||!root.LWGeography.ownedTile(world,v.x,v.y))bad('choose a tile on an owned island; bridges are protected');
 }
 function tile(v:Record<string,unknown>):void{
  if(v.ground!==undefined&&v.ground!=='grass'&&v.ground!=='water')bad('choose grass or water');
  if(v.height!==undefined&&!integer(v.height,-2,4))bad('height must be a whole step from −2 to 4');
 }
 function choices():LWTerraform.Snapshot['choices']{
  return kinds.flatMap(kind=>{const node=root.LWWorldContent.node(kind),asset=root.LWAssets.item(kind);
   if(!node?.direct||!asset)return [];
   const models=Object.keys(asset.models).filter(m=>m==='world'||m.startsWith('world-'));
   return models.length?[{kind,label:node.name,models}]:[];
  });
 }
 function plant(v:Record<string,unknown>):void{
  if(typeof v.kind!=='string'||typeof v.model!=='string'||!choices().some(c=>c.kind===v.kind&&c.models.includes(String(v.model))))bad('choose an authored tree or plant model');
 }
 const empty=():LWTerraform.State=>({version:1,revision:0,sequence:1,tiles:{},plants:{}});
 function validate(input:unknown,world:LWTerraform.World):LWTerraform.State|undefined{
  if(input===undefined){if(world.nodes.some(n=>n.id.startsWith('terraform-node-')))bad('planted nodes require terrain bindings');return undefined;}dataOnly(input);fields(input,['version','revision','sequence','tiles','plants']);
  if(input.version!==1||!integer(input.revision,0,1e9)||!integer(input.sequence,1,1e9)||!plain(input.tiles)||!plain(input.plants)||Object.keys(input.tiles).length>20000||Object.keys(input.plants).length>20000)bad('invalid bounded state');
  for(const [key,v]of Object.entries(input.tiles)){
   if(!/^-?\d+,-?\d+$/.test(key))bad('invalid tile key');const [x,y]=key.split(',').map(Number);if(key!==x+','+y)bad('noncanonical tile key');
   fields(v,['ground','height']);point({x,y},world);tile(v);
  }
  let highest=0;
  for(const [id,v]of Object.entries(input.plants)){
   fields(v,['kind','model']);plant(v);const match=/^terraform-node-(\d+)$/.exec(id),node=world.nodes.find(n=>n.id===id);
   const definition=root.LWWorldContent.node(String(v.kind));
   if(!match||!node||node.kind!==v.kind||node.max!==definition?.quantity||node.regen!==0)bad('orphaned or incompatible planted resource node');highest=Math.max(highest,Number(match[1]));point({x:node.x,y:node.y},world);
   if(root.LWGeography.terrainAt(world,node.x,node.y)!=='grass')bad('plant needs grass');
  }
  if(input.sequence<=highest)bad('plant sequence would reuse an identity');
  for(const node of world.nodes)if(node.id.startsWith('terraform-node-')&&!Object.hasOwn(input.plants,node.id))bad('planted node has no authored binding');
  return copy(input as unknown as LWTerraform.State);
 }
 function edit(input:unknown,world:LWTerraform.World):LWTerraform.Edit{
  dataOnly(input);fields(input,['revision','tiles','plants']);
  if(!integer(input.revision,0,1e9)||!Array.isArray(input.tiles)||!Array.isArray(input.plants)||input.tiles.length+input.plants.length<1||input.tiles.length+input.plants.length>64)bad('choose one to sixty-four changes');
  const tiles=new Set<string>(),plants=new Set<string>();
  for(const v of input.tiles){fields(v,['x','y','ground','height'],['x','y']);point(v,world);tile(v);if(v.ground===undefined&&v.height===undefined)bad('tile edit is empty');const key=v.x+','+v.y;if(tiles.has(key))bad('duplicate tile edit');tiles.add(key);}
  for(const v of input.plants){fields(v,['x','y','kind','model']);point(v,world);plant(v);const key=v.x+','+v.y;if(plants.has(key))bad('duplicate planting');plants.add(key);}
  return copy(input as unknown as LWTerraform.Edit);
 }
 root.LWTerraformState=Object.freeze({empty,validate,edit,choices,copy});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWTerraformState;
})(globalThis);
