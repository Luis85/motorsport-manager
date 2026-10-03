/// <reference path="../developer-contracts.d.ts" />
/** Admit canonical defaults and effective shipped packs before publishing a bundle. */
import fs from 'node:fs';
import path from 'node:path';
import {auditBalancing} from './balancing-audit.cjs';
const source=path.resolve(__dirname,'../../source');
function validateBundledDefaults():void {
 const api=require('../developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};
 const scenarios=require('../scenario-runtime.js') as LWContentPorts.ScenarioApi;
 const canonical=JSON.parse(fs.readFileSync(path.join(source,'content/balancing.json'),'utf8')) as unknown;
 const balance=api.toolbox.balancing.validate(canonical);if(!balance.ok)throw Error('Canonical balancing defaults: '+balance.errors.join('; '));
 for(const pack of scenarios.builtins()){
  const result=api.toolbox.validateScenario(pack);if(!result.ok)throw Error('Shipped scenario '+pack.id+': '+result.errors.join('; '));
 }
 const audit=auditBalancing(source);if(audit.length)throw Error('Canonical balancing consumption: '+audit.join('; '));
}
if(require.main===module){try{validateBundledDefaults();}catch(error){process.stderr.write((error instanceof Error?error.message:String(error))+'\n');process.exitCode=1;}}
export {validateBundledDefaults};
