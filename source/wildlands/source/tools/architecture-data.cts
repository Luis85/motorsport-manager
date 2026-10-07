/** Compiled validator capabilities and plain-data ownership checks, shared by policy/tests. */
export const validatorRoles=Object.freeze({
 gameFolder:'tools/game-folder.cts:loadGame',definitionSource:'tools/definition-source.cts:definitions',balancingSource:'tools/bundled-content.cts:balancingDocument',defaultScenarioSource:'tools/bundled-content.cts:defaultScenario',
 skillTrees:'skill-trees.ts:validate',rts:'rts-catalog.ts:validate',pet:'pet-catalog.ts:validate',balancing:'balancing-tools.ts:validate',balancingInventory:'balancing-inventory.ts:validate',
 base:'content-runtime.ts:Registry.prepare',adventure:'adventure-content.ts:validate',world:'world-content.ts:validate',
 growth:'growth-content.ts:validate',scenario:'scenario-runtime.ts:validate',simulation:'simulation-profile.ts:validate',
 actorRules:'actor-ecs.ts:validateRules',economyRules:'economy-ecs.ts:validateRules',
 geography:'scenario-runtime.ts:checkWorld',assets:'asset-catalog.ts:validate',creatures:'creature-catalog.ts:validate',
 creatureCatalog:'creature-catalog.ts:prepare',interactions:'interaction-catalog.ts:validate',
 creatureEditorFields:'creature-editor-fields.ts:validate',interiors:'building-interior-catalog.ts:validate',schema:'verification/schema-checks.ts:makeValidator'
});
export interface DataOwner {id:string;pattern:string;owner:string;kind:'definitions'|'rules'|'scenario'|'schema';validatorRole:keyof typeof validatorRoles;embeddedGlobal?:string;}
export interface DataManifest {format:string;schemaVersion:number;entries:DataOwner[];historicalFixtures:{path:string;reason:string}[];}
export function matches(pattern:string,file:string):boolean{
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
  if(!/^(?:content\/|assets\/|schemas\/|games\/[a-z0-9*-]+\/)[a-z0-9_.*\/-]+\.json$/.test(entry.pattern)||entry.pattern.includes('..'))errors.push('Invalid shipped data pattern: '+entry.pattern);
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
/** Closed engine data allow-list (architecture/engine-data.json). */
export interface EngineDataEntry {pattern:string;reason:string;game?:string;}
export interface EngineDataManifest {format:string;schemaVersion:number;description:string;engine:EngineDataEntry[];pending:EngineDataEntry[];}
/** Game data shapes that never belong to the engine allow-list (they live in a game folder or are pending). */
const GAME_SHAPED=/(?:^|\/)(?:definition\.json|[^/]*\.pack\.json|balancing\.json|catalog\.json|editor-fields\.json|skill-tree\.json|game\.json)$/;
export function engineDataErrors(manifest:EngineDataManifest,files:readonly string[],games:readonly string[]):string[]{
 const errors:string[]=[];
 if(manifest.format!=='wildlands-engine-data'||manifest.schemaVersion!==1)errors.push('Invalid engine data allow-list identity.');
 const entries=[...manifest.engine.map(entry=>({...entry,scope:'engine'})),...manifest.pending.map(entry=>({...entry,scope:'pending'}))];
 for(const entry of entries){
  if(!/^(?:content|assets|schemas)\/[A-Za-z0-9_.*\/-]+$/.test(entry.pattern)||entry.pattern.includes('..'))errors.push('Invalid engine data pattern: '+entry.pattern);
  if(typeof entry.reason!=='string'||entry.reason.trim().length<40)errors.push('Engine data entry needs a concrete reason: '+entry.pattern);
  if(entry.scope==='engine'&&(entry.game!==undefined||GAME_SHAPED.test(entry.pattern)))errors.push('Engine entry has a game data shape; move it to a game folder or list it as pending: '+entry.pattern);
  if(entry.scope==='pending'&&!games.includes(entry.game??''))errors.push('Pending engine data names an unknown game: '+entry.pattern);
  if(!files.some(file=>matches(entry.pattern,file)))errors.push('Engine data entry matches no file (remove it): '+entry.pattern);
 }
 for(const file of files){
  const count=entries.filter(entry=>matches(entry.pattern,file)).length;
  if(count!==1)errors.push(file+' has '+count+' engine data entries; game data belongs in docs/concepts/<game>/.');
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
