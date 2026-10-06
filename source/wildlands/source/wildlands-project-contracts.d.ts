/// <reference path="./content-contracts.d.ts" />
/// <reference path="./developer-contracts.d.ts" />
/** Portable prototype documents; target compilation never executes authored code. */
declare namespace Wildlands {
 interface Project {
  format:'wildlands-project';schemaVersion:1;id:string;name:string;target:'godot';
  scenarioId:string;sceneId:string;pack:LWContentPorts.ScenarioPack;
 }
 interface CreateOptions {id?:string;name?:string;scenarioId?:string;sceneId?:string;pack?:unknown;}
 type Validation={ok:true;project:Project;fingerprint:string;errors:[]}|{ok:false;errors:string[]};
 interface Discovery {
  name:'wildlands';protocolVersion:1;projectFormat:'wildlands-project';projectSchemaVersion:1;
  target:'godot';maxBytes:number;defaultScenario:'littlewild';
  scenarios:LittlewildDeveloper.ScenarioSummary[];
  operations:{operation:string;description:string;arguments:Record<string,unknown>;example:string[]}[];
 }
 interface ProjectApi {
  readonly maxBytes:number;
  create(options?:CreateOptions):Project;
  validate(input:unknown):Validation;
  select(input:unknown,scenarioId:string,sceneId?:string):Project;
  capture(input:unknown,capturedPack:unknown,sceneId?:string):Project;
  scenarios():LittlewildDeveloper.ScenarioSummary[];
  discover():Discovery;
 }
}
