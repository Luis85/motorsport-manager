/// <reference path="./wildlands-project-contracts.d.ts" preserve="true" />
/** Public typed agent entry. All gameplay/authoring operations retain the existing SDK authority. */
import fs from 'node:fs';
import path from 'node:path';
import {projects} from './wildlands-project-sdk.cjs';
export {projects,toolbox,discover,runProject,editProject,inspectProject} from './wildlands-project-sdk.cjs';
export type {Project,CreateOptions,Validation,Recipe,GameOperation,EditorRecipe,RunResult} from './wildlands-project-sdk.cjs';
export {WildlandsRuntime} from './wildlands-runtime.cjs';
export type {RuntimeOptions,RuntimeResponse} from './wildlands-runtime.cjs';
export {writeGodotProject} from './tools/wildlands-godot-writer.cjs';
export interface GodotFile {path:string;encoding:'utf8'|'base64';content:string;}
export interface GodotManifest {
 format:'wildlands-godot-project';schemaVersion:1;projectId:string;scenarioId:string;sceneId:string;
 runtime:'typescript-node-bridge';prerequisites:string[];capabilities:string[];limitations:string[];
 files:{path:string;bytes:number;sha256:string}[];
}
export interface CompiledGodotProject {files:GodotFile[];manifest:GodotManifest;}
interface Compiler {compile(project:unknown,resources?:{bundle:unknown;templates:unknown}):Promise<CompiledGodotProject>;zip(compiled:CompiledGodotProject):Uint8Array;}
function compiler():Compiler{return require('./wildlands-godot.js') as Compiler;}
export async function compileGodot(input:unknown):Promise<CompiledGodotProject>{
 const checked=projects.validate(input);if(!checked.ok)throw Error(checked.errors.join('\n'));
 // Trusted compiler resources are read from this distribution, never from an input pack.
 const templates=JSON.parse(fs.readFileSync(path.join(__dirname,'wildlands-godot-templates.json'),'utf8')) as unknown;
 const bundle=JSON.parse(fs.readFileSync(path.join(__dirname,'wildlands-runtime-bundle.json'),'utf8')) as unknown;
 return compiler().compile(checked.project,{bundle,templates});
}
export function zipGodot(compiled:CompiledGodotProject):Uint8Array{return (require('./wildlands-godot.js') as Compiler).zip(compiled);}
