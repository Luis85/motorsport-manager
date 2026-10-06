/// <reference path="./external-editor-canvas-contracts.d.ts" />
/// <reference path="./scene-editor-contracts.d.ts" />
/** Offline, detached interchange; conversion never replaces an editor or engine. */
declare namespace LWExternalEditors {
 type Format='tiled'|'ldtk'|'gltf'|'canvas'|'advanced-canvas';
 type Mapping={externalType:string;category:LWSceneEditor.Category}&({entityId:string;templateId?:never}|{templateId:string;entityId?:never});
 interface Options {pack:LWContentPorts.ScenarioPack;sceneId:string;mappings?:Mapping[];terrain?:Record<string,'grass'|'water'>;}
 interface Metadata {version:1;pack:LWContentPorts.ScenarioPack;sceneId:string;}
 interface Placement {type:string;id?:string;category?:LWSceneEditor.Category;x:number;y:number;inventory?:Record<string,number>;stock?:number;}
 interface Tile {x:number;y:number;ground:'grass'|'water';height:number;}
 interface Exchange {bounds?:LWSceneGraph.Bounds;convertedPack?:LWContentPorts.ScenarioPack;convertedSceneId?:string;metadata?:Metadata;placements:Placement[];tiles:Tile[];warnings:string[];}
 interface Export {ok:true;format:Format;filename:string;document:Record<string,unknown>;warnings:string[];}
 type Import={ok:true;pack:LWContentPorts.ScenarioPack;sceneId:string;format:Format;warnings:string[]}|{ok:false;errors:string[];warnings:string[]};
 interface Api {formats():{id:Format;label:string;extension:string}[];detect(input:unknown):Format;export(pack:unknown,sceneId:string,format:Format):Export;import(input:unknown,options?:Options):Import;}
 interface Codec {read(document:Record<string,unknown>,options?:Options):Exchange;write(exchange:Exchange):Record<string,unknown>;}
 interface Core {record(input:unknown):Record<string,unknown>;array(input:unknown,label:string):unknown[];number(input:unknown,label:string):number;parse(input:unknown):Record<string,unknown>;parseValue(input:unknown):unknown;metadata(input:unknown):Metadata|undefined;binaryLength(document:Record<string,unknown>):number|undefined;encodeMetadata(input:Metadata):Record<string,string>;decodeMetadata(input:Record<string,unknown>):Metadata|undefined;prepare(pack:unknown,sceneId:string):Exchange;apply(exchange:Exchange,options?:Options):{pack:LWContentPorts.ScenarioPack;sceneId:string};}
}
