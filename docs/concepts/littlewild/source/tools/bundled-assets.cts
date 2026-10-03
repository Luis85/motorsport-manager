/** Filesystem discovery shared by the standalone build and creature extensibility regressions. */
import fs from 'node:fs';
import path from 'node:path';

type Manifest=Record<string,unknown>;
const read=(file:string):Manifest=>JSON.parse(fs.readFileSync(file,'utf8')) as Manifest;
const folders=(directory:string):string[]=>fs.readdirSync(directory,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
const compare=(a:string,b:string):number=>a<b?-1:a>b?1:0;

export function creatureConfig(source:string):Manifest {
 const config=read(path.join(source,'assets','creatures','catalog.json'));
 if(!config||Object.keys(config).length!==3||config.format!=='littlewild-creature-catalog'||config.schemaVersion!==1||typeof config.defaultArchetype!=='string'||!/^[a-z][a-z0-9_-]{0,60}$/.test(config.defaultArchetype))throw Error('Invalid creature catalog configuration.');
 if(!creatureDefinitions(source).some(definition=>definition.id===config.defaultArchetype))throw Error('Unknown default creature archetype: '+config.defaultArchetype);
 return config;
}
export function creatureDefinitions(source:string):Manifest[] {
 const directory=path.join(source,'assets','creatures'),definitions:Manifest[]=[];
 for(const id of folders(directory)){
  const file=path.join(directory,id,'creature.json');
  if(!fs.existsSync(file))throw Error('Creature folder is missing creature.json: '+id);
  const definition=read(file);
  if(definition.format!=='littlewild-creature'||definition.schemaVersion!==1||definition.id!==id)throw Error('Creature identity/path mismatch: '+id);
  definitions.push(definition);
 }
 if(!definitions.length)throw Error('At least one creature definition is required.');
 return definitions;
}
export function assetDefinitions(source:string):Manifest[] {
 const directory=path.join(source,'assets'),definitions:Manifest[]=[];
 const categories:Readonly<Record<string,string>>={buildings:'building',items:'item',creatures:'actor'};
 for(const family of folders(directory)){
  if(family==='interactions')continue; // Data interactions are compiled separately from visual assets.
  const category=categories[family];
  if(!category)throw Error('Unknown asset family: '+family);
  for(const id of folders(path.join(directory,family))){
   const file=path.join(directory,family,id,'asset.json');
   if(!fs.existsSync(file))throw Error('Asset folder is missing asset.json: '+family+'/'+id);
   const definition=read(file);
   if(definition.format!=='littlewild-3d-asset'||definition.schemaVersion!==1||definition.category!==category||definition.id!==id)throw Error('Asset identity/path mismatch: '+family+'/'+id);
   definitions.push(definition);
  }
 }
 const creatures=creatureDefinitions(source),assets=new Map(definitions.filter(definition=>definition.category==='actor').map(definition=>[definition.id,definition]));
 for(const creature of creatures){
  const asset=assets.get(creature.visualAsset),behaviors=asset?.behaviors as Manifest|undefined,appearances=behaviors?.appearances as Manifest|undefined;
  if(!asset||!Array.isArray(creature.personalities)||creature.personalities.some(personality=>typeof personality!=='string'||!appearances||!Object.hasOwn(appearances,personality)))throw Error('Creature visual asset/profile missing: '+String(creature.id));
 }
 return definitions.sort((a,b)=>compare(String(a.category)+':'+String(a.id),String(b.category)+':'+String(b.id)));
}
