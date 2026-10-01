/* Explicit, additive migrations for reusable scenario packs and saved experience context. */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const C=node?require('./content-runtime.js'):root.LWContent;
 const Profiles=node?require('./simulation-profile.js'):root.LWSimulationProfile;
 const CURRENT_PACK=2,CURRENT_CONTEXT=2;
 function migratePack(input){
  const pack=C.copy(input),source=pack?.schemaVersion,notes=[];
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
 function migrateContext(input){
  const context=C.copy(input),source=context?.schemaVersion??1,notes=[];
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
 const api=Object.freeze({CURRENT_PACK,CURRENT_CONTEXT,migratePack,migrateContext});
 root.LWScenarioMigrations=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
