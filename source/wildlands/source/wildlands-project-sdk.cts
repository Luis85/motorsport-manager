/// <reference path="./wildlands-project-contracts.d.ts" preserve="true" />
/** Typed Node facade: project admission, bounded deterministic recipes and native authoring. */
import {toolbox} from './developer-sdk.cjs';
export const projects=require('./wildlands-project.js') as Wildlands.ProjectApi;
export type Project=Wildlands.Project;
export type AnyProject=Wildlands.AnyProject;
export type CreateOptions=Wildlands.CreateOptions;
export type Validation=Wildlands.Validation;
export interface Recipe {format:'wildlands-recipe';schemaVersion:1;operations:GameOperation[];}
export type GameOperation={operation:'start'|'pause'|'resume'|'inspect'|'connections'}
 |{operation:'step';count:number}|{operation:'advance';seconds:number}
 |{operation:'command';command:LittlewildDeveloper.Command}|{operation:'enterScene';connectionId:string};
export interface EditorRecipe {format:'wildlands-editor-recipe';schemaVersion:1;operations:{operation:string;args:unknown[]}[];}
export interface RunResult {project:Project;snapshot:LittlewildDeveloper.Snapshot;results:unknown[];requestedSteps:number;advancedSeconds:number;}
const gameFields:Record<string,string[]>={start:[],pause:[],resume:[],inspect:[],connections:[],step:['count'],advance:['seconds'],command:['command'],enterScene:['connectionId']};
const editorArities:Record<string,{min:number;max:number}>={replace:{min:1,max:1},updateScene:{min:2,max:2},updateWorld:{min:2,max:2},addWorld:{min:3,max:3},addScene:{min:3,max:4},removeScene:{min:1,max:1},removeWorld:{min:1,max:1},place:{min:5,max:5},setEntity:{min:4,max:4},addProp:{min:2,max:2},addEntity:{min:4,max:6},removeEntity:{min:3,max:3},undo:{min:0,max:0},redo:{min:0,max:0}};
const editorArguments:Record<string,string[]>={replace:['pack'],updateScene:['sceneId','patch'],updateWorld:['worldId','patch'],addWorld:['worldTemplate','worldId','name'],addScene:['sceneTemplate','sceneId','worldId','parentId?'],removeScene:['sceneId'],removeWorld:['worldId'],place:['sceneId','category','entityId','x','y'],setEntity:['sceneId','category','entityId','patch'],addProp:['sceneId','prop'],addEntity:['sceneId','category','templateId','entityId','x?','y?'],removeEntity:['sceneId','category','entityId'],undo:[],redo:[]};
function object(input:unknown):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected a JSON object.');return input as Record<string,unknown>;
}
function exact(input:Record<string,unknown>,fields:readonly string[]):void{
 if(Object.keys(input).length!==fields.length||fields.some(key=>!Object.hasOwn(input,key)))throw Error('Missing or unknown recipe operation fields.');
}
function admitted(input:unknown):AnyProject{const checked=projects.validate(input);if(!checked.ok)throw Error(checked.errors.join('\n'));return checked.project;}
function recipe(input:unknown,format:string):Record<string,unknown>[] {
 const C=(globalThis as unknown as {LWContent:LWContentPorts.ContentApi}).LWContent;
 const doc=object(C.parse(input,1024*1024));exact(doc,['format','schemaVersion','operations']);
 if(doc.format!==format||doc.schemaVersion!==1||!Array.isArray(doc.operations)||doc.operations.length>256)throw Error('Expected '+format+' schemaVersion 1 with at most 256 operations.');
 return doc.operations.map(object);
}
function recapture(project:AnyProject,pack:unknown,sceneId:string):Project{return projects.create({id:project.id,name:project.name,pack,sceneId});}
export function runProject(input:unknown,recipeInput:unknown):RunResult{
 const project=admitted(input),operations=recipe(recipeInput,'wildlands-recipe');let requestedSteps=0;
 for(const op of operations){
  if(typeof op.operation!=='string'||!Object.hasOwn(gameFields,op.operation))throw Error('Unknown game operation.');
  exact(op,['operation',...gameFields[op.operation]!]);
  if(op.operation==='step'||op.operation==='advance'){
   const value=op.operation==='step'?op.count:op.seconds;
   if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Clock values must be finite non-negative numbers.');
   const steps=op.operation==='step'?value:value*10;
   if(Math.abs(steps-Math.round(steps))>1e-9||steps>36000)throw Error('Clock values require whole 0.1-second steps, at most 36000.');
   requestedSteps+=Math.round(steps);
  }
  if(op.operation==='enterScene'&&(typeof op.connectionId!=='string'||!op.connectionId))throw Error('enterScene requires connectionId.');
 }
 if(requestedSteps>36000)throw Error('A recipe may request at most 36000 fixed steps in total.');
 const session=toolbox.createScenario(project.pack,project.sceneId),results:unknown[]=[];let advancedSeconds=0;
 try{
  for(const op of operations){
   switch(op.operation){
    case 'start':session.start();results.push({ok:true,operation:op.operation});break;
    case 'pause':session.pause();results.push({ok:true,operation:op.operation});break;
    case 'resume':session.resume();results.push({ok:true,operation:op.operation});break;
    case 'inspect':results.push(session.inspect());break;
    case 'connections':results.push(session.sceneConnections());break;
    case 'step':{const result=session.step(op.count as number);advancedSeconds+=result.advancedSeconds;results.push(result);break;}
    case 'advance':{const result=session.advance(op.seconds as number);advancedSeconds+=result.advancedSeconds;results.push(result);break;}
    case 'enterScene':results.push(session.enterScene(session.reviewScene(op.connectionId as string)));break;
    case 'command':{const result=session.command(op.command as LittlewildDeveloper.Command);if(!result.ok)throw Error('Command rejected: '+(result.reason??result.code??'unknown reason'));results.push(result);break;}
   }
  }
  const snapshot=session.inspect();if(!snapshot.sceneId)throw Error('Session has no selected scene.');
  return {project:projects.capture(project,session.captureScenario(),snapshot.sceneId),snapshot,results,requestedSteps,advancedSeconds};
 }finally{session.dispose();}
}
export function inspectProject(input:unknown):{project:AnyProject;fingerprint:string;snapshot:LittlewildDeveloper.Snapshot;connections:readonly LittlewildDeveloper.SceneConnection[]}{
 const project=admitted(input),session=toolbox.createScenario(project.pack,project.sceneId);
 try{return {project,fingerprint:(projects.validate(project) as Extract<Validation,{ok:true}>).fingerprint,snapshot:session.inspect(),connections:session.sceneConnections()};}
 finally{session.dispose();}
}
export function editProject(input:unknown,recipeInput:unknown):{project:Project;revision:number}{
 const project=admitted(input),operations=recipe(recipeInput,'wildlands-editor-recipe');
 for(const op of operations){
  exact(op,['operation','args']);
  if(typeof op.operation!=='string'||!Object.hasOwn(editorArities,op.operation)||!Array.isArray(op.args))throw Error('Unknown editor operation or invalid args.');
  const arity=editorArities[op.operation]!;if(op.args.length<arity.min||op.args.length>arity.max)throw Error('Invalid editor argument count: '+op.operation);
 }
 const editor=toolbox.createSceneEditor(project.pack);
 for(const op of operations){
  const a=op.args as unknown[];
  // Explicit dispatch selects native validator-owned methods; no JSON reflection or executable input.
  switch(op.operation){
   case 'replace':editor.replace(a[0]);break;
   case 'updateScene':editor.updateScene(a[0] as string,a[1] as Partial<LWContentPorts.Scene>);break;
   case 'updateWorld':editor.updateWorld(a[0] as string,a[1] as Partial<LWContentPorts.WorldProfile>);break;
   case 'addWorld':editor.addWorld(a[0] as LWContentPorts.WorldProfile,a[1] as string,a[2] as string);break;
   case 'addScene':editor.addScene(a[0] as LWContentPorts.Scene,a[1] as string,a[2] as string,a[3] as string|undefined);break;
   case 'removeScene':editor.removeScene(a[0] as string);break;
   case 'removeWorld':editor.removeWorld(a[0] as string);break;
   case 'place':editor.place(a[0] as string,a[1] as LWSceneEditor.Category,a[2] as string,a[3] as number,a[4] as number);break;
   case 'setEntity':editor.setEntity(a[0] as string,a[1] as LWSceneEditor.Category,a[2] as string,a[3] as Record<string,unknown>);break;
   case 'addProp':editor.addProp(a[0] as string,a[1] as LWSceneGraph.Prop);break;
   case 'addEntity':editor.addEntity(a[0] as string,a[1] as LWSceneEditor.Category,a[2] as string,a[3] as string,a[4] as number|undefined,a[5] as number|undefined);break;
   case 'removeEntity':editor.removeEntity(a[0] as string,a[1] as LWSceneEditor.Category,a[2] as string);break;
   case 'undo':editor.undo();break;
   case 'redo':editor.redo();break;
  }
 }
 return {project:recapture(project,editor.export(),project.sceneId),revision:editor.revision};
}
export function discover():Wildlands.Discovery&{commands:readonly LittlewildDeveloper.CommandDefinition[];recipes:Record<string,unknown>}{
 return {...projects.discover(),commands:toolbox.commands(),recipes:{maxOperations:256,maxSteps:36000,game:{format:'wildlands-recipe',schemaVersion:1,operations:Object.entries(gameFields).map(([operation,fields])=>({operation,fields})),example:{format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'start'},{operation:'advance',seconds:1},{operation:'inspect'}]}},editor:{format:'wildlands-editor-recipe',schemaVersion:1,operations:Object.entries(editorArities).map(([operation,arity])=>({operation,args:editorArguments[operation],...arity})),example:{format:'wildlands-editor-recipe',schemaVersion:1,operations:[{operation:'updateScene',args:['first-morning',{name:'My meadow'}]}]}},toolbox:{entry:'.generated/wildlands-sdk.cjs',declarations:'.generated/wildlands-sdk.d.cts',runtimeCLI:'.generated/tools/wildlands-runtime.cjs',runtimeRequest:{id:1,method:'discover',params:{}},description:'Typed SDK and retained JSON-lines runtime expose creature, storytelling, assets, balancing, external editor and simulation facets.'}}};
}
export {toolbox};
