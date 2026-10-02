/* Explicit, additive migrations for reusable scenario packs and saved experience context. */
(function(inputRoot: unknown){
 'use strict';

 type DataRecord=Record<string,unknown>;
 interface SimulationProfile extends DataRecord { id?: string; }
 interface ContentApi { copy<T>(value:T):T; }
 interface ProfilesApi { readonly defaults:SimulationProfile; validate(input:unknown):SimulationProfile; }
 interface ScenarioPack extends DataRecord { schemaVersion?:number; simulation?:unknown; }
 interface ExperienceContext extends DataRecord { schemaVersion?:number; simulation?:unknown; }
 interface PackMigration { pack:ScenarioPack; sourceSchemaVersion:number; migrationNotes:string[]; }
 interface ContextMigration { context:ExperienceContext; sourceContextVersion:number; migrationNotes:string[]; }
 interface ScenarioMigrationsApi {
  readonly CURRENT_PACK:number;
  readonly CURRENT_CONTEXT:number;
  migratePack(input:unknown):PackMigration;
  migrateContext(input:unknown):ContextMigration;
 }
 interface LittlewildRoot {
  LWContent?:ContentApi;
  LWSimulationProfile?:ProfilesApi;
  LWScenarioMigrations?:ScenarioMigrationsApi;
 }
  const root = inputRoot as LittlewildRoot;

 const node=typeof module!=='undefined'&&module.exports;
 const content=(node?require('./content-runtime.js'):root.LWContent) as ContentApi|undefined;
 const profiles=(node?require('./simulation-profile.js'):root.LWSimulationProfile) as ProfilesApi|undefined;
 if(!content||!profiles)throw Error('Scenario migration dependencies are missing.');
 const C:ContentApi=content,Profiles:ProfilesApi=profiles;
 const CURRENT_PACK=2,CURRENT_CONTEXT=2;
 const record=(input:unknown,label:string):DataRecord=>{
  const value=C.copy(input);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+' must be an object.');
  return value as DataRecord;
 };
 function migratePack(input:unknown):PackMigration{
  const pack=record(input,'Scenario pack') as ScenarioPack,source=pack.schemaVersion,notes:string[]=[];
  if(source===1){
   if(Object.hasOwn(pack,'simulation'))throw Error('/simulation: schema version 1 cannot declare a simulation profile; set schemaVersion to 2 after review');
   pack.schemaVersion=2;pack.simulation=C.copy(Profiles.defaults);
   notes.push('Scenario schema 1 migrated to schema 2 with the classic-v1 rule profile and living-world-v1 composition archetype.');
  }else if(source===2){
   if(!Object.hasOwn(pack,'simulation'))throw Error('/simulation: schema version 2 requires an explicit simulation profile');
  }else throw Error('/schemaVersion: unsupported scenario schema version');
  pack.simulation=C.copy(Profiles.validate(pack.simulation));
  return {pack,sourceSchemaVersion:source,migrationNotes:notes};
 }
 function migrateContext(input:unknown):ContextMigration{
  const context=record(input,'Experience context') as ExperienceContext,source=context.schemaVersion??1,notes:string[]=[];
  if(source===1){
   if(Object.hasOwn(context,'simulation'))throw Error('Legacy experience context cannot contain a simulation profile without a context version.');
   context.schemaVersion=2;context.simulation=C.copy(Profiles.defaults);
   notes.push('Portable experience context migrated to version 2 with the classic-v1 compatibility simulation profile.');
  }else if(source===2){
   if(!Object.hasOwn(context,'simulation'))throw Error('Experience context version 2 requires a simulation profile.');
  }else throw Error('Unsupported experience context version.');
  context.simulation=C.copy(Profiles.validate(context.simulation));
  return {context,sourceContextVersion:source,migrationNotes:notes};
 }
 const api:ScenarioMigrationsApi=Object.freeze({CURRENT_PACK,CURRENT_CONTEXT,migratePack,migrateContext});
 root.LWScenarioMigrations=api;
 if(node)module.exports=api;
})(globalThis);
