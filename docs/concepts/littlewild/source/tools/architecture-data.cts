/** Compiled validator capabilities and plain-data ownership checks, shared by policy/tests. */
export const validatorRoles=Object.freeze({
 skillTrees:'skill-trees.ts:validate',rts:'rts-catalog.ts:validate',balancing:'balancing-tools.ts:validate',balancingInventory:'balancing-inventory.ts:validate',
 base:'content-runtime.ts:Registry.prepare',adventure:'adventure-content.ts:validate',world:'world-content.ts:validate',
 growth:'growth-content.ts:validate',scenario:'scenario-runtime.ts:validate',simulation:'simulation-profile.ts:validate',
 actorRules:'actor-ecs.ts:validateRules',economyRules:'economy-ecs.ts:validateRules',
 geography:'scenario-runtime.ts:checkWorld',assets:'asset-catalog.ts:validate',creatures:'creature-catalog.ts:validate',
 creatureCatalog:'creature-catalog.ts:prepare',interactions:'interaction-catalog.ts:validate',
 creatureEditorFields:'creature-editor-fields.ts:validate',interiors:'building-interior-catalog.ts:validate',schema:'verification/schema-checks.ts:makeValidator'
});
export interface DataOwner {id:string;pattern:string;owner:string;kind:'definitions'|'rules'|'scenario'|'schema';validatorRole:keyof typeof validatorRoles;embeddedGlobal?:string;}
export interface DataManifest {format:string;schemaVersion:number;entries:DataOwner[];historicalFixtures:{path:string;reason:string}[];}
function matches(pattern:string,file:string):boolean{
 const expression=pattern.split('**').map(part=>part.split('*').map(value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^/]*')).join('.*');
 return new RegExp('^'+expression+'$').test(file);
}
export function ownershipErrors(manifest:DataManifest,files:readonly string[],owners:ReadonlySet<string>):string[]{
 const errors:string[]=[],ids=new Set<string>();
 if(manifest.format!=='littlewild-data-ownership'||manifest.schemaVersion!==1)errors.push('Invalid data ownership identity.');
 for(const entry of manifest.entries){
  if(ids.has(entry.id))errors.push('Duplicate data ownership ID: '+entry.id);ids.add(entry.id);
  if(!owners.has(entry.owner))errors.push('Unknown data owner: '+entry.owner);
  if(!Object.hasOwn(validatorRoles,entry.validatorRole))errors.push('Unknown validator role: '+entry.validatorRole);
  if(!['definitions','rules','scenario','schema'].includes(entry.kind))errors.push('Unknown data kind: '+entry.kind);
  if(!/^(?:content|assets)\/[a-z0-9_.*\/-]+\.json$/.test(entry.pattern)||entry.pattern.includes('..'))errors.push('Invalid shipped data pattern: '+entry.pattern);
  if(!files.some(file=>matches(entry.pattern,file)))errors.push('Data owner has no shipped files: '+entry.id);
 }
 for(const file of files){const count=manifest.entries.filter(entry=>matches(entry.pattern,file)).length;if(count!==1)errors.push(file+' has '+count+' data owners.');}
 const fixturePaths=new Set<string>();
 for(const fixture of manifest.historicalFixtures){
  if(!/^fixtures\/[a-z0-9_./-]+\.json$/.test(fixture.path)||fixture.path.includes('..')||fixture.reason.trim().length<20)errors.push('Invalid historical fixture exclusion: '+fixture.path);
  if(fixturePaths.has(fixture.path))errors.push('Duplicate historical fixture exclusion: '+fixture.path);fixturePaths.add(fixture.path);
 }
 return errors;
}
const executableFields=new Set(['script','callback','execute','eval','sourceCode','modulePath','module','onLoad','onTick','functionBody']);
export function executableDataErrors(value:unknown,location:string):string[]{
 const errors:string[]=[];
 function visit(input:unknown,where:string):void{
  if(Array.isArray(input))input.forEach((entry,index)=>visit(entry,where+'/'+index));
  else if(input&&typeof input==='object')for(const [key,entry]of Object.entries(input)){
   if(executableFields.has(key))errors.push(where+'/'+key);visit(entry,where+'/'+key);
  }
 }
 visit(value,location);return errors;
}
