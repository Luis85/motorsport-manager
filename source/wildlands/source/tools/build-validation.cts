/// <reference path="../rts-contracts.d.ts" />
/// <reference path="../pet-contracts.d.ts" />
/// <reference path="../developer-contracts.d.ts" />
/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Admit canonical defaults and effective shipped packs before publishing a bundle.
 *
 * Without arguments (the build) it validates the bundled games as the transitional installers
 * compose them: the Littlewild game folder with the Emberworks and Office folders' packs, and the
 * RTS Frontier and Pocket Pet folders' catalogs. With `--game DIR` it installs that game folder's own profile in this fresh
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

/**
 * The scenario pack a game's balancing defaults define, assembled as `defaultScenario` assembles a
 * canonical pack: the template fields of the game's default pack (identity, presentation, tutorial)
 * with the balancing libraries, simulation, starting scenes and default world.
 */
function defaultsPack(profile:LWContentProvider.Profile):unknown{
 const scenarios=profile.scenarios!,template=(scenarios.packs as Record<string,unknown>[]).find(pack=>pack.id===scenarios.defaultId)!;
 const balance=profile.balancing as {libraries:unknown;simulation:unknown;startingScenes:unknown;world:unknown};
 const shell=Object.fromEntries(['format','schemaVersion','id','version','name','description','presentation','tutorial'].filter(key=>Object.hasOwn(template,key)).map(key=>[key,template[key]]));
 return {...shell,libraries:balance.libraries,simulation:balance.simulation,scenes:balance.startingScenes,worlds:[balance.world]};
}
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
 // A canonical pack inherits the balancing defaults and is their baseline. Without one (every pack is
 // complete), the defaults are checked as the pack they define: libraries, simulation, starting scenes
 // and default world in an otherwise empty shell, the same values a canonical pack would inherit.
 const balance=api.toolbox.balancing.validate(profile.balancing,...profile.scenarios?.canonicalId===undefined?[defaultsPack(profile)]:[]);if(!balance.ok)throw Error('Canonical balancing defaults: '+balance.errors.map(error=>error.path+': '+error.message).join('; '));
 for(const pack of scenarios.builtins()){
  const result=api.toolbox.validateScenario(pack);if(!result.ok)throw Error('Shipped scenario '+pack.id+': '+result.errors.join('; '));
 }
 const audit=auditBalancing(source,profile.balancing);if(audit.length)throw Error('Canonical balancing consumption: '+audit.join('; '));
}
function validateBundledDefaults():void {
 // developer-sdk installs the transitional Littlewild profile (Littlewild folder + Emberworks/Office packs).
 const api=require('../developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};void api;
 const provider=require('../content-provider.js') as LWContentProvider.Api;
 validateColony(compileGame(gameDirectory('littlewild')),provider.get('bundled defaults'));
 (require('../rts-catalog.js') as LWRTSData.CatalogApi).validate(compileGame(gameDirectory('rts-frontier')).profile.rts);
 (require('../pet-catalog.js') as LWPetData.CatalogApi).validate(compileGame(gameDirectory('pocket-pet')).profile.pet?.definitions);
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
