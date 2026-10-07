/// <reference path="./content-contracts.d.ts" />
/// <reference path="./developer-contracts.d.ts" />
/// <reference path="./content-provider-contracts.d.ts" />
/** Portable prototype documents; target compilation never executes authored code. */
declare namespace Wildlands {
 /**
  * The game a schemaVersion 2 project carries: the colony sections of the content profile that was
  * installed when the project was written (its game's default profile). RTS and Pocket Pet sections
  * are not project content and are never embedded.
  */
 interface ProjectGame {id:string;profile:LWContentProvider.Profile;}
 /** Current portable project: self-contained, so validate/inspect/run/edit/compile need no game folder. */
 interface Project {
  format:'wildlands-project';schemaVersion:2;id:string;name:string;target:'godot';
  scenarioId:string;sceneId:string;pack:LWContentPorts.ScenarioPack;game:ProjectGame;
 }
 /** Legacy schemaVersion 1 document: readable against an installed game, never compiled as is. */
 interface LegacyProject {
  format:'wildlands-project';schemaVersion:1;id:string;name:string;target:'godot';
  scenarioId:string;sceneId:string;pack:LWContentPorts.ScenarioPack;
 }
 type AnyProject=Project|LegacyProject;
 interface CreateOptions {id?:string;name?:string;scenarioId?:string;sceneId?:string;pack?:unknown;}
 /** `fingerprint`: 16 hex digits over the complete normalized document (embedded game included); change detection only. */
 type Validation={ok:true;project:AnyProject;fingerprint:string;errors:[]}|{ok:false;errors:string[]};
 /** The installed game a discovery describes; null when no game is installed. */
 interface DiscoveredGame {id:string;defaultScenario:string;scenarios:LittlewildDeveloper.ScenarioSummary[];}
 interface Discovery {
  name:'wildlands';protocolVersion:1;projectFormat:'wildlands-project';projectSchemaVersion:2;legacySchemaVersions:[1];
  target:'godot';maxBytes:number;game:DiscoveredGame|null;
  operations:{operation:string;description:string;arguments:Record<string,unknown>;example:string[]}[];
 }
 interface ProjectApi {
  readonly maxBytes:number;
  /** A schemaVersion 2 project from the installed game's scenario catalog (or a validated pack). */
  create(options?:CreateOptions):Project;
  validate(input:unknown):Validation;
  select(input:unknown,scenarioId:string,sceneId?:string):Project;
  capture(input:unknown,capturedPack:unknown,sceneId?:string):Project;
  /** Validate either version; a legacy document is rewritten with the installed game embedded. */
  upgrade(input:unknown):Project;
  scenarios():LittlewildDeveloper.ScenarioSummary[];
  discover():Discovery;
 }
}
