/// <reference path="./content-contracts.d.ts" />
/// <reference path="./renderer-data-contracts.d.ts" />
/// <reference path="./animation-data-contracts.d.ts" />
/** Inert code-generator input; deliberately not a playable scenario format. */
declare namespace LWEngineExport {
 interface SourceFile {path:string;encoding:'utf8'|'base64';role:'source'|'contract'|'data'|'schema'|'toolchain'|'vendor'|'documentation'|'configuration'|'license'|'source-archive';bytes:number;sha256:string;text:string;dependencies:string[];}
 interface SourceBundle {format:'littlewild-engine-sources';schemaVersion:1;identity:string;files:SourceFile[];inventory:{included:string[];excluded:string[];policy:string};architecture:Record<string,unknown>;build:{browserOrder:string[];compiler:string;dependencies:Record<string,unknown>};}
 /** Files listed in inlineScripts are stored empty in data and restored from the artifact's own identical inline scripts. */
 interface InlineSource {path:string;bytes:number;sha256:string;}
 interface SourceLoader {format:'littlewild-engine-source-loader';schemaVersion:1;identity:string;decodedBytes:number;compressedBytes:number;encoding:'gzip-base64';data:string;inlineScripts?:InlineSource[];}
 interface Extensions {version:1;renderers:{id:string;metadata:LittlewildRenderer.Metadata|null}[];animations:{id:string;metadata:LWAnimations.Metadata}[];}
 interface Document {format:'littlewild-engine-export';schemaVersion:1;sourceIdentity:string;sources:SourceBundle;extensions:Extensions;pack:LWContentPorts.ScenarioPack;sceneId:string;checkpoint:{format:'canonical-owner-states';owners:{id:string;state:Record<string,unknown>}[]};catalogs:Record<string,unknown>;runtime:Record<string,unknown>;godot:Record<string,unknown>;limitations:string[];}
 type Validation={ok:true;document:Document;errors:string[]}|{ok:false;errors:string[]};
 interface Decoder {parse(input:unknown):unknown;record(input:unknown):Record<string,unknown>;path(input:unknown):string;sha256(text:string):Promise<string>;sources(loader:unknown,inlineScripts?:readonly string[]):Promise<SourceBundle>;readonly maxBytes:number;}
 interface ManifestApi {extensions(pack:LWContentPorts.ScenarioPack,input?:unknown):Extensions;create(pack:LWContentPorts.ScenarioPack,sceneId:string,bundle:SourceBundle,extensions:Extensions):Pick<Document,'checkpoint'|'catalogs'|'runtime'|'godot'|'limitations'>;}
 /** Declared payload capability; an unavailable capability carries an explicit player-facing reason. */
 interface Capability {available:boolean;reason?:string;}
 interface Api {export(pack:unknown,sceneId:string):Promise<Document>;validate(input:unknown):Promise<Validation>;readonly maxBytes:number;capability():Capability;}
 /** Port on the browser engine-export module: a presentation adapter supplies the artifact's inline script texts. */
 interface InlineScriptPort {useInlineScripts(provider:()=>readonly string[]):void;}
}
