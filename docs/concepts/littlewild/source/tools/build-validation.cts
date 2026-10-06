/// <reference path="../rts-contracts.d.ts" />
/// <reference path="../developer-contracts.d.ts" />
/** Admit canonical defaults and effective shipped packs before publishing a bundle. */
import fs from 'node:fs';
import path from 'node:path';
import {auditBalancing} from './balancing-audit.cjs';
const source=path.resolve(__dirname,'../../source');
function validateBundledDefaults():void {
 const trees=require('../skill-trees.js') as LWSkillTrees.Api;
 trees.validate(JSON.parse(fs.readFileSync(path.join(source,'content/skill-tree.json'),'utf8')));
 const rts=require('../rts-catalog.js') as LWRTSData.CatalogApi;
 rts.validate(JSON.parse(fs.readFileSync(path.join(source,'content/rts-demo.json'),'utf8')));
 const api=require('../developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};
 const scenarios=require('../scenario-runtime.js') as LWContentPorts.ScenarioApi;
 const canonical=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/balancing.json'),'utf8')) as unknown;
 const balance=api.toolbox.balancing.validate(canonical);if(!balance.ok)throw Error('Canonical balancing defaults: '+balance.errors.map(error=>error.path+': '+error.message).join('; '));
 for(const pack of scenarios.builtins()){
  const result=api.toolbox.validateScenario(pack);if(!result.ok)throw Error('Shipped scenario '+pack.id+': '+result.errors.join('; '));
 }
 const audit=auditBalancing(source);if(audit.length)throw Error('Canonical balancing consumption: '+audit.join('; '));
}
if(require.main===module){try{validateBundledDefaults();}catch(error){process.stderr.write((error instanceof Error?error.message:String(error))+'\n');process.exitCode=1;}}
export {validateBundledDefaults};
