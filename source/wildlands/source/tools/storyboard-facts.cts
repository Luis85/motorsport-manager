/** Bounded summaries describe supplied JSON, never claim runtime validation or inferred design intent. */
export interface Fact {label:string;value:string;}
export const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const rows=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const count=(value:unknown):number|undefined=>Array.isArray(value)?value.length:value&&typeof value==='object'?Object.keys(value).length:undefined;
const display=(value:unknown):string=>typeof value==='string'||typeof value==='number'||typeof value==='boolean'?String(value):'';
export function facts(input:unknown):{kind:string;facts:Fact[]} {
 const doc=record(input),kind=display(doc.format)||display(doc.kind)||'generic-json',out:Fact[]=[];
 const add=(label:string,value:unknown):void=>{const text=display(value);if(text)out.push({label,value:text.slice(0,800)});};
 add('Format',kind);add('Schema version',doc.schemaVersion);add('ID',doc.id);add('Name',doc.name);
 switch(kind){
  case 'wildlands-project':{
   const pack=record(doc.pack);add('Project scene',doc.sceneId);add('Scenario',doc.scenarioId);add('Game',record(doc.game).id);add('Scenes',count(pack.scenes));
   const archetypes=record(record(pack.resources).creatures).definitions??record(record(record(doc.game).profile).creatures).definitions;
   add('Worlds',count(pack.worlds));add('Archetypes',count(archetypes));
   for(const scene of rows(pack.scenes).slice(0,12)){const row=record(scene);add('Scene '+display(row.id),row.name);}
   break;
  }
  case 'littlewild-character':{const identity=record(doc.identity),appearance=record(doc.appearance);add('Name',identity.name);add('Personality',doc.personality);add('Preset',appearance.preset);add('Body',appearance.body);add('Coat',appearance.coat);add('Status',doc.status);break;}
  case 'littlewild-creature-package':{const definition=record(doc.gameplayDefinition),appearance=record(doc.appearanceManifest);add('Archetype',definition.id);add('Name',definition.name);add('Visual',appearance.id);add('Variants',count(appearance.models));add('Asset references',count(doc.assetReferences));add('Selected companion',record(doc.selectedInstance).id);break;}
  case 'littlewild-definition':{const visual=record(doc.visual);add('Family',doc.family);add('Visual',visual.id);add('Variants',count(visual.models));add('Materials',count(visual.materials));break;}
  case 'littlewild-3d-asset':add('Category',doc.category);add('Variants',count(doc.models));add('Materials',count(doc.materials));add('Baked meshes',count(doc.meshes));break;
  case 'scene-bundle':add('Models',count(doc.models));add('Nodes',count(record(doc.scene).nodes));break;
  case 'model-bundle':add('Entry model',doc.entry);add('Models',count(doc.models));break;
  case 'scene':case 'model':add('Nodes',count(doc.nodes));add('Materials',count(doc.materials));add('Geometries',count(doc.geometries));break;
  case 'character-studio-review':add('Character',doc.characterId);add('Recipe hash (reported)',doc.recipeHash);add('Visual hash (reported)',doc.visualHash);add('Compiler revision',doc.compilerRevision);add('Frames',count(doc.frames));break;
  case 'review-result':add('Scene',doc.scene);add('Source state (reported)',doc.sourceStateHash);add('Render state (reported)',doc.renderStateHash);add('Frames',count(doc.frames));break;
  default:add('Root type',Array.isArray(input)?'array':input===null?'null':typeof input);if(Array.isArray(input))add('Items',input.length);else add('Fields',Object.keys(doc).slice(0,24).join(', '));
 }
 return {kind,facts:out};
}
