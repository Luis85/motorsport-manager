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
 * the runtime half of `game-folder.cts` `validateGame`. The validators themselves are
 * tools/game-admission.cts, shared with the engine distributions' game builds.
 */
import path from 'node:path';
import {auditBalancing} from './balancing-audit.cjs';
import {compileGame, gameDirectory} from './game-folder.cjs';
import {admitColony, admitGameProfile, admitTemplate, type BalancingAudit} from './game-admission.cjs';
const source=path.resolve(__dirname,'../../source');
/** A checkout audits balancing consumption against the authored engine sources. */
const audit:BalancingAudit=balancing=>auditBalancing(source,balancing);

function validateBundledDefaults():void {
 // developer-sdk installs the transitional Littlewild profile (Littlewild folder + Emberworks/Office packs).
 const api=require('../developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};void api;
 const provider=require('../content-provider.js') as LWContentProvider.Api;
 admitColony(compileGame(gameDirectory('littlewild')),provider.get('bundled defaults'),audit);
 // The template catalogs are checked as their folders compile them, against the composite realm.
 admitTemplate('rts',compileGame(gameDirectory('rts-frontier')).profile);
 admitTemplate('pet',compileGame(gameDirectory('pocket-pet')).profile);
}
/** Validate one game folder with its own installed profile. */
function validateGameFolder(directory:string):void{
 admitGameProfile(compileGame(directory),audit);
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
