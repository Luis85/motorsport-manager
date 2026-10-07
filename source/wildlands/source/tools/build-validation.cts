/// <reference path="../rts-contracts.d.ts" />
/// <reference path="../pet-contracts.d.ts" />
/// <reference path="../developer-contracts.d.ts" />
/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Admit canonical defaults and effective shipped packs before publishing a bundle.
 *
 * Without arguments (the build) it validates the bundled games as the transitional installer
 * composes them: the Littlewild game folder with the pending Emberworks/Office packs, and the
 * pending RTS catalog. With `--game DIR` it installs that game folder's own profile in this fresh
 * process (one game per realm) and runs the engine's runtime validators for its template; this is
 * the runtime half of `game-folder.cts` `validateGame`.
 */
import fs from 'node:fs';
import path from 'node:path';
import {auditBalancing} from './balancing-audit.cjs';
import {compileGame, gameDirectory, type CompiledGame} from './game-folder.cjs';
import type {ColonyContent} from './game-manifest.cjs';
const source=path.resolve(__dirname,'../../source');
const read=(file:string):unknown=>JSON.parse(fs.readFileSync(file,'utf8')) as unknown;

/** Runtime validators of a colony game; the realm already has its profile installed. */
function validateColony(game:CompiledGame,profile:LWContentProvider.Profile):void{
 const content=game.manifest.content as ColonyContent;
 const api=require('../developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};
 const scenarios=require('../scenario-runtime.js') as LWContentPorts.ScenarioApi;
 if(content.skillTree)(require('../skill-trees.js') as LWSkillTrees.Api).validate(read(path.join(game.root,content.skillTree)));
 // Adventure examples are reference documents written against the item set of their time: an added
 // item makes a complete example library stale without making the game invalid, so they are parsed
 // (game-folder.cts) but not admitted here, exactly as the build never admitted them before.
 const interactions=api.toolbox.validateInteractionLibrary(read(path.join(game.root,content.interactions)));
 if(!interactions.ok)throw Error('Interaction catalog: '+interactions.errors.join('; '));
 const balance=api.toolbox.balancing.validate(profile.balancing);if(!balance.ok)throw Error('Canonical balancing defaults: '+balance.errors.map(error=>error.path+': '+error.message).join('; '));
 for(const pack of scenarios.builtins()){
  const result=api.toolbox.validateScenario(pack);if(!result.ok)throw Error('Shipped scenario '+pack.id+': '+result.errors.join('; '));
 }
 const audit=auditBalancing(source,profile.balancing);if(audit.length)throw Error('Canonical balancing consumption: '+audit.join('; '));
}
function validateBundledDefaults():void {
 // developer-sdk installs the transitional Littlewild profile (folder + pending colony packs).
 const api=require('../developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};void api;
 const provider=require('../content-provider.js') as LWContentProvider.Api;
 validateColony(compileGame(gameDirectory('littlewild')),provider.get('bundled defaults'));
 const rts=require('../rts-catalog.js') as LWRTSData.CatalogApi;
 rts.validate(read(path.join(source,'content/rts-demo.json')));
}
/** Validate one game folder with its own installed profile. */
function validateGameFolder(directory:string):void{
 const game=compileGame(directory),provider=require('../content-provider.js') as LWContentProvider.Api;
 const profile=provider.install(game.profile);
 if(game.manifest.template==='colony')validateColony(game,profile);
 else if(game.manifest.template==='rts')(require('../rts-catalog.js') as LWRTSData.CatalogApi).validate(profile.rts);
 else (require('../pet-catalog.js') as LWPetData.CatalogApi).validate(profile.pet?.definitions);
}
if(require.main===module){
 try{
  const args=process.argv.slice(2);
  if(args.length===2&&args[0]==='--game')validateGameFolder(path.resolve(args[1]!));
  else if(args.length)throw Error('Usage: build-validation.cjs [--game DIR]');
  else validateBundledDefaults();
 }catch(error){process.stderr.write((error instanceof Error?error.message:String(error))+'\n');process.exitCode=1;}
}
export {validateBundledDefaults,validateGameFolder};
